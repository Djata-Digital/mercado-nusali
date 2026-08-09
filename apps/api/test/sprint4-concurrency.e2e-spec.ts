import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../src/modules/prisma/prisma.service';
import { PaymentsService } from '../src/modules/payments/payments.service';
import { PaymentIntentsService } from '../src/modules/payments/payment-intents.service';
import { OrangeMoneyProvider } from '../src/modules/payments/providers/orange-money.provider';
import { MTNMoneyProvider } from '../src/modules/payments/providers/mtn-money.provider';
import { PixProvider } from '../src/modules/payments/providers/pix.provider';
import { CardProvider } from '../src/modules/payments/providers/card.provider';
import { WalletProvider } from '../src/modules/payments/providers/wallet.provider';
import { PaymentProviderFactory } from '../src/modules/payments/providers/payment-provider.factory';
import { PaymentStateMachineService } from '../src/modules/payments/state-machine/payment-state-machine.service';
import { PaymentTransactionService } from '../src/modules/payments/services/payment-transaction.service';
import { PaymentAttemptsService } from '../src/modules/payments/services/payment-attempts.service';
import { PaymentEventsService } from '../src/modules/payments/services/payment-events.service';
import { PaymentGatewayErrorClassifierService } from '../src/modules/payments/services/payment-gateway-error-classifier.service';
import { PaymentProviderTimeoutService } from '../src/modules/payments/services/payment-provider-timeout.service';
import { PaymentCircuitBreakerService } from '../src/modules/payments/services/payment-circuit-breaker.service';
import { PaymentLogSanitizerService } from '../src/modules/payments/services/payment-log-sanitizer.service';
import { PaymentProviderValidatorService } from '../src/modules/payments/services/payment-provider-validator.service';
import { WalletService } from '../src/modules/wallet/wallet.service';
import { WalletTransactionService } from '../src/modules/wallet/services/wallet-transaction.service';
import { LedgerService } from '../src/modules/ledger/ledger.service';
import { EscrowService } from '../src/modules/escrow/escrow.service';
import { EscrowTransactionService } from '../src/modules/escrow/services/escrow-transaction.service';
import { EscrowStateMachineService } from '../src/modules/escrow/services/escrow-state-machine.service';
import { EscrowEventsService } from '../src/modules/escrow/services/escrow-events.service';
import { EscrowReleasePolicyService } from '../src/modules/escrow/services/escrow-release-policy.service';
import { EscrowRefundPolicyService } from '../src/modules/escrow/services/escrow-refund-policy.service';
import { EscrowDisputePolicyService } from '../src/modules/escrow/services/escrow-dispute-policy.service';
import { WebhooksService } from '../src/modules/webhooks/webhooks.service';
import { IdempotencyService } from '../src/modules/idempotency/idempotency.service';
import { OutboxService } from '../src/modules/outbox/outbox.service';
import { EventEmitterModule } from '@nestjs/event-emitter';
import {
  PaymentMethodType,
  PaymentProvider,
  PaymentStatus,
  EscrowStatus,
  Prisma,
} from '@prisma/client';

