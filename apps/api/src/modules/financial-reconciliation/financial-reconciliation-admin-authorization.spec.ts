import 'reflect-metadata';

import { PERMISSIONS_KEY } from '../../common/decorators/permissions.decorator';
import { FinancialReconciliationAdminController } from './financial-reconciliation-admin.controller';

describe('Financial Reconciliation Admin Authorization - Sprint 7.5.6', () => {
  it('protege o controller com permissão administrativa financeira', () => {
    const permissions = Reflect.getMetadata(
      PERMISSIONS_KEY,
      FinancialReconciliationAdminController,
    );

    expect(permissions).toEqual(['payout:process:admin']);
  });
});
