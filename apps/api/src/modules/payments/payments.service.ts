import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  OrderGroupStatus,
  OrderStatus,
  PaymentMethodType,
  PaymentProvider,
  PaymentStatus,
  Prisma,
} from '@prisma/client';

import { sanitizeForJson, serializeDecimal } from '../../common/utils/decimal.util';
import { EscrowService } from '../escrow/escrow.service';
import { IdempotencyService } from '../idempotency/idempotency.service';
import { PrismaService } from '../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import { ProcessPaymentDto } from './dto/payment.dto';
import { PaymentIntentsService } from './payment-intents.service';
import { PaymentProviderFactory } from './providers/payment-provider.factory';
import { PaymentProviderResult } from './providers/payment-provider.interface';
import { PaymentAttemptsService } from './services/payment-attempts.service';
import { PaymentCircuitBreakerService } from './services/payment-circuit-breaker.service';
import { PaymentLogSanitizerService } from './services/payment-log-sanitizer.service';
import { PaymentProviderValidatorService } from './services/payment-provider-validator.service';
import { PaymentEventsService } from './services/payment-events.service';
import { PaymentGatewayErrorClassifierService } from './services/payment-gateway-error-classifier.service';
import {
  PaymentProviderInvocation,
  PaymentProviderTimeoutService,
} from './services/payment-provider-timeout.service';
import { PaymentTransactionService } from './services/payment-transaction.service';
import { PaymentStateMachineService } from './state-machine/payment-state-machine.service';

/**
 * PaymentsService
 *
 * Application service do agregado Payment.
 *
 * Responsabilidades:
 * - coordenar Idempotency, Providers, PaymentIntent, Wallet e Escrow;
 * - executar alterações financeiras críticas por PaymentTransactionService;
 * - delegar toda mudança de Payment.status ao PaymentStateMachineService;
 * - persistir tentativas de provedor e eventos Outbox de forma padronizada;
 * - nunca manter uma transação PostgreSQL aberta durante chamada externa ao provider.
 */
