import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { PrismaService } from './prisma/prisma.service';
import { PaymentsService } from './payments/payments.service';
import { PaymentIntentsService } from './payments/payment-intents.service';
import { OrangeMoneyProvider } from './payments/providers/orange-money.provider';
import { MTNMoneyProvider } from './payments/providers/mtn-money.provider';
import { PixProvider } from './payments/providers/pix.provider';
import { CardProvider } from './payments/providers/card.provider';
import { WalletProvider } from './payments/providers/wallet.provider';
import { PaymentProviderFactory } from './payments/providers/payment-provider.factory';
import { WalletService } from './wallet/wallet.service';
import { WalletTransactionService } from './wallet/services/wallet-transaction.service';
import { LedgerService } from './ledger/ledger.service';
import { EscrowService } from './escrow/escrow.service';
import { RefundsService } from './refunds/refunds.service';
import { RefundTransactionService } from './refunds/services/refund-transaction.service';
import { RefundProviderExecutionService } from './refunds/services/refund-provider-execution.service';
import { WebhooksService } from './webhooks/webhooks.service';
import { OutboxService } from './outbox/outbox.service';
import { IdempotencyService } from './idempotency/idempotency.service';
import { PaymentMethodType, PaymentStatus, Prisma } from '@prisma/client';
import { PaymentStateMachineService } from './payments/state-machine/payment-state-machine.service';
import { PaymentTransactionService } from './payments/services/payment-transaction.service';
import { PaymentAttemptsService } from './payments/services/payment-attempts.service';
import { PaymentEventsService } from './payments/services/payment-events.service';
import { PaymentGatewayErrorClassifierService } from './payments/services/payment-gateway-error-classifier.service';
import { PaymentProviderTimeoutService } from './payments/services/payment-provider-timeout.service';
import { PaymentCircuitBreakerService } from './payments/services/payment-circuit-breaker.service';
import { PaymentLogSanitizerService } from './payments/services/payment-log-sanitizer.service';
import { PaymentProviderValidatorService } from './payments/services/payment-provider-validator.service';
import { EscrowTransactionService } from './escrow/services/escrow-transaction.service';
import { EscrowStateMachineService } from './escrow/services/escrow-state-machine.service';
import { EscrowEventsService } from './escrow/services/escrow-events.service';
import { EscrowReleasePolicyService } from './escrow/services/escrow-release-policy.service';
import { EscrowRefundPolicyService } from './escrow/services/escrow-refund-policy.service';
import { EscrowDisputePolicyService } from './escrow/services/escrow-dispute-policy.service';


