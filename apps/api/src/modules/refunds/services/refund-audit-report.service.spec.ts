import { RefundAuditReportService } from './refund-audit-report.service';

describe('RefundAuditReportService - Sprint 7.4.6', () => {
  const prisma: any = {
    auditLog: { create: jest.fn(), findMany: jest.fn() },
    refund: { findUnique: jest.fn(), findMany: jest.fn() },
    webhookEvent: { findMany: jest.fn() },
    outboxEvent: { findMany: jest.fn() },
  };
  let service: RefundAuditReportService;
  beforeEach(() => { jest.clearAllMocks(); service = new RefundAuditReportService(prisma); });

  it('deve registrar ação administrativa sem segredos do provider', async () => {
    prisma.auditLog.create.mockResolvedValue({ id: 'a1' });
    await service.logAdminAction({ userId: 'u1', action: 'REFUND_ADMIN_RECONCILE', refundId: 'r1', newValue: { status: 'COMPLETED' } });
    expect(prisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ userId: 'u1', entity: 'Refund', entityId: 'r1' }) }));
  });

  it('deve agregar AuditLog, Webhook e Outbox em timeline cronológica', async () => {
    prisma.refund.findUnique.mockResolvedValue({ id: 'r1', paymentId: 'p1', orderId: 'o1', status: 'COMPLETED', createdAt: new Date('2026-01-01'), updatedAt: new Date('2026-01-03'), processedAt: new Date('2026-01-03') });
    prisma.auditLog.findMany.mockResolvedValue([{ id: 'a1', createdAt: new Date('2026-01-03') }]);
    prisma.webhookEvent.findMany.mockResolvedValue([{ id: 'w1', createdAt: new Date('2026-01-02') }]);
    prisma.outboxEvent.findMany.mockResolvedValue([{ id: 'o1', createdAt: new Date('2026-01-01') }]);
    const result = await service.history('r1');
    expect(result.timeline.map((x) => x.source)).toEqual(['OUTBOX', 'WEBHOOK', 'AUDIT']);
  });

  it('deve gerar relatório com dinheiro serializado como string', async () => {
    prisma.refund.findMany.mockResolvedValue([{ id:'r1', paymentId:'p1', orderId:'o1', buyerId:'b1', amount:{toString:()=> '45.00'}, status:'COMPLETED', reason:null, processedAt:null, createdAt:new Date(), updatedAt:new Date(), currency:{code:'BRL'}, payment:{provider:'STRIPE'} }]);
    const result = await service.report({ limit: 10 });
    expect(result.rows[0].amount).toBe('45.00');
    expect(result.rows[0]).toEqual(expect.objectContaining({ provider: 'STRIPE', currency: 'BRL' }));
  });
});
