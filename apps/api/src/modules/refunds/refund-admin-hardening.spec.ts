import 'reflect-metadata';
import { validate } from 'class-validator';
import { RefundAdminLimitQueryDto, RefundAdminReportQueryDto, RefundAdminReconcileStaleDto } from './dto/refund-admin.dto';
import { REFUND_ADMIN_PERMISSIONS } from './refund-admin.permissions';

describe('Refund Admin API Hardening - Sprint 7.4.7', () => {
  it('deve manter permissões administrativas separadas por capacidade', () => {
    expect(new Set(Object.values(REFUND_ADMIN_PERMISSIONS)).size).toBe(3);
    expect(REFUND_ADMIN_PERMISSIONS.READ).toBe('refund:admin:read');
    expect(REFUND_ADMIN_PERMISSIONS.OPERATE).toBe('refund:admin:operate');
    expect(REFUND_ADMIN_PERMISSIONS.REPORT).toBe('refund:admin:report');
  });

  it('deve rejeitar limite operacional acima do teto', async () => {
    const dto = Object.assign(new RefundAdminLimitQueryDto(), { limit: 201 });
    expect(await validate(dto)).not.toHaveLength(0);
  });

  it('deve rejeitar lote de reconciliação acima do teto', async () => {
    const dto = Object.assign(new RefundAdminReconcileStaleDto(), { limit: 201 });
    expect(await validate(dto)).not.toHaveLength(0);
  });

  it('deve rejeitar relatório acima de 1000 linhas', async () => {
    const dto = Object.assign(new RefundAdminReportQueryDto(), { limit: 1001 });
    expect(await validate(dto)).not.toHaveLength(0);
  });

  it('deve aceitar intervalo de relatório válido', async () => {
    const dto = Object.assign(new RefundAdminReportQueryDto(), {
      from: new Date('2026-08-01T00:00:00.000Z'),
      to: new Date('2026-08-08T23:59:59.000Z'),
      limit: 100,
    });
    expect(await validate(dto)).toHaveLength(0);
  });
});
