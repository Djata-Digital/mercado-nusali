import { ConflictException } from '@nestjs/common';
import { EscrowStatus, OrderStatus, Prisma, WalletStatus } from '@prisma/client';
import { EscrowService } from './escrow.service';
import { EscrowEventsService } from './services/escrow-events.service';
import { EscrowReleasePolicyService } from './services/escrow-release-policy.service';
import { EscrowRefundPolicyService } from './services/escrow-refund-policy.service';
import { EscrowDisputePolicyService } from './services/escrow-dispute-policy.service';
import { EscrowStateMachineService } from './services/escrow-state-machine.service';

describe('EscrowService - refund/cancel/dispute Sprint 7.2.4', () => {
  let tx: any;
  let service: EscrowService;
  let walletService: any;
  let ledgerService: any;
  let current: any;

  beforeEach(() => {
    current = {
      id: 'escrow-1', orderId: 'order-1', orderGroupId: 'group-1', sellerId: 'seller-1', buyerId: 'buyer-1',
      totalAmount: new Prisma.Decimal(100), heldAmount: new Prisma.Decimal(100), releasedAmount: new Prisma.Decimal(0),
      refundedAmount: new Prisma.Decimal(0), commissionAmount: new Prisma.Decimal(10), currencyId: 'curr-xof',
      status: EscrowStatus.HELD as EscrowStatus, disputeDeadline: null,
      order: { id: 'order-1', orderNumber: 'ORD-1', orderGroupId: 'group-1', status: OrderStatus.CANCELLED, storeId: 'store-1' },
    };

    tx = {
      escrowAccount: {
        findUnique: jest.fn().mockImplementation(async () => current),
        findUniqueOrThrow: jest.fn().mockImplementation(async () => current),
        updateMany: jest.fn().mockImplementation(async ({ data }: any) => {
          current.status = data.status;
          if (data.heldAmount?.decrement) current.heldAmount = current.heldAmount.sub(data.heldAmount.decrement);
          if (data.refundedAmount?.increment) current.refundedAmount = current.refundedAmount.add(data.refundedAmount.increment);
          if (data.releasedAmount?.increment) current.releasedAmount = current.releasedAmount.add(data.releasedAmount.increment);
          return { count: 1 };
        }),
      },
      escrowTransaction: { create: jest.fn().mockResolvedValue({ id: 'escrow-tx-1' }) },
      refund: { create: jest.fn().mockResolvedValue({ id: 'refund-1' }) },
      outboxEvent: { create: jest.fn().mockResolvedValue({ id: 'outbox-1' }) },
      order: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      orderStatusHistory: { create: jest.fn().mockResolvedValue({ id: 'history-1' }) },
    };
    walletService = {
      creditEscrowRefundInTransaction: jest.fn().mockResolvedValue({ wallet: { id: 'wallet-buyer', status: WalletStatus.ACTIVE } }),
      creditEscrowReleaseInTransaction: jest.fn().mockResolvedValue({ wallet: { id: 'wallet-seller', status: WalletStatus.ACTIVE } }),
    };
    ledgerService = { createDoubleEntry: jest.fn().mockResolvedValue({ id: 'ledger-1' }) };
    service = new EscrowService(
      {} as any,
      ledgerService,
      { publishEvent: jest.fn() } as any,
      walletService,
      { run: jest.fn(async (operation: any) => operation(tx)) } as any,
      new EscrowStateMachineService(),
      new EscrowEventsService(),
      new EscrowReleasePolicyService(),
      new EscrowRefundPolicyService(),
      new EscrowDisputePolicyService(),
    );
  });

  it('deve reembolsar integralmente o saldo ao comprador', async () => {
    const result = await service.refundEscrow('order-1');
    expect(result.escrow.status).toBe(EscrowStatus.REFUNDED);
    expect(result.escrow.heldAmount.eq(0)).toBe(true);
    expect(walletService.creditEscrowRefundInTransaction).toHaveBeenCalledWith(tx, expect.objectContaining({ amount: new Prisma.Decimal(100) }));
    expect(tx.outboxEvent.create).toHaveBeenCalledWith({ data: expect.objectContaining({ eventType: 'escrow.refunded' }) });
  });

  it('deve reembolsar apenas saldo restante após release parcial', async () => {
    current.status = EscrowStatus.PARTIALLY_RELEASED;
    current.heldAmount = new Prisma.Decimal(60);
    current.releasedAmount = new Prisma.Decimal(40);
    await service.refundEscrow('order-1');
    expect(walletService.creditEscrowRefundInTransaction).toHaveBeenCalledWith(tx, expect.objectContaining({ amount: new Prisma.Decimal(60) }));
    expect(current.releasedAmount.eq(40)).toBe(true);
    expect(current.refundedAmount.eq(60)).toBe(true);
  });

  it('deve impedir refund acima do saldo', async () => {
    await expect(service.refundEscrow('order-1', 120)).rejects.toThrow();
    expect(walletService.creditEscrowRefundInTransaction).not.toHaveBeenCalled();
  });

  it('deve cancelar financeiramente pedido CANCELLED e devolver saldo', async () => {
    const result = await service.cancelEscrow('order-1');
    expect(result.status).toBe(EscrowStatus.CANCELLED);
    expect(tx.outboxEvent.create).toHaveBeenCalledWith({ data: expect.objectContaining({ eventType: 'escrow.cancelled' }) });
  });

  it('deve bloquear refund automático quando Order está DISPUTED', async () => {
    current.order.status = OrderStatus.DISPUTED;
    await expect(service.refundEscrow('order-1')).rejects.toThrow(ConflictException);
  });

  it('BUYER_WINS deve devolver o saldo e resolver Order como REFUNDED', async () => {
    current.order.status = OrderStatus.DISPUTED;
    const result: any = await service.resolveDispute('order-1', 'BUYER_WINS');
    expect(result.escrow.status).toBe(EscrowStatus.REFUNDED);
    expect(tx.order.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { status: OrderStatus.REFUNDED } }));
    expect(tx.outboxEvent.create).toHaveBeenCalledWith({ data: expect.objectContaining({ eventType: 'escrow.dispute_resolved' }) });
  });

  it('deve impedir double spend quando refund perde o CAS', async () => {
    tx.escrowAccount.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.refundEscrow('order-1')).rejects.toThrow(ConflictException);
    expect(walletService.creditEscrowRefundInTransaction).not.toHaveBeenCalled();
  });

  it('falha de Outbox deve propagar para rollback integral do chamador', async () => {
    tx.outboxEvent.create.mockRejectedValue(new Error('outbox failed'));
    await expect(service.refundEscrow('order-1')).rejects.toThrow('outbox failed');
  });
});
