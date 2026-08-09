import { BadRequestException } from '@nestjs/common';
import {
  PaymentProvider,
  PaymentStatus,
  RefundStatus,
  WebhookStatus,
} from '@prisma/client';

import { PaymentProviderFactory } from '../../payments/providers/payment-provider.factory';
import { RefundProviderExecutionService } from './refund-provider-execution.service';
import { RefundProviderWebhookService } from './refund-provider-webhook.service';

describe('RefundProviderWebhookService - Sprint 7.4.3', () => {
  function build() {
    const prisma: any = {
      webhookEvent: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      refund: {
        findUnique: jest.fn(),
      },
    };

    const provider = {
      validateWebhook: jest.fn().mockResolvedValue(true),
    };

    const providerFactory = {
      getByType: jest.fn().mockReturnValue(provider),
    };

    const execution = {
      applyProviderWebhookResult: jest.fn(),
    };

    const service = new RefundProviderWebhookService(
      prisma,
      providerFactory as unknown as PaymentProviderFactory,
      execution as unknown as RefundProviderExecutionService,
    );

    return {
      service,
      prisma,
      provider,
      providerFactory,
      execution,
    };
  }

  const refund = {
    id: 'refund-1',
    status: RefundStatus.PROCESSING,
    payment: {
      id: 'payment-1',
      provider: PaymentProvider.PIX_INTERNAL,
      status: PaymentStatus.CAPTURED,
    },
  };

  it('deve validar assinatura antes de processar', async () => {
    const { service, provider, prisma } = build();
    provider.validateWebhook.mockResolvedValue(false);

    await expect(
      service.process(
        'PIX_INTERNAL',
        'evt-1',
        'refund.completed',
        {},
        { refundId: 'refund-1' },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.webhookEvent.create).not.toHaveBeenCalled();
  });

  it('deve aplicar confirmação COMPLETED ao Refund', async () => {
    const { service, prisma, execution } = build();

    prisma.webhookEvent.findUnique.mockResolvedValue(null);
    prisma.webhookEvent.create.mockResolvedValue({
      id: 'webhook-1',
      status: WebhookStatus.RECEIVED,
    });
    prisma.refund.findUnique.mockResolvedValue(refund);
    execution.applyProviderWebhookResult.mockResolvedValue({
      id: 'refund-1',
      status: RefundStatus.COMPLETED,
    });
    prisma.webhookEvent.update.mockResolvedValue({});

    const result = await service.process(
      'PIX_INTERNAL',
      'evt-1',
      'refund.completed',
      {},
      { refundId: 'refund-1', status: 'succeeded' },
    );

    expect(execution.applyProviderWebhookResult).toHaveBeenCalledWith(
      'refund-1',
      'COMPLETED',
    );
    expect(result.alreadyProcessed).toBe(false);
  });

  it('deve ser idempotente para webhook já processado', async () => {
    const { service, prisma, execution } = build();

    prisma.webhookEvent.findUnique.mockResolvedValue({
      id: 'webhook-1',
      status: WebhookStatus.PROCESSED,
      resultJson: { refundId: 'refund-1' },
    });

    const result = await service.process(
      'PIX_INTERNAL',
      'evt-dup',
      'refund.completed',
      {},
      { refundId: 'refund-1' },
    );

    expect(result.alreadyProcessed).toBe(true);
    expect(execution.applyProviderWebhookResult).not.toHaveBeenCalled();
  });

  it('deve ignorar evento pending sem regredir estado', async () => {
    const { service, prisma, execution } = build();

    prisma.webhookEvent.findUnique.mockResolvedValue(null);
    prisma.webhookEvent.create.mockResolvedValue({
      id: 'webhook-1',
      status: WebhookStatus.RECEIVED,
    });
    prisma.refund.findUnique.mockResolvedValue(refund);
    prisma.webhookEvent.update.mockResolvedValue({});

    await service.process(
      'PIX_INTERNAL',
      'evt-pending',
      'refund.pending',
      {},
      { refundId: 'refund-1', status: 'processing' },
    );

    expect(execution.applyProviderWebhookResult).not.toHaveBeenCalled();
  });

  it('deve aplicar FAILED sem permitir provider diferente', async () => {
    const { service, prisma } = build();

    prisma.webhookEvent.findUnique.mockResolvedValue(null);
    prisma.webhookEvent.create.mockResolvedValue({
      id: 'webhook-1',
      status: WebhookStatus.RECEIVED,
    });
    prisma.refund.findUnique.mockResolvedValue({
      ...refund,
      payment: {
        ...refund.payment,
        provider: PaymentProvider.ORANGE,
      },
    });
    prisma.webhookEvent.update.mockResolvedValue({});

    await expect(
      service.process(
        'PIX_INTERNAL',
        'evt-mismatch',
        'refund.failed',
        {},
        { refundId: 'refund-1' },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
