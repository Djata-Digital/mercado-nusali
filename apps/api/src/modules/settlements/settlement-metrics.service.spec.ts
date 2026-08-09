import {
  SellerSettlementStatus,
  SettlementBatchStatus,
} from '@prisma/client';

import { SettlementMetricsService } from './settlement-metrics.service';

describe('SettlementMetricsService - Sprint 7.6.7', () => {
  it('agrega settlements, batches e alertas operacionais', async () => {
    const prisma: any = {
      sellerSettlement: {
        groupBy: jest.fn().mockResolvedValue([
          {
            status: SellerSettlementStatus.SETTLED,
            _count: { _all: 7 },
          },
          {
            status: SellerSettlementStatus.FAILED,
            _count: { _all: 2 },
          },
        ]),
        count: jest.fn().mockResolvedValue(1),
      },
      settlementBatch: {
        groupBy: jest.fn().mockResolvedValue([
          {
            status: SettlementBatchStatus.OPEN,
            _count: { _all: 3 },
          },
        ]),
      },
    };

    const service = new SettlementMetricsService(prisma);
    const result = await service.snapshot();

    expect(
      result.settlements[
        SellerSettlementStatus.SETTLED
      ],
    ).toBe(7);
    expect(
      result.settlements[
        SellerSettlementStatus.FAILED
      ],
    ).toBe(2);
    expect(
      result.batches[SettlementBatchStatus.OPEN],
    ).toBe(3);
    expect(result.alerts.stuckPayoutPending).toBe(1);
    expect(result.alerts.failedSettlements).toBe(2);
  });
});
