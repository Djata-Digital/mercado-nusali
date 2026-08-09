import { SettlementReadinessService } from './settlement-readiness.service';

describe('SettlementReadinessService - Sprint 7.6.7', () => {
  function build() {
    const prisma: any = {
      $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
      sellerSettlement: {
        count: jest.fn(),
      },
      settlementBatch: {
        count: jest.fn(),
      },
    };

    return {
      prisma,
      service: new SettlementReadinessService(prisma),
    };
  }

  it('fica ready quando banco e settlements estão saudáveis', async () => {
    const { prisma, service } = build();

    prisma.sellerSettlement.count
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);
    prisma.settlementBatch.count.mockResolvedValue(1);

    const result = await service.status();

    expect(result.ready).toBe(true);
    expect(result.reasons).toEqual([]);
  });

  it('fica not-ready quando há PAYOUT_PENDING preso', async () => {
    const { prisma, service } = build();

    prisma.sellerSettlement.count
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);
    prisma.settlementBatch.count.mockResolvedValue(0);

    const result = await service.status();

    expect(result.ready).toBe(false);
    expect(result.reasons).toContain(
      'STUCK_PAYOUT_PENDING',
    );
    expect(result.counters.stuckPayoutPending).toBe(2);
  });

  it('fica not-ready quando PostgreSQL não responde', async () => {
    const { prisma, service } = build();

    prisma.$queryRaw.mockRejectedValue(
      new Error('postgres unavailable'),
    );
    prisma.sellerSettlement.count.mockResolvedValue(0);
    prisma.settlementBatch.count.mockResolvedValue(0);

    const result = await service.status();

    expect(result.ready).toBe(false);
    expect(result.reasons).toContain(
      'DATABASE_UNAVAILABLE',
    );
  });
});
