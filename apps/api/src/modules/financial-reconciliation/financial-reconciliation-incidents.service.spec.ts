import { FinancialReconciliationIncidentStatus } from '@prisma/client';
import { FinancialReconciliationIncidentsService } from './financial-reconciliation-incidents.service';

describe('FinancialReconciliationIncidentsService - Sprint 7.5.3', () => {
  const prisma: any = { financialReconciliationIncident: {
    upsert: jest.fn(), updateMany: jest.fn(), findMany: jest.fn(),
    findUnique: jest.fn(), update: jest.fn(), groupBy: jest.fn(),
  }};
  const reconciliation: any = { reconcileOrderGroup: jest.fn() };
  let service: FinancialReconciliationIncidentsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new FinancialReconciliationIncidentsService(prisma, reconciliation);
  });

  it('persiste divergência com fingerprint idempotente', async () => {
    reconciliation.reconcileOrderGroup.mockResolvedValue({
      healthy:false, issueCount:1,
      payments:[{paymentId:'pay-1',issues:[{
        code:'REFUND_EXCEEDS_PAYMENT', expected:'100.00', actual:'120.00'
      }]}],
    });
    prisma.financialReconciliationIncident.upsert.mockResolvedValue({});
    prisma.financialReconciliationIncident.updateMany.mockResolvedValue({count:0});
    const result=await service.reconcileAndPersistOrderGroup('og-1');
    expect(result.persistedIncidentCount).toBe(1);
    expect(prisma.financialReconciliationIncident.upsert).toHaveBeenCalledTimes(1);
  });

  it('auto-resolve incidentes que desapareceram', async () => {
    reconciliation.reconcileOrderGroup.mockResolvedValue({healthy:true,issueCount:0,payments:[]});
    prisma.financialReconciliationIncident.updateMany.mockResolvedValue({count:1});
    await service.reconcileAndPersistOrderGroup('og-1');
    expect(prisma.financialReconciliationIncident.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({data:expect.objectContaining({
        status:FinancialReconciliationIncidentStatus.RESOLVED
      })})
    );
  });

  it('acknowledge registra o ator', async () => {
    prisma.financialReconciliationIncident.findUnique.mockResolvedValue({id:'i1'});
    prisma.financialReconciliationIncident.update.mockResolvedValue({status:'ACKNOWLEDGED'});
    await service.acknowledge('i1','admin-1');
    expect(prisma.financialReconciliationIncident.update).toHaveBeenCalledWith(
      expect.objectContaining({data:expect.objectContaining({acknowledgedBy:'admin-1'})})
    );
  });

  it('resolve registra ator e nota', async () => {
    prisma.financialReconciliationIncident.findUnique.mockResolvedValue({id:'i1'});
    prisma.financialReconciliationIncident.update.mockResolvedValue({status:'RESOLVED'});
    await service.resolve('i1','admin-1','corrigido');
    expect(prisma.financialReconciliationIncident.update).toHaveBeenCalledWith(
      expect.objectContaining({data:expect.objectContaining({
        resolvedBy:'admin-1',resolutionNote:'corrigido'
      })})
    );
  });

  it('limita listagem a 500', async () => {
    prisma.financialReconciliationIncident.findMany.mockResolvedValue([]);
    await service.list(9999);
    expect(prisma.financialReconciliationIncident.findMany)
      .toHaveBeenCalledWith(expect.objectContaining({take:500}));
  });
});