describe('Sprint 4 Real Concurrency & Anti-Double Spend Protections', () => {
  let paymentsService: PaymentsService;
  let walletService: WalletService;
  let escrowService: EscrowService;
  let webhooksService: WebhooksService;

  const mockPrismaService = {
    $transaction: jest.fn((cb) => cb(mockPrismaService)),
    payment: {
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    paymentIntent: {
      update: jest.fn(),
    },
    orderGroup: {
      update: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    order: {
      update: jest.fn(),
    },
    orderStatusHistory: {
      create: jest.fn(),
    },
    escrowAccount: {
      findUnique: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
    escrowTransaction: {
      create: jest.fn(),
    },
    wallet: {
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    walletTransaction: {
      create: jest.fn(),
    },
    ledgerEntry: {
      create: jest.fn(),
    },
    webhookEvent: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    paymentAttempt: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'att-1' }),
    },
    paymentEvent: {
      create: jest.fn().mockResolvedValue({ id: 'evt-1' }),
    },
    outboxEvent: {
      create: jest.fn().mockResolvedValue({ id: 'outbox-1' }),
      update: jest.fn().mockResolvedValue({ id: 'outbox-1' }),
    },
  };

  const mockIdempotencyService = {
    startOrGet: jest.fn().mockResolvedValue({ isCached: false }),
    complete: jest.fn(),
    fail: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      imports: [EventEmitterModule.forRoot()],
      providers: [
        PaymentsService,
        PaymentIntentsService,
        OrangeMoneyProvider,
        MTNMoneyProvider,
        PixProvider,
        CardProvider,
        WalletProvider,
        PaymentProviderFactory,
        PaymentStateMachineService,
        PaymentTransactionService,
        PaymentAttemptsService,
        PaymentEventsService,
        PaymentGatewayErrorClassifierService,
        PaymentProviderTimeoutService,
        PaymentCircuitBreakerService,
        PaymentLogSanitizerService,
        PaymentProviderValidatorService,
        WalletService,
        WalletTransactionService,
        LedgerService,
        EscrowService,
        EscrowTransactionService,
        EscrowStateMachineService,
        EscrowEventsService,
        EscrowReleasePolicyService,
        EscrowRefundPolicyService,
        EscrowDisputePolicyService,
        WebhooksService,
        OutboxService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: IdempotencyService, useValue: mockIdempotencyService },
      ],
    }).compile();

    paymentsService = module.get<PaymentsService>(PaymentsService);
    walletService = module.get<WalletService>(WalletService);
    escrowService = module.get<EscrowService>(EscrowService);
    webhooksService = module.get<WebhooksService>(WebhooksService);
  });

  describe('1. Double Capture Protection', () => {
    it('should allow only one capture and prevent double capture of the same payment', async () => {
      let currentStatus = PaymentStatus.PENDING;

      const buildPayment = () => ({
        id: 'pay-concurrency-1',
        orderGroupId: 'group-1',
        paymentIntentId: 'intent-1',
        buyerId: 'user-1',
        amount: new Prisma.Decimal(100),
        currencyId: 'curr-1',
        method: PaymentMethodType.CARD,
        provider: PaymentProvider.CARD_INTERNAL,
        providerTransactionId: 'card-tx-1',
        status: currentStatus,
        orderGroup: {
          currency: { code: 'XOF' },
          orders: [],
        },
      });

      mockPrismaService.payment.findUnique.mockImplementation(() =>
        Promise.resolve(buildPayment()),
      );
      mockPrismaService.payment.findUniqueOrThrow.mockImplementation(() =>
        Promise.resolve(buildPayment()),
      );
      mockPrismaService.payment.findFirst.mockResolvedValue(null);

      // Emula compare-and-set real do PostgreSQL: somente a primeira operação
      // cuja cláusula WHERE ainda corresponde ao status atual pode avançar.
      mockPrismaService.payment.updateMany.mockImplementation(({ where, data }) => {
        if (where.status !== currentStatus) {
          return Promise.resolve({ count: 0 });
        }

        currentStatus = data.status;
        return Promise.resolve({ count: 1 });
      });

      mockPrismaService.payment.update.mockImplementation(({ data }) => {
        if (data.status) currentStatus = data.status;
        return Promise.resolve({
          ...buildPayment(),
          ...data,
        });
      });

      const results = await Promise.allSettled([
        paymentsService.capturePayment(
          'user-1',
          'pay-concurrency-1',
          'idem-cap-1',
          {},
        ),
        paymentsService.capturePayment(
          'user-1',
          'pay-concurrency-1',
          'idem-cap-2',
          {},
        ),
      ]);

      const fulfilled = results.filter((result) => result.status === 'fulfilled');
      const rejected = results.filter((result) => result.status === 'rejected');

      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect((fulfilled[0] as PromiseFulfilledResult<any>).value.success).toBe(true);
      expect(currentStatus).toBe(PaymentStatus.CAPTURED);
      expect(mockPrismaService.paymentAttempt.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('2. Concurrent Duplicate Webhook Protection', () => {
    it('should ignore duplicate webhooks with same eventId and return cached response', async () => {
      let processed = false;

      mockPrismaService.webhookEvent.findUnique.mockImplementation(() => {
        if (processed) {
          return Promise.resolve({
            id: 'wh-1',
            provider: 'ORANGE',
            eventId: 'evt-concurrent-1',
            status: 'PROCESSED',
            resultJson: { status: 'SUCCESS' },
          });
        }
        return Promise.resolve(null);
      });

      mockPrismaService.webhookEvent.create.mockImplementation(() => {
        processed = true;
        return Promise.resolve({ id: 'wh-1' });
      });

      mockPrismaService.webhookEvent.update.mockResolvedValue({});

      const res1 = await webhooksService.processWebhook('ORANGE', 'evt-concurrent-1', 'payment.captured', {}, { amount: 100 });
      const res2 = await webhooksService.processWebhook('ORANGE', 'evt-concurrent-1', 'payment.captured', {}, { amount: 100 });

      expect(res1.alreadyProcessed).toBe(false);
      expect(res2.alreadyProcessed).toBe(true);
    });
  });

  describe('3. Escrow Double Release Protection', () => {
    it('should keep second release idempotent without a second payout', async () => {
      const current: any = {
        id: 'escrow-conc-1', orderId: 'order-1', orderGroupId: 'group-1', sellerId: 'seller-1', buyerId: 'buyer-1',
        totalAmount: new Prisma.Decimal(100), heldAmount: new Prisma.Decimal(100), releasedAmount: new Prisma.Decimal(0),
        refundedAmount: new Prisma.Decimal(0), commissionAmount: new Prisma.Decimal(10), status: EscrowStatus.HELD,
        currencyId: 'curr-1', disputeDeadline: null, seller: { id: 'seller-1', userId: 'user-seller-1' },
        order: { id: 'order-1', status: 'DELIVERED', storeId: 'store-1' },
      };
      mockPrismaService.escrowAccount.findUnique.mockImplementation(async () => current);
      (mockPrismaService.escrowAccount as any).findUniqueOrThrow = jest.fn(async () => current);
      (mockPrismaService.escrowAccount as any).updateMany = jest.fn(async ({ data }: any) => {
        current.status = data.status;
        current.heldAmount = current.heldAmount.sub(data.heldAmount.decrement);
        current.releasedAmount = current.releasedAmount.add(data.releasedAmount.increment);
        return { count: 1 };
      });
      mockPrismaService.wallet.findUnique.mockResolvedValue({ id: 'w-1', userId: 'user-seller-1', currencyId: 'curr-1', status: 'ACTIVE', balanceAvailable: new Prisma.Decimal(0) });
      mockPrismaService.wallet.updateMany.mockResolvedValue({ count: 1 });

      await expect(escrowService.releaseEscrow('order-1')).resolves.toBeDefined();
      const firstWalletTransactions = mockPrismaService.walletTransaction.create.mock.calls.length;
      await expect(escrowService.releaseEscrow('order-1')).resolves.toBeDefined();
      expect(mockPrismaService.walletTransaction.create).toHaveBeenCalledTimes(firstWalletTransactions);
    });
  });
});
