import { ConflictException } from '@nestjs/common';
import {
  OrderGroupStatus,
  OrderStatus,
  PaymentMethodType,
  PaymentProvider,
  PaymentStatus,
  Prisma,
} from '@prisma/client';

import { PaymentsService } from './payments.service';
import { CardProvider } from './providers/card.provider';
import { MTNMoneyProvider } from './providers/mtn-money.provider';
import { OrangeMoneyProvider } from './providers/orange-money.provider';
import { PixProvider } from './providers/pix.provider';
import { WalletProvider } from './providers/wallet.provider';
import { PaymentProviderFactory } from './providers/payment-provider.factory';
import { PaymentGatewayErrorClassifierService } from './services/payment-gateway-error-classifier.service';
import { PaymentCircuitBreakerService } from './services/payment-circuit-breaker.service';
import { PaymentLogSanitizerService } from './services/payment-log-sanitizer.service';
import { PaymentProviderTimeoutError } from './services/payment-provider-timeout.service';

describe('PaymentsService - refatoração Sprint 7.1.3', () => {
  const basePayment = {
    id: 'payment-1',
    paymentIntentId: 'intent-1',
    orderGroupId: 'group-1',
    buyerId: 'buyer-1',
    amount: new Prisma.Decimal(100),
    currencyId: 'currency-1',
    method: PaymentMethodType.ORANGE_MONEY,
    provider: PaymentProvider.ORANGE,
    status: PaymentStatus.PENDING,
    providerReference: null,
    providerTransactionId: null,
    metadataJson: null,
  };

  let tx: any;
  let prisma: any;
  let idempotency: any;
  let paymentIntents: any;
  let escrow: any;
  let wallet: any;
  let stateMachine: any;
  let transaction: any;
  let attempts: any;
  let events: any;
  let timeout: any;
  let service: PaymentsService;

  beforeEach(() => {
    tx = {
      payment: {
        create: jest.fn().mockResolvedValue(basePayment),
        update: jest
          .fn()
          .mockImplementation(({ data }) =>
            Promise.resolve({ ...basePayment, ...data }),
          ),
        findUnique: jest.fn(),
        findFirst: jest.fn().mockResolvedValue(null),
      },
      paymentIntent: { update: jest.fn().mockResolvedValue({}) },
      order: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      orderStatusHistory: { create: jest.fn().mockResolvedValue({}) },
      orderGroup: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    };

    prisma = {
      payment: {
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn(),
      },
    };

    idempotency = {
      startOrGet: jest.fn().mockResolvedValue({ isCached: false }),
      complete: jest.fn(),
      fail: jest.fn(),
    };

    paymentIntents = {
      getIntentById: jest.fn().mockResolvedValue({
        id: 'intent-1',
        orderGroupId: 'group-1',
        buyerId: 'buyer-1',
        amount: new Prisma.Decimal(100),
        currencyId: 'currency-1',
        currency: { code: 'XOF' },
        status: PaymentStatus.CREATED,
      }),
    };

    escrow = { holdEscrow: jest.fn().mockResolvedValue({ id: 'escrow-1' }) };
    wallet = { withdraw: jest.fn().mockResolvedValue({}) };

    stateMachine = {
      transition: jest.fn().mockImplementation((_tx, input) =>
        Promise.resolve({
          ...basePayment,
          status: input.toStatus,
          provider: basePayment.provider,
        }),
      ),
    };

    transaction = {
      run: jest.fn().mockImplementation((callback) => callback(tx)),
    };
    attempts = { record: jest.fn().mockResolvedValue({ id: 'attempt-1' }) };
    events = {
      recordCreated: jest.fn().mockResolvedValue({ id: 'outbox-created' }),
      recordStatusEvent: jest.fn().mockResolvedValue({ id: 'outbox-status' }),
    };
    timeout = {
      invoke: jest.fn().mockImplementation(async (_provider, operation) => {
        const startedAt = Date.now();
        const result = await operation();
        return { result, durationMs: Date.now() - startedAt, timeoutMs: 30_000 };
      }),
    };

    service = new PaymentsService(
      prisma,
      idempotency,
      paymentIntents,
      escrow,
      wallet,
      stateMachine,
      transaction,
      attempts,
      events,
      new PaymentProviderFactory(
        new OrangeMoneyProvider(),
        new MTNMoneyProvider(),
        new PixProvider(),
        new CardProvider(),
        new WalletProvider(),
      ),
      new PaymentGatewayErrorClassifierService(),
      timeout,
      new PaymentCircuitBreakerService(),
      new PaymentLogSanitizerService(),
      { assertEnabled: jest.fn() } as any,
    );
  });

  it('deve criar Payment e Outbox dentro da transação e chamar provider fora dela', async () => {
    const result: any = await service.processPayment(
      'buyer-1',
      {
        paymentIntentId: 'intent-1',
        method: PaymentMethodType.ORANGE_MONEY,
      },
      'idem-1',
      {},
    );

    expect(tx.payment.create).toHaveBeenCalledTimes(1);
    expect(events.recordCreated).toHaveBeenCalledWith(tx, basePayment);
    expect(attempts.record).toHaveBeenCalledTimes(1);
    expect(result.success).toBe(true);
    expect(result.data.providerTransactionId).toBeUndefined();
    expect(idempotency.complete).toHaveBeenCalledTimes(1);
  });

  it('deve fazer claim PROCESSING antes da captura e finalizar Escrow/Orders em CAPTURED', async () => {
    const authorized = {
      ...basePayment,
      method: PaymentMethodType.CARD,
      provider: PaymentProvider.CARD_INTERNAL,
      status: PaymentStatus.AUTHORIZED,
      providerTransactionId: 'card-tx-1',
    };
    const processing = { ...authorized, status: PaymentStatus.PROCESSING };
    const order = {
      id: 'order-1',
      orderNumber: 'ORD-1',
      storeId: 'store-1',
      sellerId: 'seller-1',
      status: OrderStatus.PENDING_PAYMENT,
      subtotal: new Prisma.Decimal(100),
      shippingAmount: new Prisma.Decimal(0),
      discountAmount: new Prisma.Decimal(0),
      estimatedTaxAmount: new Prisma.Decimal(0),
      total: new Prisma.Decimal(100),
    };
    const detailed = {
      ...processing,
      orderGroup: {
        id: 'group-1',
        status: OrderGroupStatus.PENDING_PAYMENT,
        currency: { code: 'XOF' },
        orders: [order],
      },
    };

    tx.payment.findUnique
      .mockResolvedValueOnce(authorized)
      .mockResolvedValueOnce(detailed);
    tx.payment.update.mockResolvedValue({
      ...detailed,
      status: PaymentStatus.CAPTURED,
      paidAt: new Date(),
    });
    stateMachine.transition.mockImplementation((_tx, input) => {
      if (input.toStatus === PaymentStatus.PROCESSING) return Promise.resolve(processing);
      return Promise.resolve({ ...detailed, status: input.toStatus });
    });

    const result: any = await service.capturePayment(
      'operator-1',
      'payment-1',
      'capture-idem-1',
      {},
    );

    expect(stateMachine.transition).toHaveBeenNthCalledWith(
      1,
      tx,
      expect.objectContaining({ toStatus: PaymentStatus.PROCESSING }),
    );
    expect(escrow.holdEscrow).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: 'order-1' }),
      tx,
    );
    expect(stateMachine.transition).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ toStatus: PaymentStatus.CAPTURED }),
    );
    expect(tx.order.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: OrderStatus.PENDING_PAYMENT }),
      }),
    );
    expect(result.success).toBe(true);
  });

  it('deve debitar Nusali Wallet usando o mesmo TransactionClient da captura', async () => {
    const walletPayment = {
      ...basePayment,
      method: PaymentMethodType.NUSALI_WALLET,
      provider: PaymentProvider.NUSALI,
      status: PaymentStatus.AUTHORIZED,
    };
    const processing = { ...walletPayment, status: PaymentStatus.PROCESSING };
    const detailed = {
      ...processing,
      orderGroup: {
        currency: { code: 'XOF' },
        orders: [],
      },
    };

    tx.payment.findUnique
      .mockResolvedValueOnce(walletPayment)
      .mockResolvedValueOnce(detailed);
    tx.payment.update.mockResolvedValue({
      ...detailed,
      status: PaymentStatus.CAPTURED,
    });
    stateMachine.transition.mockImplementation((_tx, input) =>
      Promise.resolve({ ...detailed, status: input.toStatus }),
    );

    await service.capturePayment('buyer-1', 'payment-1', 'wallet-cap-1', {});

    expect(wallet.withdraw).toHaveBeenCalledWith(
      'buyer-1',
      walletPayment.amount,
      walletPayment.currencyId,
      expect.any(String),
      tx,
    );
  });

  it('deve rejeitar segundo worker quando o pagamento já está PROCESSING', async () => {
    tx.payment.findUnique.mockResolvedValue({
      ...basePayment,
      status: PaymentStatus.PROCESSING,
    });

    await expect(
      service.capturePayment('operator-2', 'payment-1', 'idem-race', {}),
    ).rejects.toThrow(ConflictException);

    expect(attempts.record).not.toHaveBeenCalled();
  });

  it('deve classificar timeout do provider, registrar falha e preservar auditoria', async () => {
    tx.payment.findUnique.mockResolvedValue({
      ...basePayment,
      status: PaymentStatus.PENDING,
    });
    timeout.invoke.mockRejectedValueOnce(
      new PaymentProviderTimeoutError(PaymentProvider.ORANGE, 25),
    );

    const promise = service.processPayment(
      'buyer-1',
      {
        paymentIntentId: 'intent-1',
        method: PaymentMethodType.ORANGE_MONEY,
      },
      'idem-timeout',
      {},
    );

    await expect(promise).rejects.toMatchObject({
      errorCode: 'PAYMENT_TIMEOUT',
      retryable: true,
    });

    expect(attempts.record).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        paymentId: 'payment-1',
        provider: PaymentProvider.ORANGE,
        status: PaymentStatus.FAILED,
      }),
    );
    expect(events.recordStatusEvent).toHaveBeenCalledWith(
      tx,
      'payment-1',
      PaymentStatus.FAILED,
      expect.objectContaining({
        message: expect.stringContaining('tempo limite'),
      }),
    );
    expect(idempotency.fail).toHaveBeenCalledWith(
      'buyer-1',
      'payment-process',
      'idem-timeout',
    );
  });

  it('deve bloquear chamada ao provider quando circuit breaker estiver OPEN', async () => {
    process.env.PAYMENT_CB_FAILURE_THRESHOLD = '1';

    const classifier = new PaymentGatewayErrorClassifierService();
    const breaker = new PaymentCircuitBreakerService();
    const failingTimeout = {
      invoke: jest.fn().mockRejectedValue(
        classifier.classify({ code: 'ETIMEDOUT' }),
      ),
    };

    const isolatedService = new PaymentsService(
      prisma,
      idempotency,
      paymentIntents,
      escrow,
      wallet,
      stateMachine,
      transaction,
      attempts,
      events,
      new PaymentProviderFactory(
        new OrangeMoneyProvider(),
        new MTNMoneyProvider(),
        new PixProvider(),
        new CardProvider(),
        new WalletProvider(),
      ),
      classifier,
      failingTimeout as any,
      breaker,
      new PaymentLogSanitizerService(),
      { assertEnabled: jest.fn() } as any,
    );

    await expect(
      isolatedService.processPayment(
        'buyer-1',
        {
          paymentIntentId: 'intent-1',
          method: PaymentMethodType.ORANGE_MONEY,
        },
        '',
        {},
      ),
    ).rejects.toMatchObject({ errorCode: 'PAYMENT_TIMEOUT' });

    failingTimeout.invoke.mockClear();
    tx.payment.create.mockResolvedValue({ ...basePayment, id: 'payment-2' });

    await expect(
      isolatedService.processPayment(
        'buyer-1',
        {
          paymentIntentId: 'intent-1',
          method: PaymentMethodType.ORANGE_MONEY,
        },
        '',
        {},
      ),
    ).rejects.toMatchObject({ errorCode: 'PROVIDER_UNAVAILABLE' });

    expect(failingTimeout.invoke).not.toHaveBeenCalled();
    delete process.env.PAYMENT_CB_FAILURE_THRESHOLD;
  });
});
