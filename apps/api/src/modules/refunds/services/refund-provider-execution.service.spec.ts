import { ConflictException } from '@nestjs/common';
import { PaymentProvider, PaymentStatus, Prisma, RefundStatus } from '@prisma/client';
import { PaymentGatewayException } from '../../payments/services/payment-gateway-error-classifier.service';
import { RefundProviderExecutionService } from './refund-provider-execution.service';

describe('RefundProviderExecutionService - Sprint 7.4.2', () => {
  let tx: any;
  let transaction: any;
  let provider: any;
  let factory: any;
  let timeout: any;
  let classifier: any;
  let escrow: any;
  let service: RefundProviderExecutionService;

  const payment = {
    id: 'pay-1',
    amount: new Prisma.Decimal(100),
    provider: PaymentProvider.PIX_INTERNAL,
    providerTransactionId: 'provider-payment-1',
    status: PaymentStatus.CAPTURED,
  };
  const refund = {
    id: 'refund-1', paymentId: 'pay-1', orderId: 'order-1', buyerId: 'buyer-1',
    currencyId: 'curr-1', amount: new Prisma.Decimal(40), reason: null,
    status: RefundStatus.PENDING, updatedAt: new Date(0), payment,
  };

  beforeEach(() => {
    tx = {
      refund: {
        findUnique: jest.fn(), findUniqueOrThrow: jest.fn(), updateMany: jest.fn(), aggregate: jest.fn(),
      },
      payment: { update: jest.fn() },
      outboxEvent: { create: jest.fn() },
    };
    transaction = { run: jest.fn((cb: any) => cb(tx)) };
    provider = { providerName: PaymentProvider.PIX_INTERNAL, integrationMode: 'SIMULATED', refundPayment: jest.fn() };
    factory = { getByType: jest.fn(() => provider) };
    timeout = { invoke: jest.fn(async (_p: any, op: any) => ({ result: await op(), durationMs: 1, timeoutMs: 1000 })) };
    classifier = { classify: jest.fn((e: any) => e) };
    escrow = { refundEscrow: jest.fn() };
    service = new RefundProviderExecutionService(transaction, factory, timeout, classifier, escrow);
  });

  it('deve fazer claim PENDING -> PROCESSING e chamar provider fora da transação', async () => {
    tx.refund.findUnique.mockResolvedValueOnce(refund).mockResolvedValueOnce({ ...refund, status: RefundStatus.PROCESSING });
    tx.refund.updateMany.mockResolvedValue({ count: 1 });
    tx.refund.aggregate.mockResolvedValue({ _sum: { amount: new Prisma.Decimal(0) } });
    tx.refund.findUniqueOrThrow.mockResolvedValueOnce({ ...refund, status: RefundStatus.PROCESSING })
      .mockResolvedValueOnce({ ...refund, status: RefundStatus.COMPLETED });
    provider.refundPayment.mockResolvedValue({ success: true, status: PaymentStatus.REFUNDED });
    escrow.refundEscrow.mockImplementation(async () => {
      tx.refund.findUnique.mockResolvedValue({ ...refund, status: RefundStatus.PROCESSING });
      tx.refund.aggregate.mockResolvedValue({ _sum: { amount: new Prisma.Decimal(40) } });
    });

    await service.execute('refund-1');

    expect(provider.refundPayment).toHaveBeenCalledTimes(1);
    expect(provider.refundPayment.mock.calls[0][3]).toEqual({ refundId: 'refund-1', idempotencyKey: 'refund:refund-1' });
  });

  it('deve ser idempotente quando Refund já está COMPLETED', async () => {
    tx.refund.findUnique.mockResolvedValue({ ...refund, status: RefundStatus.COMPLETED });
    const result = await service.execute('refund-1');
    expect(result.status).toBe(RefundStatus.COMPLETED);
    expect(provider.refundPayment).not.toHaveBeenCalled();
  });

  it('deve impedir segundo worker quando Refund já está PROCESSING', async () => {
    tx.refund.findUnique.mockResolvedValue({ ...refund, status: RefundStatus.PROCESSING, updatedAt: new Date() });
    await expect(service.execute('refund-1')).rejects.toBeInstanceOf(ConflictException);
    expect(provider.refundPayment).not.toHaveBeenCalled();
  });

  it('deve manter PROCESSING em timeout retryable e preservar idempotency key', async () => {
    tx.refund.findUnique.mockResolvedValueOnce(refund).mockResolvedValueOnce({ ...refund, status: RefundStatus.PROCESSING });
    tx.refund.updateMany.mockResolvedValue({ count: 1 });
    tx.refund.aggregate.mockResolvedValue({ _sum: { amount: new Prisma.Decimal(0) } });
    tx.refund.findUniqueOrThrow.mockResolvedValue({ ...refund, status: RefundStatus.PROCESSING });
    const timeoutError = new PaymentGatewayException('PAYMENT_TIMEOUT', 'timeout', true, 504);
    timeout.invoke.mockRejectedValue(timeoutError);
    classifier.classify.mockReturnValue(timeoutError);

    await expect(service.execute('refund-1')).rejects.toBe(timeoutError);
    expect(tx.refund.updateMany).toHaveBeenCalledTimes(1); // somente claim; não FAILED
    expect(tx.outboxEvent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ eventType: 'refund.pending_confirmation' }) }));
  });

  it('deve marcar FAILED em erro definitivo', async () => {
    tx.refund.findUnique.mockResolvedValueOnce(refund).mockResolvedValueOnce({ ...refund, status: RefundStatus.PROCESSING });
    tx.refund.updateMany.mockResolvedValue({ count: 1 });
    tx.refund.aggregate.mockResolvedValue({ _sum: { amount: new Prisma.Decimal(0) } });
    tx.refund.findUniqueOrThrow.mockResolvedValue({ ...refund, status: RefundStatus.PROCESSING });
    const fatal = new PaymentGatewayException('PROVIDER_RESOURCE_NOT_FOUND', 'not found', false, 502);
    timeout.invoke.mockRejectedValue(fatal);
    classifier.classify.mockReturnValue(fatal);

    await expect(service.execute('refund-1')).rejects.toBe(fatal);
    expect(tx.refund.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: RefundStatus.FAILED }) }));
  });

  it('deve derivar idempotency key estável do refundId', () => {
    expect(service.getIdempotencyKey('abc')).toBe('refund:abc');
    expect(service.getIdempotencyKey('abc')).toBe('refund:abc');
  });
});
