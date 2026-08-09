import { RefundStatus, WebhookStatus } from '@prisma/client';
import { RefundOperationsService } from './refund-operations.service';

describe('RefundOperationsService - Sprint 7.4.4', () => {
  function build() {
    const prisma: any = {
      refund: {
        count: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
      webhookEvent: {
        count: jest.fn(),
        findMany: jest.fn(),
      },
    };
    const reconciliation: any = {
      inspect: jest.fn(),
      reconcileStaleProcessing: jest.fn(),
    };
    const execution: any = { reconcile: jest.fn() };
    const service = new RefundOperationsService(
      prisma,
      reconciliation,
      execution,
    );
    return { service, prisma, reconciliation, execution };
  }

  it('deve gerar resumo operacional sem expor segredos do provider', async () => {
    const { service, prisma } = build();
    prisma.refund.count
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(2);
    prisma.webhookEvent.count.mockResolvedValue(4);

    const result = await service.summary();

    expect(result.refunds).toEqual({
      pending: 2,
      processing: 3,
      completed: 10,
      failed: 1,
      staleProcessing: 2,
    });
    expect(result.webhooks.failed).toBe(4);
  });

  it('deve listar FAILED e PROCESSING stale com provider vindo do Payment', async () => {
    const { service, prisma } = build();
    prisma.refund.findMany.mockResolvedValue([
      {
        id: 'r1',
        paymentId: 'p1',
        orderId: 'o1',
        amount: { toString: () => '25' },
        status: RefundStatus.FAILED,
        reason: 'Falha do provider',
        processedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        payment: {
          provider: 'PIX_INTERNAL',
          providerReference: 'pr-1',
          providerTransactionId: 'pt-1',
        },
      },
    ]);
    prisma.webhookEvent.findMany.mockResolvedValue([]);

    const result = await service.listIssues(9999);

    expect(result.refunds[0].amount).toBe('25');
    expect(result.refunds[0].provider).toBe('PIX_INTERNAL');
    expect(result.refunds[0].providerTransactionId).toBe('pt-1');
    expect(prisma.refund.findMany.mock.calls[0][0].take).toBe(200);
  });

  it('deve inspecionar refund agregando reconciliação, Payment e webhooks', async () => {
    const { service, prisma, reconciliation } = build();
    reconciliation.inspect.mockResolvedValue({
      refundId: 'r1',
      stale: true,
    });
    prisma.refund.findUnique.mockResolvedValue({
      id: 'r1',
      reason: 'Ajuste operacional',
      processedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      payment: {
        provider: 'PIX_INTERNAL',
        providerReference: 'provider-ref-1',
        providerTransactionId: 'provider-tx-1',
      },
    });
    prisma.webhookEvent.findMany.mockResolvedValue([
      {
        id: 'w1',
        status: WebhookStatus.PROCESSED,
        processedAt: new Date(),
      },
    ]);

    const result = await service.inspect('r1');
    expect(result.refundId).toBe('r1');
    expect(result.provider).toBe('PIX_INTERNAL');
    expect(result.providerTransactionId).toBe('provider-tx-1');
    expect(result.recentWebhooks).toHaveLength(1);
  });

  it('deve executar reconciliação manual pelo serviço de execução', async () => {
    const { service, prisma, execution } = build();
    prisma.refund.findUnique.mockResolvedValue({ id: 'r1' });
    execution.reconcile.mockResolvedValue({
      id: 'r1',
      status: RefundStatus.COMPLETED,
    });

    const result = await service.reconcileOne('r1');
    expect(result.status).toBe(RefundStatus.COMPLETED);
    expect(execution.reconcile).toHaveBeenCalledWith('r1');
  });

  it('deve delegar lote stale ao serviço de reconciliação', async () => {
    const { service, reconciliation } = build();
    reconciliation.reconcileStaleProcessing.mockResolvedValue({
      scanned: 2,
      completed: 2,
    });

    const result = await service.reconcileStale(25);
    expect(result.completed).toBe(2);
    expect(reconciliation.reconcileStaleProcessing).toHaveBeenCalledWith(25);
  });
});
