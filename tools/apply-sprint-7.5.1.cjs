const fs = require('fs');
const path = require('path');

const root = process.cwd();

function ensureAppModule() {
  const appModulePath = path.join(root, 'apps/api/src/app.module.ts');
  let appModule = fs.readFileSync(appModulePath, 'utf8');

  const importLine = "import { FinancialReconciliationModule } from './modules/financial-reconciliation/financial-reconciliation.module';";
  if (!appModule.includes(importLine)) {
    const importAnchor = "import { PaymentsModule } from './modules/payments/payments.module';";
    if (!appModule.includes(importAnchor)) {
      throw new Error('Anchor PaymentsModule não encontrado nos imports de app.module.ts');
    }
    appModule = appModule.replace(importAnchor, `${importAnchor}\n${importLine}`);
  }

  const moduleSection = appModule.split('@Module({')[1] || '';
  if (!/\bFinancialReconciliationModule\s*,/.test(moduleSection)) {
    const moduleAnchor = '    PaymentsModule,';
    if (!appModule.includes(moduleAnchor)) {
      throw new Error('PaymentsModule não encontrado no array imports do AppModule');
    }
    appModule = appModule.replace(
      moduleAnchor,
      `${moduleAnchor}\n    FinancialReconciliationModule,`,
    );
  }

  fs.writeFileSync(appModulePath, appModule);
  console.log('[Sprint 7.5.1 FIX] app.module.ts atualizado/idempotente.');
}

ensureAppModule();
console.log('[Sprint 7.5.1 FIX] Nenhuma migration necessária.');
console.log('[Sprint 7.5.1 FIX] Aplicação concluída.');
