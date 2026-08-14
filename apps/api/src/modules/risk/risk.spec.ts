import {
  Prisma,
  RiskAlertStatus,
  RiskAlertType,
  RiskEntityType,
  RiskSeverity,
} from '@prisma/client';
import * as crypto from 'crypto';
import { RiskService } from './risk.service';
import { RiskDetectionService } from './services/risk-detection.service';
import { RiskEventListener } from './listeners/risk-event.listener';
import { RISK_CONFIG } from './risk.config';

describe('Risk & Antifraud Module', () => {
  let riskService: RiskService;
  let riskDetectionService: RiskDetectionService;
  let riskEventListener: RiskEventListener;
  let mockPrismaService: any;
  let mockAuditService: any;
  let mockPayoutReconciliationService: any;

  const mockAdminUser = {
    id: 'admin-user-uuid-1',
    firstName: 'Admin',
    lastName: 'User',
    email: 'admin@nusali.com',
  };

  beforeEach(() => {
    mockPrismaService = {
      riskAlert: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
      },
      riskAlertHistory: {
        create: jest.fn(),
        findMany: jest.fn(),
      },
      session: {
        findMany: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
      },
      $transaction: jest.fn((callback) => callback(mockPrismaService)),
    };

    mockAuditService = {
      log: jest.fn().mockResolvedValue({ id: 'audit-log-1' }),
    };

    mockPayoutReconciliationService = {
      reconcileOne: jest.fn(),
    };

    riskService = new RiskService(mockPrismaService, mockAuditService);
    riskDetectionService = new RiskDetectionService(
      mockPrismaService,
      mockPayoutReconciliationService,
    );
    riskEventListener = new RiskEventListener(riskDetectionService);
  });

  describe('1. Criação de Alerta e Histórico Inicial', () => {
    it('deve criar um alerta de risco e registrar histórico inicial', async () => {
      const createdAlert = {
        id: 'alert-uuid-1',
        type: RiskAlertType.SUSPICIOUS_PAYMENT,
        severity: RiskSeverity.HIGH,
        status: RiskAlertStatus.OPEN,
        riskScore: 80,
        entityType: RiskEntityType.PAYMENT,
        entityId: 'pay-123',
        title: 'Pagamento Suspeito',
        description: 'Múltiplas tentativas de cartão com falha',
        source: 'SYSTEM_DETECTION',
        ruleCode: 'FAILED_CARD_ATTEMPTS',
      };

      mockPrismaService.riskAlert.create.mockResolvedValue(createdAlert);
      mockPrismaService.riskAlertHistory.create.mockResolvedValue({ id: 'hist-1' });

      const result = await riskDetectionService.createAlert({
        type: RiskAlertType.SUSPICIOUS_PAYMENT,
        severity: RiskSeverity.HIGH,
        riskScore: 80,
        entityType: RiskEntityType.PAYMENT,
        entityId: 'pay-123',
        title: 'Pagamento Suspeito',
        description: 'Múltiplas tentativas de cartão com falha',
        ruleCode: 'FAILED_CARD_ATTEMPTS',
      });

      expect(result).toEqual(createdAlert);
      expect(mockPrismaService.riskAlert.create).toHaveBeenCalled();
      expect(mockPrismaService.riskAlertHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          riskAlertId: 'alert-uuid-1',
          action: 'ALERT_CREATED',
        }),
      });
    });
  });

  describe('2. Prevenção de Duplicidade e Deduplicação por dedupeKey', () => {
    it('deve retornar o alerta existente e não criar duplicata se houver alerta ativo com mesmo dedupeKey', async () => {
      const existingAlert = {
        id: 'existing-alert-uuid',
        type: RiskAlertType.MULTIPLE_ACCOUNTS,
        severity: RiskSeverity.HIGH,
        status: RiskAlertStatus.OPEN,
        riskScore: 75,
        entityType: RiskEntityType.USER,
        entityId: 'user-123',
        ruleCode: 'MULTIPLE_ACCOUNTS_SAME_IP',
        dedupeKey: 'MULTIPLE_ACCOUNTS_SAME_IP:abc123hash',
      };

      mockPrismaService.riskAlert.findFirst.mockResolvedValue(existingAlert);

      const result = await riskDetectionService.createAlertIfNotExists({
        type: RiskAlertType.MULTIPLE_ACCOUNTS,
        severity: RiskSeverity.HIGH,
        riskScore: 75,
        entityType: RiskEntityType.USER,
        entityId: 'user-123',
        title: 'Múltiplas Contas',
        description: 'Teste',
        ruleCode: 'MULTIPLE_ACCOUNTS_SAME_IP',
        dedupeKey: 'MULTIPLE_ACCOUNTS_SAME_IP:abc123hash',
      });

      expect(result).toEqual(existingAlert);
      expect(mockPrismaService.riskAlert.create).not.toHaveBeenCalled();
    });

    it('mesmo IP não deve criar duplicatas mesmo se a ordem dos userIds mudar (estabilidade por hash do IP)', async () => {
      // Primeira consulta: userIds em ordem [user-1, user-2, user-3, user-4]
      mockPrismaService.session.findMany.mockResolvedValueOnce([
        { userId: 'user-1' },
        { userId: 'user-2' },
        { userId: 'user-3' },
        { userId: 'user-4' },
      ]);

      const testIp = '189.44.22.11';
      const ipHash = crypto
        .createHash('sha256')
        .update(testIp)
        .digest('hex')
        .substring(0, 16);
      const expectedDedupeKey = `MULTIPLE_ACCOUNTS_SAME_IP:${ipHash}`;

      const createdAlert = {
        id: 'alert-ip-1',
        dedupeKey: expectedDedupeKey,
        status: RiskAlertStatus.OPEN,
      };

      mockPrismaService.riskAlert.findFirst.mockResolvedValueOnce(null);
      mockPrismaService.riskAlert.create.mockResolvedValueOnce(createdAlert);

      const alert1 = await riskDetectionService.evaluateMultipleAccounts(testIp);
      expect(alert1?.dedupeKey).toBe(expectedDedupeKey);

      // Segunda consulta: userIds em ordem invertida [user-4, user-3, user-2, user-1]
      mockPrismaService.session.findMany.mockResolvedValueOnce([
        { userId: 'user-4' },
        { userId: 'user-3' },
        { userId: 'user-2' },
        { userId: 'user-1' },
      ]);

      // A deduplicacao consulta por dedupeKey (que depende apenas do IP, nao dos userIds)
      mockPrismaService.riskAlert.findFirst.mockResolvedValueOnce(createdAlert);

      const alert2 = await riskDetectionService.evaluateMultipleAccounts(testIp);
      expect(alert2).toEqual(createdAlert);
      expect(mockPrismaService.riskAlert.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('3. Concorrência e Tratamento do Erro Prisma P2002 na Deduplicação', () => {
    it('duas execuções concorrentes não devem criar alertas duplicados nem lançar erro (captura P2002)', async () => {
      const targetDedupeKey = 'PAYOUT_RECONCILIATION_MISMATCH:payout-concurrent-1';
      const existingActiveAlert = {
        id: 'active-alert-uuid',
        dedupeKey: targetDedupeKey,
        status: RiskAlertStatus.OPEN,
      };

      mockPrismaService.riskAlert.findFirst
        .mockResolvedValueOnce(null) // Primeira checagem findFirst nao acha nada
        .mockResolvedValueOnce(existingActiveAlert); // Na segunda checagem apos P2002 acha o alerta inserido pela outra thread

      // Simula erro de violacao de indice unico parcial no PostgreSQL (P2002)
      const prismaP2002Error = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed on the fields: (dedupeKey)',
        { code: 'P2002', clientVersion: '6.19.3' },
      );
      mockPrismaService.riskAlert.create.mockRejectedValueOnce(prismaP2002Error);

      const result = await riskDetectionService.createAlertIfNotExists({
        type: RiskAlertType.PAYOUT_RECONCILIATION,
        severity: RiskSeverity.CRITICAL,
        riskScore: 95,
        entityType: RiskEntityType.PAYOUT,
        entityId: 'payout-concurrent-1',
        ruleCode: 'PAYOUT_RECONCILIATION_MISMATCH',
        dedupeKey: targetDedupeKey,
        title: 'Concorrência Teste',
        description: 'Teste de concorrência',
      });

      expect(result).toEqual(existingActiveAlert);
    });
  });

  describe('4. Disparo de Regra de Sessão via EventListener e Isolamento de Falhas', () => {
    it('evento auth.session.created deve disparar a avaliação de múltiplas contas', async () => {
      const spy = jest
        .spyOn(riskDetectionService, 'evaluateMultipleAccounts')
        .mockResolvedValue(null);

      await riskEventListener.handleSessionCreated({
        userId: 'user-new',
        sessionId: 'session-123',
        ipAddress: '200.100.50.25',
      });

      expect(spy).toHaveBeenCalledWith('200.100.50.25');
    });

    it('falha no RiskDetectionService durante evento de sessão NÃO deve lançar exceção', async () => {
      jest
        .spyOn(riskDetectionService, 'evaluateMultipleAccounts')
        .mockRejectedValue(new Error('Erro simulado de banco de dados no motor de risco'));

      await expect(
        riskEventListener.handleSessionCreated({
          userId: 'user-new',
          sessionId: 'session-123',
          ipAddress: '200.100.50.25',
        }),
      ).resolves.not.toThrow();
    });
  });

  describe('5. Disparo de Reconciliação de Payout via EventListener (REGRA 1)', () => {
    it('evento payout.reconciliation.completed com consistent=false deve criar RiskAlert com gravidade CRITICAL', async () => {
      mockPrismaService.riskAlert.findFirst.mockResolvedValue(null);
      mockPrismaService.riskAlert.create.mockImplementation(({ data }: any) => ({
        id: 'payout-risk-alert-1',
        ...data,
      }));

      const spyResult = jest.spyOn(
        riskDetectionService,
        'evaluatePayoutReconciliationResult',
      );

      await riskEventListener.handlePayoutReconciliationCompleted({
        payoutId: 'payout-inconsistent-123',
        status: 'PAID' as any,
        consistent: false,
        issues: ['DEBIT_ON_TERMINAL_FAILURE', 'INVALID_PAYOUT_LEDGER'],
        reservationCount: 1,
        payoutDebitCount: 1,
        ledgerCount: 0,
      });

      expect(spyResult).toHaveBeenCalledWith(
        expect.objectContaining({
          payoutId: 'payout-inconsistent-123',
          consistent: false,
        }),
      );
      expect(mockPrismaService.riskAlert.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: RiskAlertType.PAYOUT_RECONCILIATION,
          severity: RiskSeverity.CRITICAL,
          riskScore: 95,
          payoutId: 'payout-inconsistent-123',
          ruleCode: 'PAYOUT_RECONCILIATION_MISMATCH',
        }),
      });
    });

    it('evento payout.reconciliation.completed com consistent=true NÃO deve criar RiskAlert', async () => {
      await riskEventListener.handlePayoutReconciliationCompleted({
        payoutId: 'payout-consistent-999',
        status: 'PAID' as any,
        consistent: true,
        issues: [],
        reservationCount: 1,
        payoutDebitCount: 1,
        ledgerCount: 1,
      });

      expect(mockPrismaService.riskAlert.create).not.toHaveBeenCalled();
    });
  });

  describe('6. Gestão de Alertas (Status, Histórico e Resolução)', () => {
    it('deve atualizar o status do alerta, registrar histórico e log de auditoria', async () => {
      const existingAlert = {
        id: 'alert-1',
        status: RiskAlertStatus.OPEN,
      };

      const updatedAlert = {
        id: 'alert-1',
        status: RiskAlertStatus.INVESTIGATING,
      };

      mockPrismaService.riskAlert.findUnique.mockResolvedValue(existingAlert);
      mockPrismaService.riskAlert.update.mockResolvedValue(updatedAlert);
      mockPrismaService.riskAlertHistory.create.mockResolvedValue({ id: 'h-1' });

      const result = await riskService.updateStatus(
        'alert-1',
        { status: RiskAlertStatus.INVESTIGATING, note: 'Em análise pelo time de risco' },
        mockAdminUser,
        { ipAddress: '192.168.1.10', userAgent: 'Jest-Test' },
      );

      expect(result.status).toBe(RiskAlertStatus.INVESTIGATING);
      expect(mockPrismaService.riskAlertHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          riskAlertId: 'alert-1',
          action: 'STATUS_CHANGED',
          oldStatus: RiskAlertStatus.OPEN,
          newStatus: RiskAlertStatus.INVESTIGATING,
          performedById: mockAdminUser.id,
        }),
      });
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'RISK_ALERT_STATUS_CHANGED',
          entityId: 'alert-1',
        }),
      );
    });

    it('deve resolver o alerta com status RESOLVED, data de resolução e auditoria', async () => {
      const existingAlert = {
        id: 'alert-1',
        status: RiskAlertStatus.INVESTIGATING,
      };

      const resolvedAlert = {
        id: 'alert-1',
        status: RiskAlertStatus.RESOLVED,
        resolvedAt: new Date(),
        resolvedById: mockAdminUser.id,
        resolution: 'Transação confirmada com comprovante válido.',
      };

      mockPrismaService.riskAlert.findUnique.mockResolvedValue(existingAlert);
      mockPrismaService.riskAlert.update.mockResolvedValue(resolvedAlert);

      const result = await riskService.resolveAlert(
        'alert-1',
        {
          status: RiskAlertStatus.RESOLVED,
          resolution: 'Transação confirmada com comprovante válido.',
          note: 'Finalizado com sucesso',
        },
        mockAdminUser,
      );

      expect(result.status).toBe(RiskAlertStatus.RESOLVED);
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'RISK_ALERT_RESOLVED',
        }),
      );
    });
  });
});