describe('Sprint 4 Financial Infrastructure Unit Tests', () => {
  let paymentsService: PaymentsService;
  let paymentIntentsService: PaymentIntentsService;
  let walletService: WalletService;
  let ledgerService: LedgerService;
  let escrowService: EscrowService;
  let refundsService: RefundsService;
  let webhooksService: WebhooksService;

  const mockPrismaService = {
    $transaction: jest.fn((cb) => cb(mockPrismaService)),
    orderGroup: {
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    order: {
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    orderStatusHistory: {
      create: jest.fn(),
    },
    paymentIntent: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    payment: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    paymentAttempt: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn(),
    },
    paymentEvent: {
      create: jest.fn(),
    },
    wallet: {
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    walletTransaction: {
      create: jest.fn().mockResolvedValue({ id: 'tx-wlt-1' }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    ledgerEntry: {
      create: jest.fn().mockResolvedValue({ id: 'ledger-1' }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    escrowAccount: {
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      create: jest.fn().mockResolvedValue({ id: 'escrow-1' }),
      update: jest.fn().mockResolvedValue({ id: 'escrow-1' }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    escrowTransaction: {
      create: jest.fn().mockResolvedValue({ id: 'escrow-tx-1' }),
    },
    refund: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn().mockResolvedValue({ id: 'refund-1' }),
    },
    webhookEvent: {
      findUnique: jest.fn(),
      create: jest.fn().mockResolvedValue({ id: 'wh-1' }),
      update: jest.fn().mockResolvedValue({ id: 'wh-1' }),
    },
    outboxEvent: {
      create: jest.fn().mockResolvedValue({ id: 'outbox-1' }),
      update: jest.fn().mockResolvedValue({ id: 'outbox-1' }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    currency: {
      findFirst: jest.fn().mockResolvedValue({ id: 'curr-gw', code: 'XOF' }),
    },
    sellerProfile: {
      findUnique: jest.fn(),
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
        PaymentStateMachineService,
        PaymentTransactionService,
        PaymentAttemptsService,
        PaymentEventsService,
        PaymentGatewayErrorClassifierService,
        PaymentProviderTimeoutService,
        PaymentCircuitBreakerService,
        PaymentLogSanitizerService,
        PaymentProviderValidatorService,
        OrangeMoneyProvider,
        MTNMoneyProvider,
        PixProvider,
        CardProvider,
        WalletProvider,
        PaymentProviderFactory,
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
        RefundTransactionService,
        RefundProviderExecutionService,
        RefundsService,
        WebhooksService,
        OutboxService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: IdempotencyService, useValue: mockIdempotencyService },
      ],
    }).compile();

    paymentsService = module.get<PaymentsService>(PaymentsService);
    paymentIntentsService = module.get<PaymentIntentsService>(PaymentIntentsService);
    walletService = module.get<WalletService>(WalletService);
    ledgerService = module.get<LedgerService>(LedgerService);
    escrowService = module.get<EscrowService>(EscrowService);
    refundsService = module.get<RefundsService>(RefundsService);
    webhooksService = module.get<WebhooksService>(WebhooksService);
  });

  describe('1. PaymentIntentsService & PaymentsService', () => {
    it('should create PaymentIntent and prevent duplicate active intents for same OrderGroup', async () => {
      mockPrismaService.orderGroup.findUnique.mockResolvedValue({
        id: 'group-100',
        userId: 'user-1',
        total: new Prisma.Decimal(500),
        currencyId: 'curr-1',
        status: 'PENDING_PAYMENT',
      });

      mockPrismaService.paymentIntent.findUnique.mockResolvedValue({
        id: 'intent-active',
        orderGroupId: 'group-100',
        status: PaymentStatus.CREATED,
      });

      const intent = await paymentIntentsService.createIntent('user-1', 'group-100');
      expect(intent.id).toBe('intent-active');
      expect(mockPrismaService.paymentIntent.create).not.toHaveBeenCalled();
    });

    it('should sanitize buyer payment response hiding provider secret/tokens (Privacy)', async () => {
      mockPrismaService.paymentIntent.findUnique.mockResolvedValue({
        id: 'intent-1',
        orderGroupId: 'group-1',
        buyerId: 'user-1',
        amount: new Prisma.Decimal(100),
        currencyId: 'curr-1',
        currency: { code: 'XOF' },
        status: PaymentStatus.CREATED,
      });

      mockPrismaService.payment.findFirst.mockResolvedValue(null);
      mockPrismaService.payment.create.mockResolvedValue({
        id: 'payment-1',
        paymentIntentId: 'intent-1',
        orderGroupId: 'group-1',
        buyerId: 'user-1',
        amount: new Prisma.Decimal(100),
        currencyId: 'curr-1',
        method: PaymentMethodType.ORANGE_MONEY,
        provider: 'ORANGE',
        providerTransactionId: 'OM-SECRET-12345',
        status: PaymentStatus.PENDING,
        metadataJson: { secret: 'secret-token-123', paymentUrl: 'https://pay' },
      });
      mockPrismaService.payment.update.mockResolvedValue({
        id: 'payment-1',
        paymentIntentId: 'intent-1',
        orderGroupId: 'group-1',
        buyerId: 'user-1',
        amount: new Prisma.Decimal(100),
        currencyId: 'curr-1',
        method: PaymentMethodType.ORANGE_MONEY,
        provider: 'ORANGE',
        providerTransactionId: 'OM-SECRET-12345',
        status: PaymentStatus.PENDING,
        metadataJson: { secret: 'secret-token-123', paymentUrl: 'https://pay' },
      });

      const res: any = await paymentsService.processPayment('user-1', { paymentIntentId: 'intent-1', method: PaymentMethodType.ORANGE_MONEY }, 'idem-1', {});
      expect(res.data.providerTransactionId).toBeUndefined();
      expect(res.data.metadata.secret).toBeUndefined();
      expect(res.data.metadata.paymentUrl).toBe('https://pay');
    });
  });

  describe('2. WalletService (Decimal & Balance Checks)', () => {
    it('should reject withdraw if balance is insufficient', async () => {
      mockPrismaService.wallet.findUnique.mockResolvedValue({
        id: 'wallet-1',
        userId: 'user-1',
        balanceAvailable: new Prisma.Decimal(50),
        status: 'ACTIVE',
        currencyId: 'curr-gw',
      });
      mockPrismaService.wallet.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        walletService.withdraw('user-1', 100, 'curr-gw', 'Saque alto'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should deposit into wallet using Decimal and create double entry ledger record', async () => {
      mockPrismaService.wallet.findUnique.mockResolvedValue({
        id: 'wallet-1',
        userId: 'user-1',
        balanceAvailable: new Prisma.Decimal(100),
        status: 'ACTIVE',
        currencyId: 'curr-gw',
      });
      mockPrismaService.wallet.updateMany.mockResolvedValue({ count: 1 });
      mockPrismaService.wallet.findUniqueOrThrow.mockResolvedValue({
        id: 'wallet-1',
        userId: 'user-1',
        balanceAvailable: new Prisma.Decimal(200),
        balanceBlocked: new Prisma.Decimal(0),
        status: 'ACTIVE',
        currencyId: 'curr-gw',
      });

      const res = await walletService.deposit('user-1', 100, 'curr-gw', 'Depósito PIX');
      expect(mockPrismaService.ledgerEntry.create).toHaveBeenCalled();
    });
  });

  describe('3. LedgerService (Double-Entry Append-Only)', () => {
    it('should throw exception if debit and credit accounts are identical', async () => {
      await expect(
        ledgerService.createDoubleEntry({
          debitAccount: 'BUYER_WALLET',
          creditAccount: 'BUYER_WALLET',
          amount: 100,
          currencyId: 'curr-gw',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('4. EscrowService & RefundsService', () => {
    it('releaseEscrow should transfer funds to Seller Wallet and Platform Revenue', async () => {
      const escrowRecord: any = {
        id: 'escrow-1',
        orderId: 'order-1',
        orderGroupId: 'group-1',
        sellerId: 'seller-1',
        buyerId: 'buyer-1',
        totalAmount: new Prisma.Decimal(100),
        heldAmount: new Prisma.Decimal(100),
        releasedAmount: new Prisma.Decimal(0),
        commissionAmount: new Prisma.Decimal(10),
        status: 'HELD',
        currencyId: 'curr-gw',
        disputeDeadline: null,
        seller: { id: 'seller-1', userId: 'user-seller-1' },
        order: { id: 'order-1', status: 'DELIVERED', storeId: 'store-1' },
      };
      mockPrismaService.escrowAccount.findUnique.mockResolvedValue(escrowRecord);
      mockPrismaService.escrowAccount.findUniqueOrThrow.mockImplementation(async () => escrowRecord);
      mockPrismaService.escrowAccount.updateMany.mockImplementation(async ({ data }: any) => {
        escrowRecord.status = data.status;
        escrowRecord.heldAmount = escrowRecord.heldAmount.sub(data.heldAmount.decrement);
        escrowRecord.releasedAmount = escrowRecord.releasedAmount.add(data.releasedAmount.increment);
        return { count: 1 };
      });

      mockPrismaService.wallet.findUnique.mockResolvedValue({
        id: 'wallet-seller',
        userId: 'user-seller-1',
        currencyId: 'curr-gw',
        status: 'ACTIVE',
        balanceAvailable: new Prisma.Decimal(0),
      });
      mockPrismaService.wallet.updateMany.mockResolvedValue({ count: 1 });

      const res = await escrowService.releaseEscrow('order-1');
      expect(res.status).toBe('RELEASED');
      expect(mockPrismaService.ledgerEntry.create).toHaveBeenCalledTimes(2);
    });
  });

  describe('5. WebhooksService (Idempotency & Replay Protection)', () => {
    it('processWebhook should return cached result for duplicate eventId without re-processing', async () => {
      mockPrismaService.webhookEvent.findUnique.mockResolvedValue({
        id: 'webhook-1',
        provider: 'ORANGE',
        eventId: 'evt-dup-1',
        status: 'PROCESSED',
        resultJson: { status: 'SUCCESS' },
      });

      const res = await webhooksService.processWebhook('ORANGE', 'evt-dup-1', 'payment.captured', {}, { test: 1 });
      expect(res.alreadyProcessed).toBe(true);
      expect(mockPrismaService.webhookEvent.create).not.toHaveBeenCalled();
    });
  });
});
