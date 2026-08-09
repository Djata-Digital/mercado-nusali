import { PaymentProvider, PaymentStatus } from '@prisma/client';

import { PaymentAttemptsService } from './payment-attempts.service';

describe('PaymentAttemptsService', () => {
  const service = new PaymentAttemptsService();

  it('deve iniciar a primeira tentativa em 1', async () => {
    const tx: any = {
      paymentAttempt: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(({ data }) => data),
      },
    };

    const result = await service.record(tx, {
      paymentId: 'payment-1',
      provider: PaymentProvider.ORANGE,
      status: PaymentStatus.PENDING,
      requestPayload: { operation: 'CREATE' },
      responsePayload: { success: true },
      durationMs: 18,
    });

    expect(result.attemptNumber).toBe(1);
    expect(tx.paymentAttempt.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          paymentId: 'payment-1',
          attemptNumber: 1,
          status: PaymentStatus.PENDING,
        }),
      }),
    );
  });

  it('deve incrementar attemptNumber sem sobrescrever histórico', async () => {
    const tx: any = {
      paymentAttempt: {
        findFirst: jest.fn().mockResolvedValue({ attemptNumber: 3 }),
        create: jest.fn().mockImplementation(({ data }) => data),
      },
    };

    const result = await service.record(tx, {
      paymentId: 'payment-1',
      provider: PaymentProvider.PIX_INTERNAL,
      status: PaymentStatus.CAPTURED,
    });

    expect(result.attemptNumber).toBe(4);
  });

  it('deve persistir erro do provider como tentativa FAILED', async () => {
    const tx: any = {
      paymentAttempt: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(({ data }) => data),
      },
    };

    const result = await service.record(tx, {
      paymentId: 'payment-2',
      provider: PaymentProvider.MTN,
      status: PaymentStatus.FAILED,
      errorMessage: 'gateway timeout',
      durationMs: 3000,
    });

    expect(result.errorMessage).toBe('gateway timeout');
    expect(result.status).toBe(PaymentStatus.FAILED);
  });
});