@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly idempotencyService: IdempotencyService,
    private readonly paymentIntentsService: PaymentIntentsService,
    private readonly escrowService: EscrowService,
    private readonly walletService: WalletService,
    private readonly paymentStateMachine: PaymentStateMachineService,
    private readonly paymentTransaction: PaymentTransactionService,
    private readonly paymentAttempts: PaymentAttemptsService,
    private readonly paymentEvents: PaymentEventsService,
    private readonly paymentProviderFactory: PaymentProviderFactory,
    private readonly paymentGatewayErrorClassifier: PaymentGatewayErrorClassifierService,
    private readonly paymentProviderTimeout: PaymentProviderTimeoutService,
    private readonly paymentCircuitBreaker: PaymentCircuitBreakerService,
    private readonly paymentLogSanitizer: PaymentLogSanitizerService,
    private readonly paymentProviderValidator: PaymentProviderValidatorService,
  ) {}

  async processPayment(
    userId: string,
    dto: ProcessPaymentDto,
    idempotencyKeyHeader: string,
    reqInfo: unknown,
  ) {
    void reqInfo;

    if (idempotencyKeyHeader) {
      const idemCheck = await this.idempotencyService.startOrGet(
        userId,
        'payment-process',
        idempotencyKeyHeader,
        dto,
      );
      if (idemCheck.isCached) return idemCheck.data;
    }

    try {
      const intent = await this.paymentIntentsService.getIntentById(
        userId,
        dto.paymentIntentId,
      );

      if (intent.status === PaymentStatus.CAPTURED) {
        throw new BadRequestException(
          'Esta intenção de pagamento já foi capturada e concluída.',
          'PAYMENT_ALREADY_CAPTURED',
        );
      }

      const existingCaptured = await this.prisma.payment.findFirst({
        where: {
          paymentIntentId: intent.id,
          status: PaymentStatus.CAPTURED,
        },
      });
      if (existingCaptured) {
        throw new ConflictException(
          'Já existe um pagamento capturado para este pedido.',
        );
      }

      const { providerType, provider } =
        this.paymentProviderFactory.resolveByMethod(dto.method);

      // Primeiro persistimos o agregado. A chamada ao gateway acontece somente
      // após o commit, evitando manter locks do banco durante I/O externo.
      const payment = await this.paymentTransaction.run(async (tx) => {
        const created = await tx.payment.create({
          data: {
            paymentIntentId: intent.id,
            orderGroupId: intent.orderGroupId,
            buyerId: userId,
            amount: intent.amount,
            currencyId: intent.currencyId,
            method: dto.method,
            provider: providerType,
            status: PaymentStatus.PENDING,
            expiresAt: new Date(Date.now() + 30 * 60 * 1000),
            metadataJson: dto.metadata
              ? sanitizeForJson(dto.metadata)
              : undefined,
          },
        });

        await this.paymentEvents.recordCreated(tx, created);
        return created;
      });

      let providerInvocation: PaymentProviderInvocation<PaymentProviderResult>;
      try {
        providerInvocation = await this.invokeProvider(provider, () =>
          provider.createPayment(
            payment.id,
            payment.amount,
            intent.currency.code,
            dto.method,
            dto.metadata,
          ),
        );
      } catch (error: unknown) {
        const classifiedError = this.paymentGatewayErrorClassifier.classify(error);
        await this.recordProviderFailure({
          paymentId: payment.id,
          paymentIntentId: intent.id,
          provider: providerType,
          requestPayload: {
            operation: 'CREATE',
            method: dto.method,
            amount: serializeDecimal(intent.amount),
          },
          error: classifiedError,
        });
        throw classifiedError;
      }

      const initializedPayment = await this.applyProviderInitialization({
        paymentId: payment.id,
        paymentIntentId: intent.id,
        provider: providerType,
        method: dto.method,
        amount: intent.amount,
        providerResult: providerInvocation.result,
        durationMs: providerInvocation.durationMs,
      });

      // Wallet e Card são fluxos instantâneos no provider simulado atual.
      // CAPTURED retornado pelo Wallet é normalizado para AUTHORIZED antes
      // desta etapa, pois CAPTURED só pode ocorrer junto dos efeitos de Escrow.
      let finalPayment = initializedPayment;
      if (
        dto.method === PaymentMethodType.NUSALI_WALLET ||
        dto.method === PaymentMethodType.CARD
      ) {
        finalPayment = await this.capturePaymentInternal(payment.id, userId);
      }

      const responsePayload = {
        success: true,
        data: this.sanitizePaymentForBuyer(finalPayment),
      };

      if (idempotencyKeyHeader) {
        await this.idempotencyService.complete(
          userId,
          'payment-process',
          idempotencyKeyHeader,
          responsePayload,
          201,
        );
      }

      return responsePayload;
    } catch (error: unknown) {
      if (idempotencyKeyHeader) {
        await this.idempotencyService.fail(
          userId,
          'payment-process',
          idempotencyKeyHeader,
        );
      }
      throw error;
    }
  }

  async capturePayment(
    userId: string,
    paymentId: string,
    idempotencyKeyHeader: string,
    reqInfo: unknown,
  ) {
    void reqInfo;

    if (idempotencyKeyHeader) {
      const idemCheck = await this.idempotencyService.startOrGet(
        userId,
        'payment-capture',
        idempotencyKeyHeader,
        { paymentId },
      );
      if (idemCheck.isCached) return idemCheck.data;
    }

    try {
      const capturedPayment = await this.capturePaymentInternal(
        paymentId,
        userId,
      );
      const responsePayload = {
        success: true,
        data: this.sanitizePaymentForBuyer(capturedPayment),
      };

      if (idempotencyKeyHeader) {
        await this.idempotencyService.complete(
          userId,
          'payment-capture',
          idempotencyKeyHeader,
          responsePayload,
          200,
        );
      }

      return responsePayload;
    } catch (error: unknown) {
      if (idempotencyKeyHeader) {
        await this.idempotencyService.fail(
          userId,
          'payment-capture',
          idempotencyKeyHeader,
        );
      }
      throw error;
    }
  }

  /**
   * Cancelamento preparado para uso futuro pelo controller/webhook.
   * O claim PROCESSING impede que cancelamento e captura concorrentes avancem
   * simultaneamente sobre o mesmo Payment.
   */
  async cancelPayment(
    userId: string,
    paymentId: string,
    idempotencyKeyHeader = '',
  ) {
    if (idempotencyKeyHeader) {
      const idemCheck = await this.idempotencyService.startOrGet(
        userId,
        'payment-cancel',
        idempotencyKeyHeader,
        { paymentId },
      );
      if (idemCheck.isCached) return idemCheck.data;
    }

    try {
      const prepared = await this.prepareProviderOperation(
        paymentId,
        userId,
        'CANCEL',
      );

      if (prepared.status === PaymentStatus.CANCELLED) {
        return { success: true, data: this.sanitizePaymentForBuyer(prepared) };
      }

      const provider = this.paymentProviderFactory.getByType(prepared.provider);
      let invocation: PaymentProviderInvocation<PaymentProviderResult>;

      try {
        invocation = await this.invokeProvider(provider, () =>
          provider.cancelPayment(
            prepared.id,
            prepared.providerTransactionId ?? undefined,
          ),
        );
      } catch (error: unknown) {
        const classifiedError = this.paymentGatewayErrorClassifier.classify(error);
        await this.recordProviderFailure({
          paymentId: prepared.id,
          paymentIntentId: prepared.paymentIntentId,
          provider: prepared.provider,
          requestPayload: { operation: 'CANCEL' },
          error: classifiedError,
        });
        throw classifiedError;
      }

      const cancelled = await this.paymentTransaction.run(async (tx) => {
        await this.paymentAttempts.record(tx, {
          paymentId: prepared.id,
          provider: prepared.provider,
          status: invocation.result.status,
          requestPayload: { operation: 'CANCEL' },
          responsePayload: this.paymentLogSanitizer.sanitize(invocation.result),
          durationMs: invocation.durationMs,
          errorMessage: invocation.result.errorMessage
            ? this.paymentLogSanitizer.sanitizeText(invocation.result.errorMessage)
            : undefined,
        });

        if (
          !invocation.result.success ||
          invocation.result.status !== PaymentStatus.CANCELLED
        ) {
          const failed = await this.paymentStateMachine.transition(tx, {
            paymentId: prepared.id,
            toStatus: PaymentStatus.FAILED,
            eventType: 'PAYMENT_CANCEL_FAILED',
            payload: this.paymentLogSanitizer.sanitize(invocation.result),
          });
          await this.paymentEvents.recordStatusEvent(
            tx,
            prepared.id,
            PaymentStatus.FAILED,
            { operation: 'CANCEL' },
          );
          return failed;
        }

        const transitioned = await this.paymentStateMachine.transition(tx, {
          paymentId: prepared.id,
          toStatus: PaymentStatus.CANCELLED,
          eventType: 'PAYMENT_CANCELLED',
          payload: this.paymentLogSanitizer.sanitize(invocation.result),
        });

        await tx.paymentIntent.update({
          where: { id: prepared.paymentIntentId },
          data: { status: PaymentStatus.CANCELLED },
        });

        await this.paymentEvents.recordStatusEvent(
          tx,
          prepared.id,
          PaymentStatus.CANCELLED,
          { operation: 'CANCEL' },
        );
        return transitioned;
      });

      const response = {
        success: true,
        data: this.sanitizePaymentForBuyer(cancelled),
      };

      if (idempotencyKeyHeader) {
        await this.idempotencyService.complete(
          userId,
          'payment-cancel',
          idempotencyKeyHeader,
          response,
          200,
        );
      }
      return response;
    } catch (error: unknown) {
      if (idempotencyKeyHeader) {
        await this.idempotencyService.fail(
          userId,
          'payment-cancel',
          idempotencyKeyHeader,
        );
      }
      throw error;
    }
  }

  /** Expiração operacional sem qualquer movimentação financeira. */
  async expirePayment(paymentId: string) {
    return this.paymentTransaction.run(async (tx) => {
      const payment = await tx.payment.findUnique({ where: { id: paymentId } });
      if (!payment) throw new NotFoundException('Pagamento não encontrado.');
      if (payment.status === PaymentStatus.EXPIRED) return payment;

      const expired = await this.paymentStateMachine.transition(tx, {
        paymentId,
        toStatus: PaymentStatus.EXPIRED,
        eventType: 'PAYMENT_EXPIRED',
      });

      await tx.paymentIntent.update({
        where: { id: payment.paymentIntentId },
        data: { status: PaymentStatus.EXPIRED },
      });
      await this.paymentEvents.recordStatusEvent(
        tx,
        paymentId,
        PaymentStatus.EXPIRED,
      );
      return expired;
    });
  }

  private async applyProviderInitialization(input: {
    paymentId: string;
    paymentIntentId: string;
    provider: PaymentProvider;
    method: PaymentMethodType;
    amount: Prisma.Decimal;
    providerResult: PaymentProviderResult;
    durationMs: number;
  }) {
    return this.paymentTransaction.run(async (tx) => {
      const updatedWithProvider = await tx.payment.update({
        where: { id: input.paymentId },
        data: {
          providerReference: input.providerResult.providerReference,
          providerTransactionId: input.providerResult.providerTransactionId,
          metadataJson: input.providerResult.metadata
            ? sanitizeForJson(
                this.paymentLogSanitizer.sanitize(input.providerResult.metadata),
              )
            : undefined,
        },
      });

      const attemptStatus = input.providerResult.success
        ? input.providerResult.status
        : PaymentStatus.FAILED;

      await this.paymentAttempts.record(tx, {
        paymentId: updatedWithProvider.id,
        provider: input.provider,
        status: attemptStatus,
        requestPayload: {
          operation: 'CREATE',
          method: input.method,
          amount: serializeDecimal(input.amount),
        },
        responsePayload: this.paymentLogSanitizer.sanitize(input.providerResult),
        durationMs: input.durationMs,
        errorMessage: input.providerResult.errorMessage
          ? this.paymentLogSanitizer.sanitizeText(input.providerResult.errorMessage)
          : undefined,
      });

      // CAPTURED do Wallet significa que o provider aceitou a transferência.
      // O Payment só fica CAPTURED após Wallet + Escrow + Orders concluírem.
      const targetStatus = !input.providerResult.success
        ? PaymentStatus.FAILED
        : input.providerResult.status === PaymentStatus.CAPTURED
          ? PaymentStatus.AUTHORIZED
          : input.providerResult.status;

      let updated = updatedWithProvider;

      if (targetStatus !== updated.status) {
        updated = await this.paymentStateMachine.transition(tx, {
          paymentId: updatedWithProvider.id,
          toStatus: targetStatus,
          eventType: `PAYMENT_PROVIDER_${targetStatus}`,
          payload: this.paymentLogSanitizer.sanitize(input.providerResult),
        });
      }

      await tx.paymentIntent.update({
        where: { id: input.paymentIntentId },
        data: { status: targetStatus },
      });

      await this.paymentEvents.recordStatusEvent(
        tx,
        updatedWithProvider.id,
        targetStatus,
        { provider: input.provider },
      );

      return updated;
    });
  }

  /**
   * Captura em duas fases:
   * 1) claim atômico para PROCESSING;
   * 2) chamada ao provider fora da transação;
   * 3) efeitos financeiros e CAPTURED em uma transação Serializable.
   */
  private async capturePaymentInternal(paymentId: string, userId: string) {
    const prepared = await this.prepareProviderOperation(
      paymentId,
      userId,
      'CAPTURE',
    );

    if (prepared.status === PaymentStatus.CAPTURED) return prepared;

    const provider = this.paymentProviderFactory.getByType(prepared.provider);
    let invocation: PaymentProviderInvocation<PaymentProviderResult>;

    try {
      invocation = await this.invokeProvider(provider, () =>
        provider.capturePayment(
          prepared.id,
          prepared.providerTransactionId ?? undefined,
        ),
      );
    } catch (error: unknown) {
      const classifiedError = this.paymentGatewayErrorClassifier.classify(error);
      await this.recordProviderFailure({
        paymentId: prepared.id,
        paymentIntentId: prepared.paymentIntentId,
        provider: prepared.provider,
        requestPayload: { operation: 'CAPTURE' },
        error: classifiedError,
      });
      throw classifiedError;
    }

    if (
      !invocation.result.success ||
      invocation.result.status !== PaymentStatus.CAPTURED
    ) {
      await this.paymentTransaction.run(async (tx) => {
        await this.paymentAttempts.record(tx, {
          paymentId: prepared.id,
          provider: prepared.provider,
          status: invocation.result.status,
          requestPayload: { operation: 'CAPTURE' },
          responsePayload: this.paymentLogSanitizer.sanitize(invocation.result),
          durationMs: invocation.durationMs,
          errorMessage: invocation.result.errorMessage
            ? this.paymentLogSanitizer.sanitizeText(invocation.result.errorMessage)
            : undefined,
        });

        const target = invocation.result.success
          ? invocation.result.status
          : PaymentStatus.FAILED;
        await this.paymentStateMachine.transition(tx, {
          paymentId: prepared.id,
          toStatus: target,
          eventType: 'PAYMENT_CAPTURE_NOT_COMPLETED',
          payload: this.paymentLogSanitizer.sanitize(invocation.result),
        });
        await tx.paymentIntent.update({
          where: { id: prepared.paymentIntentId },
          data: { status: target },
        });
        await this.paymentEvents.recordStatusEvent(tx, prepared.id, target, {
          operation: 'CAPTURE',
        });
      });

      throw new BadRequestException({
        statusCode: 400,
        message: 'O provedor não confirmou a captura do pagamento.',
        errorCode: 'PAYMENT_CAPTURE_NOT_CONFIRMED',
      });
    }

    return this.paymentTransaction.run(async (tx) => {
      const payment = await tx.payment.findUnique({
        where: { id: prepared.id },
        include: {
          orderGroup: {
            include: {
              orders: { include: { items: true, store: true, seller: true } },
              currency: true,
            },
          },
        },
      });

      if (!payment) throw new NotFoundException('Pagamento não encontrado.');
      if (payment.status === PaymentStatus.CAPTURED) return payment;
      if (payment.status !== PaymentStatus.PROCESSING) {
        throw new ConflictException({
          statusCode: 409,
          message: 'O pagamento não está mais disponível para captura.',
          errorCode: 'PAYMENT_CAPTURE_STATE_CHANGED',
        });
      }

      const otherCaptured = await tx.payment.findFirst({
        where: {
          orderGroupId: payment.orderGroupId,
          status: PaymentStatus.CAPTURED,
          id: { not: payment.id },
        },
      });
      if (otherCaptured) {
        throw new ConflictException(
          'Já existe outro pagamento capturado com sucesso para este pedido.',
        );
      }

      await this.paymentAttempts.record(tx, {
        paymentId: payment.id,
        provider: payment.provider,
        status: PaymentStatus.CAPTURED,
        requestPayload: { operation: 'CAPTURE' },
        responsePayload: this.paymentLogSanitizer.sanitize(invocation.result),
        durationMs: invocation.durationMs,
      });

      // Wallet precisa ser debitada no mesmo commit do Escrow e dos pedidos.
      if (payment.method === PaymentMethodType.NUSALI_WALLET) {
        await this.walletService.withdraw(
          payment.buyerId,
          payment.amount,
          payment.currencyId,
          `Pagamento do pedido ${payment.orderGroupId}`,
          tx,
        );
      }

      const splitOrders: Array<Record<string, unknown>> = [];
      const commissionRate = 0.1;

      for (const order of payment.orderGroup.orders) {
        const commission = order.subtotal
          .mul(commissionRate)
          .toDecimalPlaces(2);
        const netSellerAmount = order.total.sub(commission);

        splitOrders.push({
          orderId: order.id,
          orderNumber: order.orderNumber,
          storeId: order.storeId,
          sellerId: order.sellerId,
          subtotal: serializeDecimal(order.subtotal),
          shippingAmount: serializeDecimal(order.shippingAmount),
          discountAmount: serializeDecimal(order.discountAmount),
          taxAmount: serializeDecimal(order.estimatedTaxAmount),
          platformCommission: serializeDecimal(commission),
          sellerNetAmount: serializeDecimal(netSellerAmount),
          totalEscrow: serializeDecimal(order.total),
        });

        await this.escrowService.holdEscrow(
          {
            orderGroupId: payment.orderGroupId,
            orderId: order.id,
            sellerId: order.sellerId,
            buyerId: payment.buyerId,
            totalAmount: order.total,
            commissionRate,
            currencyId: payment.currencyId,
          },
          tx,
        );

        const orderUpdated = await tx.order.updateMany({
          where: {
            id: order.id,
            status: OrderStatus.PENDING_PAYMENT,
          },
          data: { status: OrderStatus.PAID },
        });

        if (orderUpdated.count === 1) {
          await tx.orderStatusHistory.create({
            data: {
              orderId: order.id,
              previousStatus: order.status,
              newStatus: OrderStatus.PAID,
              reason: 'Pagamento capturado com sucesso',
            },
          });
        }
      }

      const splitSnapshot = {
        capturedAt: new Date().toISOString(),
        currencyCode: payment.orderGroup.currency.code,
        totalAmount: serializeDecimal(payment.amount),
        ordersSplit: splitOrders,
      };

      await this.paymentStateMachine.transition(tx, {
        paymentId: payment.id,
        toStatus: PaymentStatus.CAPTURED,
        eventType: 'PAYMENT_CAPTURED',
        payload: splitSnapshot,
      });

      const capturedPayment = await tx.payment.update({
        where: { id: payment.id },
        data: {
          paidAt: new Date(),
          splitSnapshotJson: sanitizeForJson(splitSnapshot),
        },
      });

      await tx.paymentIntent.update({
        where: { id: payment.paymentIntentId },
        data: { status: PaymentStatus.CAPTURED },
      });

      await tx.orderGroup.updateMany({
        where: {
          id: payment.orderGroupId,
          status: OrderGroupStatus.PENDING_PAYMENT,
        },
        data: { status: OrderGroupStatus.PAID },
      });

      await this.paymentEvents.recordStatusEvent(
        tx,
        payment.id,
        PaymentStatus.CAPTURED,
        {
          orderGroupId: payment.orderGroupId,
          amount: payment.amount,
        },
      );

      return capturedPayment;
    });
  }

  private async prepareProviderOperation(
    paymentId: string,
    userId: string,
    operation: 'CAPTURE' | 'CANCEL',
  ) {
    return this.paymentTransaction.run(async (tx) => {
      const payment = await tx.payment.findUnique({ where: { id: paymentId } });
      if (!payment) throw new NotFoundException('Pagamento não encontrado.');

      // capture:manage poderá no futuro usar escopo administrativo. Neste
      // estágio mantemos compatibilidade com o comportamento antigo e apenas
      // aplicamos ownership no cancelamento orientado ao comprador.
      if (operation === 'CANCEL' && payment.buyerId !== userId) {
        throw new ForbiddenException('Acesso negado.');
      }

      if (operation === 'CAPTURE' && payment.status === PaymentStatus.CAPTURED) {
        return payment;
      }
      if (operation === 'CANCEL' && payment.status === PaymentStatus.CANCELLED) {
        return payment;
      }

      if (payment.status === PaymentStatus.PROCESSING) {
        throw new ConflictException({
          statusCode: 409,
          message: 'Já existe uma operação em andamento para este pagamento.',
          errorCode: 'PAYMENT_OPERATION_IN_PROGRESS',
        });
      }

      const otherCaptured = await tx.payment.findFirst({
        where: {
          orderGroupId: payment.orderGroupId,
          status: PaymentStatus.CAPTURED,
          id: { not: payment.id },
        },
      });
      if (operation === 'CAPTURE' && otherCaptured) {
        throw new ConflictException(
          'Já existe outro pagamento capturado com sucesso para este pedido.',
        );
      }

      const processing = await this.paymentStateMachine.transition(tx, {
        paymentId: payment.id,
        toStatus: PaymentStatus.PROCESSING,
        eventType: `PAYMENT_${operation}_STARTED`,
        payload: { operation },
      });

      await this.paymentEvents.recordStatusEvent(
        tx,
        payment.id,
        PaymentStatus.PROCESSING,
        { operation },
      );
      return processing;
    });
  }

  /**
   * Camada única de resiliência do provider. O erro é classificado antes de
   * chegar ao Circuit Breaker para que apenas falhas retryable contem para
   * abertura do circuito. O catch externo pode classificar novamente com
   * segurança, pois PaymentGatewayException é idempotente no classifier.
   */
  private async invokeProvider<T>(
    provider: Parameters<PaymentProviderTimeoutService['invoke']>[0],
    operation: () => Promise<T>,
  ): Promise<PaymentProviderInvocation<T>> {
    this.paymentProviderValidator.assertEnabled(provider.providerName);

    return this.paymentCircuitBreaker.execute(provider.providerName, async () => {
      try {
        return await this.paymentProviderTimeout.invoke(provider, operation);
      } catch (error: unknown) {
        throw this.paymentGatewayErrorClassifier.classify(error);
      }
    });
  }

  private async recordProviderFailure(input: {
    paymentId: string;
    paymentIntentId: string;
    provider: PaymentProvider;
    requestPayload: unknown;
    error: unknown;
  }) {
    await this.paymentTransaction.run(async (tx) => {
      const current = await tx.payment.findUnique({
        where: { id: input.paymentId },
      });
      if (!current || current.status === PaymentStatus.CAPTURED) return;

      const message =
        input.error instanceof Error
          ? input.error.message
          : 'Erro desconhecido no provedor de pagamento.';

      await this.paymentAttempts.record(tx, {
        paymentId: input.paymentId,
        provider: input.provider,
        status: PaymentStatus.FAILED,
        requestPayload: this.paymentLogSanitizer.sanitize(input.requestPayload),
        errorMessage: this.paymentLogSanitizer.sanitizeText(message),
      });

      let failed = current;
      if (current.status !== PaymentStatus.FAILED) {
        failed = await this.paymentStateMachine.transition(tx, {
          paymentId: input.paymentId,
          toStatus: PaymentStatus.FAILED,
          eventType: 'PAYMENT_PROVIDER_FAILED',
          payload: { message: this.paymentLogSanitizer.sanitizeText(message) },
        });
      }

      await tx.paymentIntent.update({
        where: { id: input.paymentIntentId },
        data: { status: PaymentStatus.FAILED },
      });
      await this.paymentEvents.recordStatusEvent(
        tx,
        input.paymentId,
        PaymentStatus.FAILED,
        { message: this.paymentLogSanitizer.sanitizeText(message) },
      );
      return failed;
    });
  }

  async getPaymentById(userId: string, paymentId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { currency: true, attempts: true, events: true },
    });

    if (!payment) throw new NotFoundException('Pagamento não encontrado.');
    if (payment.buyerId !== userId)
      throw new ForbiddenException('Acesso negado.');

    return this.sanitizePaymentForBuyer(payment);
  }


  /** Sanitização de dados de privacidade para o comprador. */
  private sanitizePaymentForBuyer(payment: any) {
    const {
      providerTransactionId,
      providerReference,
      metadataJson,
      ...buyerFacing
    } = payment;
    const sanitizedMetadata = metadataJson ? { ...metadataJson } : {};
    delete sanitizedMetadata.secret;
    delete sanitizedMetadata.token;
    delete sanitizedMetadata.signature;

    return {
      ...buyerFacing,
      metadata: sanitizedMetadata,
    };
  }
}
