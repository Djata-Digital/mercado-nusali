import { SettlementOperationalMonitorService } from './settlement-operational-monitor.service';

describe('SettlementOperationalMonitorService - Sprint 7.6.7', () => {
  it('gera alertas para stuck, failed e stale ready', async () => {
    const prisma: any = {
      sellerSettlement: {
        count: jest
          .fn()
          .mockResolvedValueOnce(2)
          .mockResolvedValueOnce(1)
          .mockResolvedValueOnce(3),
      },
    };

    const service =
      new SettlementOperationalMonitorService(prisma);

    const result = await service.scan();

    expect(result.alerts).toHaveLength(3);
    expect(result.alerts.map((x) => x.code)).toEqual(
      expect.arrayContaining([
        'STUCK_PAYOUT_PENDING',
        'FAILED_SETTLEMENTS',
        'STALE_READY_SETTLEMENTS',
      ]),
    );
  });

  it('não gera alerta quando operação está saudável', async () => {
    const prisma: any = {
      sellerSettlement: {
        count: jest.fn().mockResolvedValue(0),
      },
    };

    const service =
      new SettlementOperationalMonitorService(prisma);

    const result = await service.scan();

    expect(result.alerts).toEqual([]);
  });
});
