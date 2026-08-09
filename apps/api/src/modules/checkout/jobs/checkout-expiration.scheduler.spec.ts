import { Queue } from 'bullmq';

import { CheckoutExpirationScheduler } from './checkout-expiration.scheduler';
import { PROCESS_EXPIRED_CHECKOUTS_JOB } from './checkout-expiration.processor';

describe('CheckoutExpirationScheduler', () => {
  const queue = {
    add: jest.fn(),
  } as unknown as Queue;

  let scheduler: CheckoutExpirationScheduler;

  beforeEach(() => {
    jest.clearAllMocks();
    scheduler = new CheckoutExpirationScheduler(queue);
  });

  it('deve registrar job repetível idempotente a cada 60 segundos', async () => {
    (queue.add as jest.Mock).mockResolvedValue({ id: 'job-1' });

    await scheduler.registerRepeatableJob();

    expect(queue.add).toHaveBeenCalledWith(
      PROCESS_EXPIRED_CHECKOUTS_JOB,
      { limit: 100 },
      expect.objectContaining({
        jobId: 'checkout-expiration-scheduler',
        repeat: { every: 60_000 },
      }),
    );
  });

  it('deve configurar cinco tentativas e backoff exponencial', async () => {
    (queue.add as jest.Mock).mockResolvedValue({ id: 'job-1' });

    await scheduler.registerRepeatableJob();

    expect(queue.add).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Object),
      expect.objectContaining({
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 3_000,
        },
      }),
    );
  });

  it('deve usar o mesmo jobId em registros repetidos', async () => {
    (queue.add as jest.Mock).mockResolvedValue({ id: 'job-1' });

    await scheduler.registerRepeatableJob();
    await scheduler.registerRepeatableJob();

    const firstOptions = (queue.add as jest.Mock).mock.calls[0][2];
    const secondOptions = (queue.add as jest.Mock).mock.calls[1][2];
    expect(firstOptions.jobId).toBe(secondOptions.jobId);
    expect(firstOptions.repeat).toEqual(secondOptions.repeat);
  });

  it('não deve derrubar o bootstrap se Redis estiver indisponível', async () => {
    (queue.add as jest.Mock).mockRejectedValue(new Error('redis unavailable'));

    await expect(scheduler.onModuleInit()).resolves.toBeUndefined();
  });
});
