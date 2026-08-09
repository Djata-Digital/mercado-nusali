import { ConflictException } from '@nestjs/common';
import { EscrowStatus, OrderStatus, Prisma, WalletStatus } from '@prisma/client';

import { EscrowService } from './escrow.service';
import { EscrowEventsService } from './services/escrow-events.service';
import { EscrowReleasePolicyService } from './services/escrow-release-policy.service';
import { EscrowRefundPolicyService } from './services/escrow-refund-policy.service';
import { EscrowDisputePolicyService } from './services/escrow-dispute-policy.service';
import { EscrowStateMachineService } from './services/escrow-state-machine.service';

describe('EscrowService - produção Sprint 7.2.2', () => {
  let service: EscrowService;
  let tx: any;
  let walletService: any;
  let ledgerService: any;
  let events: EscrowEventsService;

  const escrowBase = () => ({
    id: 'escrow-1',
    orderId: 'order-1',
    orderGroupId: 'group-1',
    sellerId: 'seller-1',
    buyerId: 'buyer-1',
    totalAmount: new Prisma.Decimal(100),
    heldAmount: new Prisma.Decimal(100),
    releasedAmount: new Prisma.Decimal(0),
    refundedAmount: new Prisma.Decimal(0),
    commissionAmount: new Prisma.Decimal(10),
    currencyId: 'curr-xof',
    status: EscrowStatus.HELD as EscrowStatus,
    disputeDeadline: null,
    seller: { id: 'seller-1', userId: 'seller-user-1' },
    order: { id: 'order-1', status: OrderStatus.DELIVERED, storeId: 'store-1' },
  });

  beforeEach(() => {
    const current = escrowBase();
    tx = {
      escrowAccount: {
        findUnique: jest.fn().mockResolvedValue(current),
        updateMany: jest.fn().mockImplementation(async ({ data }: any) => {
          current.status = data.status;
          current.heldAmount = current.heldAmount.sub(data.heldAmount.decrement);
          current.releasedAmount = current.releasedAmount.add(data.releasedAmount.increment);
          return { count: 1 };
        }),
        findUniqueOrThrow: jest.fn().mockImplementation(async () => current),
      },
      escrowTransaction: { create: jest.fn().mockResolvedValue({ id: 'escrow-tx-1' }) },
      outboxEvent: { create: jest.fn().mockResolvedValue({ id: 'outbox-1' }) },
    };

    walletService = {
      creditEscrowReleaseInTransaction: jest.fn().mockResolvedValue({
        wallet: { id: 'wallet-1', status: WalletStatus.ACTIVE },
      }),
    };
    ledgerService = { createDoubleEntry: jest.fn().mockResolvedValue({ id: 'ledger-1' }) };
    events = new EscrowEventsService();

    const transaction = { run: jest.fn(async (operation: any) => operation(tx)) };
    service = new EscrowService(
      {} as any,
      ledgerService,
      { publishEvent: jest.fn() } as any,
      walletService,
      transaction as any,
      new EscrowStateMachineService(),
      events,
      new EscrowReleasePolicyService(),
      new EscrowRefundPolicyService(),
      new EscrowDisputePolicyService(),
    );
  });

  it('deve liberar integralmente e separar vendedor/comissão', async () => {
    const result = await service.releaseEscrow('order-1');

    expect(result.status).toBe(EscrowStatus.RELEASED);
    expect(result.heldAmount.toFixed(2)).toBe('0.00');
    expect(walletService.creditEscrowReleaseInTransaction).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ amount: new Prisma.Decimal(90) }),
    );
    expect(ledgerService.createDoubleEntry).toHaveBeenCalledTimes(2);
    expect(tx.outboxEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ eventType: 'escrow.released' }),
    });
  });

  it('deve permitir release parcial proporcional', async () => {
    const result = await service.releasePartial('order-1', 40);

    expect(result.status).toBe(EscrowStatus.PARTIALLY_RELEASED);
    expect(result.heldAmount.toFixed(2)).toBe('60.00');
    expect(result.releasedAmount.toFixed(2)).toBe('40.00');
    expect(walletService.creditEscrowReleaseInTransaction).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ amount: new Prisma.Decimal(36) }),
    );
    expect(tx.outboxEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ eventType: 'escrow.partially_released' }),
    });
  });

  it('deve distribuir resíduo de comissão na liberação final', async () => {
    const current = escrowBase();
    current.totalAmount = new Prisma.Decimal(100);
    current.commissionAmount = new Prisma.Decimal(10);
    current.heldAmount = new Prisma.Decimal(60);
    current.releasedAmount = new Prisma.Decimal(40);
    current.status = EscrowStatus.PARTIALLY_RELEASED;
    tx.escrowAccount.findUnique.mockResolvedValue(current);
    tx.escrowAccount.findUniqueOrThrow.mockImplementation(async () => current);
    tx.escrowAccount.updateMany.mockImplementation(async ({ data }: any) => {
      current.status = data.status;
      current.heldAmount = current.heldAmount.sub(data.heldAmount.decrement);
      current.releasedAmount = current.releasedAmount.add(data.releasedAmount.increment);
      return { count: 1 };
    });

    await service.releaseEscrow('order-1');
    expect(walletService.creditEscrowReleaseInTransaction).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ amount: new Prisma.Decimal(54) }),
    );
  });

  it('deve ser idempotente após RELEASED sem novo payout', async () => {
    const current = escrowBase();
    current.status = EscrowStatus.RELEASED;
    current.heldAmount = new Prisma.Decimal(0);
    current.releasedAmount = new Prisma.Decimal(100);
    tx.escrowAccount.findUnique.mockResolvedValue(current);

    const result = await service.releaseEscrow('order-1');
    expect(result).toBe(current);
    expect(walletService.creditEscrowReleaseInTransaction).not.toHaveBeenCalled();
    expect(ledgerService.createDoubleEntry).not.toHaveBeenCalled();
    expect(tx.outboxEvent.create).not.toHaveBeenCalled();
  });

  it('deve impedir double payout quando outro worker vencer o CAS', async () => {
    tx.escrowAccount.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.releaseEscrow('order-1')).rejects.toBeInstanceOf(ConflictException);
    expect(walletService.creditEscrowReleaseInTransaction).not.toHaveBeenCalled();
    expect(ledgerService.createDoubleEntry).not.toHaveBeenCalled();
  });

  it('deve propagar falha da Wallet para rollback do chamador', async () => {
    walletService.creditEscrowReleaseInTransaction.mockRejectedValue(new Error('wallet failed'));
    await expect(service.releaseEscrow('order-1')).rejects.toThrow('wallet failed');
    expect(tx.outboxEvent.create).not.toHaveBeenCalled();
  });

  it('deve propagar falha do Ledger antes do Outbox', async () => {
    ledgerService.createDoubleEntry.mockRejectedValue(new Error('ledger failed'));
    await expect(service.releaseEscrow('order-1')).rejects.toThrow('ledger failed');
    expect(tx.outboxEvent.create).not.toHaveBeenCalled();
  });

  it('deve propagar falha do Outbox para rollback integral', async () => {
    tx.outboxEvent.create.mockRejectedValue(new Error('outbox failed'));
    await expect(service.releaseEscrow('order-1')).rejects.toThrow('outbox failed');
  });
});
