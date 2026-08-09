import { Job } from 'bullmq';

import {
  CheckoutExpirationJobData,
  CheckoutExpirationProcessor,
} from './checkout-expiration.processor';

describe('CheckoutExpirationProcessor', () => {
  const expirationService = {
    processExpiredSessions: jest.fn(),
  };

  let processor: CheckoutExpirationProcessor;

  beforeEach(() => {
    jest.clearAllMocks();
    processor = new CheckoutExpirationProcessor(expirationService as any);
  });

  it('deve delegar a regra de negócio ao CheckoutExpirationService', async () => {
    expirationService.processExpiredSessions.mockResolvedValue(7);

    const result = await processor.process({
      id: 'job-1',
      name: 'process-expired-checkouts',
      data: { limit: 50 },
    } as unknown as Job<CheckoutExpirationJobData>);

    expect(expirationService.processExpiredSessions).toHaveBeenCalledWith(50);
    expect(result.processed).toBe(7);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('deve usar lote padrão de 100 quando limit não for informado', async () => {
    expirationService.processExpiredSessions.mockResolvedValue(0);

    await processor.process({
      id: 'job-2',
      name: 'process-expired-checkouts',
      data: {},
    } as unknown as Job<CheckoutExpirationJobData>);

    expect(expirationService.processExpiredSessions).toHaveBeenCalledWith(100);
  });

  it('deve limitar lotes excessivos a 500', async () => {
    expirationService.processExpiredSessions.mockResolvedValue(0);

    await processor.process({
      id: 'job-3',
      name: 'process-expired-checkouts',
      data: { limit: 10_000 },
    } as unknown as Job<CheckoutExpirationJobData>);

    expect(expirationService.processExpiredSessions).toHaveBeenCalledWith(500);
  });

  it('deve propagar exceções para permitir retry/backoff do BullMQ', async () => {
    expirationService.processExpiredSessions.mockRejectedValue(
      new Error('database unavailable'),
    );

    await expect(
      processor.process({
        id: 'job-4',
        name: 'process-expired-checkouts',
        data: { limit: 100 },
      } as unknown as Job<CheckoutExpirationJobData>),
    ).rejects.toThrow('database unavailable');
  });
});
