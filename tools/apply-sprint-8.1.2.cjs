const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const API = path.join(ROOT, 'apps', 'api');

function mustRead(rel) {
  const file = path.join(ROOT, rel);
  if (!fs.existsSync(file)) {
    throw new Error(`Arquivo obrigatório não encontrado: ${rel}`);
  }
  return { file, text: fs.readFileSync(file, 'utf8') };
}

function save(file, before, after, label) {
  if (before === after) {
    console.log(`[Sprint 8.1.2] sem alteração necessária: ${label}`);
    return;
  }
  fs.writeFileSync(file, after, 'utf8');
  console.log(`[Sprint 8.1.2] atualizado: ${label}`);
}

if (!fs.existsSync(API)) {
  throw new Error(
    'apps/api não encontrado. Execute o script na raiz de mercado-nusali.',
  );
}

/**
 * ---------------------------------------------------------------------------
 * Sprint 3 HTTP E2E
 * ---------------------------------------------------------------------------
 * A suíte é "HTTP E2E - Mocked Infrastructure". O objetivo dela é validar:
 * rota + autenticação + validação + controller + envelope HTTP.
 *
 * O núcleo transacional/concurrency do checkout já possui suites próprias.
 * Portanto não devemos manter um Prisma mock gigante acoplado a cada campo
 * interno novo do CheckoutConfirmationService.
 *
 * Modernização:
 * - usa o endpoint canônico /checkout/session (não o legado /preview);
 * - sobrescreve somente CheckoutService;
 * - mantém Address/Cart passando pelos módulos reais com Prisma mockado.
 */
{
  const { file, text: before } = mustRead(
    'apps/api/test/sprint3.e2e-spec.ts',
  );
  let after = before;

  const checkoutImport =
    "import { CheckoutService } from '../src/modules/checkout/checkout.service';";
  if (!after.includes(checkoutImport)) {
    after = after.replace(
      "import { Prisma } from '@prisma/client';",
      "import { Prisma } from '@prisma/client';\n" + checkoutImport,
    );
  }

  const mockServiceBlock = `
  const mockCheckoutService = {
    createCheckoutSession: jest.fn().mockResolvedValue({
      session: {
        id: 'session-e2e',
        status: 'CREATED',
        expiresAt: new Date(Date.now() + 900000),
      },
      cartSummary: {
        subtotal: new Prisma.Decimal(200),
        grandTotal: new Prisma.Decimal(200),
      },
      stores: [],
      shippingQuotes: {},
    }),
    confirmCheckout: jest.fn().mockResolvedValue({
      orderGroup: {
        id: 'group-e2e',
        status: 'PENDING_PAYMENT',
      },
      orders: [
        {
          id: 'order-e2e',
          orderNumber: 'NSL-GW-20260802-E2E100',
          status: 'PENDING_PAYMENT',
        },
      ],
      stockReservation: {
        id: 'res-e2e',
        status: 'ACTIVE',
      },
    }),
  };
`;

  if (!after.includes('const mockCheckoutService = {')) {
    const anchor = '\n  beforeAll(async () => {';
    if (!after.includes(anchor)) {
      throw new Error(
        'Não foi possível localizar beforeAll em sprint3.e2e-spec.ts.',
      );
    }
    after = after.replace(anchor, mockServiceBlock + anchor);
  }

  const compileChain =
    `.overrideProvider(PrismaService)
      .useValue(mockPrismaService)
      .compile();`;

  const compileReplacement =
    `.overrideProvider(PrismaService)
      .useValue(mockPrismaService)
      .overrideProvider(CheckoutService)
      .useValue(mockCheckoutService)
      .compile();`;

  if (
    after.includes(compileChain) &&
    !after.includes('.overrideProvider(CheckoutService)')
  ) {
    after = after.replace(compileChain, compileReplacement);
  }

  after = after.replace(
    "it('POST /api/v1/checkout/preview (Generate Checkout Preview)'",
    "it('POST /api/v1/checkout/session (Create Checkout Session)'",
  );
  after = after.replace(
    ".post('/api/v1/checkout/preview')",
    ".post('/api/v1/checkout/session')",
  );
  after = after.replace(
    "expect(res.body.data.checkoutSessionId).toBe('session-e2e');",
    "expect(res.body.data.session.id).toBe('session-e2e');",
  );

  // O Idempotency-Key pertence à confirmação transacional interna; o controller
  // atual recebe apenas o body. Mantemos o header para compatibilidade de cliente,
  // sem fazer o E2E depender de detalhes internos do serviço.
  save(
    file,
    before,
    after,
    'apps/api/test/sprint3.e2e-spec.ts',
  );
}

/**
 * ---------------------------------------------------------------------------
 * Sprint 4 HTTP E2E
 * ---------------------------------------------------------------------------
 * A suíte antiga tentava reproduzir toda a infraestrutura financeira com um
 * único Prisma mock. Hoje Payment, Wallet, Escrow, Refund e Payout possuem
 * transaction services, CAS, provider execution, reconciliation e suites
 * PostgreSQL reais dedicadas.
 *
 * Continuar expandindo aquele mock seria perigoso: o teste HTTP ficaria
 * validando a implementação interna antiga, não o contrato REST atual.
 *
 * Aqui cada application service do controller é substituído por stub explícito.
 * Guards/permissions/controllers/DTOs/envelope HTTP continuam reais.
 */
{
  const { file, text: before } = mustRead(
    'apps/api/test/sprint4.e2e-spec.ts',
  );
  let after = before;

  const imports = [
    "import { PaymentsService } from '../src/modules/payments/payments.service';",
    "import { PaymentIntentsService } from '../src/modules/payments/payment-intents.service';",
    "import { WalletService } from '../src/modules/wallet/wallet.service';",
    "import { EscrowService } from '../src/modules/escrow/escrow.service';",
    "import { PayoutsService } from '../src/modules/payouts/payouts.service';",
    "import { RefundsService } from '../src/modules/refunds/refunds.service';",
    "import { WebhooksService } from '../src/modules/webhooks/webhooks.service';",
  ];

  const importAnchor =
    "import { Prisma, PaymentStatus, EscrowStatus } from '@prisma/client';";

  if (!after.includes(importAnchor)) {
    throw new Error(
      'Import anchor do sprint4.e2e-spec.ts não encontrado.',
    );
  }

  for (const line of imports) {
    if (!after.includes(line)) {
      after = after.replace(importAnchor, importAnchor + '\n' + line);
    }
  }

  const servicesBlock = `
  const mockPaymentIntentsService = {
    createIntent: jest.fn().mockResolvedValue({
      id: 'intent-fin-e2e',
      orderGroupId: 'group-fin-e2e',
      buyerId: 'user-fin-e2e',
      amount: new Prisma.Decimal(1000),
      currencyId: 'curr-gw',
      status: PaymentStatus.CREATED,
    }),
    getIntentById: jest.fn(),
  };

  const mockPaymentsService = {
    processPayment: jest.fn().mockResolvedValue({
      id: 'payment-fin-e2e',
      paymentIntentId: 'intent-fin-e2e',
      status: PaymentStatus.PENDING,
      provider: 'ORANGE',
    }),
    capturePayment: jest.fn(),
    getPaymentById: jest.fn(),
  };

  const mockWalletService = {
    getWalletBalance: jest.fn().mockResolvedValue({
      id: 'wallet-fin',
      userId: 'user-fin-e2e',
      currencyId: 'curr-gw',
      balanceAvailable: '5000.00',
      balanceBlocked: '0.00',
      status: 'ACTIVE',
    }),
    getTransactions: jest.fn().mockResolvedValue([]),
    deposit: jest.fn().mockResolvedValue({
      wallet: {
        id: 'wallet-fin',
        balanceAvailable: '6000.00',
      },
      transaction: {
        id: 'wallet-tx-deposit-e2e',
        type: 'DEPOSIT',
        amount: '1000.00',
      },
    }),
    withdraw: jest.fn(),
  };

  const mockEscrowService = {
    getEscrowByOrderId: jest.fn(),
    releaseEscrow: jest.fn().mockResolvedValue({
      id: 'escrow-fin-e2e',
      orderId: 'order-fin-1',
      status: EscrowStatus.RELEASED,
      heldAmount: '0.00',
      releasedAmount: '1000.00',
    }),
    releasePartial: jest.fn(),
    refundEscrow: jest.fn(),
    cancelEscrow: jest.fn(),
    openDispute: jest.fn(),
    resolveDispute: jest.fn(),
  };

  const mockPayoutsService = {
    listSellerPayouts: jest.fn().mockResolvedValue([]),
    requestPayout: jest.fn().mockResolvedValue({
      id: 'payout-fin-e2e',
      sellerId: 'seller-fin-1',
      amount: '500.00',
      currencyId: 'curr-gw',
      status: 'CREATED',
    }),
    processPayout: jest.fn(),
    cancelPayout: jest.fn(),
    failPayout: jest.fn(),
    reconcilePayout: jest.fn(),
    listReconciliationIssues: jest.fn(),
  };

  const mockRefundsService = {
    processRefund: jest.fn().mockResolvedValue({
      id: 'refund-fin-e2e',
      paymentId: 'payment-fin-e2e',
      orderId: 'order-fin-1',
      buyerId: 'user-fin-e2e',
      amount: '1000.00',
      status: 'COMPLETED',
    }),
    retryRefund: jest.fn(),
    listBuyerRefunds: jest.fn().mockResolvedValue([]),
  };

  const mockWebhooksService = {
    processWebhook: jest.fn().mockResolvedValue({
      success: true,
      data: {
        eventId: 'evt-e2e-100',
        processed: true,
      },
    }),
  };
`;

  if (!after.includes('const mockPaymentIntentsService = {')) {
    const anchor = '\n  beforeAll(async () => {';
    if (!after.includes(anchor)) {
      throw new Error(
        'Não foi possível localizar beforeAll em sprint4.e2e-spec.ts.',
      );
    }
    after = after.replace(anchor, servicesBlock + anchor);
  }

  const oldCompile =
    `.overrideProvider(PrismaService)
      .useValue(mockPrismaService)
      .compile();`;

  const newCompile =
    `.overrideProvider(PrismaService)
      .useValue(mockPrismaService)
      .overrideProvider(PaymentIntentsService)
      .useValue(mockPaymentIntentsService)
      .overrideProvider(PaymentsService)
      .useValue(mockPaymentsService)
      .overrideProvider(WalletService)
      .useValue(mockWalletService)
      .overrideProvider(EscrowService)
      .useValue(mockEscrowService)
      .overrideProvider(PayoutsService)
      .useValue(mockPayoutsService)
      .overrideProvider(RefundsService)
      .useValue(mockRefundsService)
      .overrideProvider(WebhooksService)
      .useValue(mockWebhooksService)
      .compile();`;

  if (
    after.includes(oldCompile) &&
    !after.includes('.overrideProvider(PaymentsService)')
  ) {
    after = after.replace(oldCompile, newCompile);
  }

  // Garante que req.user.id exista independentemente da forma como JwtAuthGuard
  // normaliza payload/session. Isto também torna o contrato do teste explícito.
  after = after.replace(
    `authToken = jwtService.sign({
      sub: 'user-fin-e2e',
      email: 'fin@example.com',
      sessionId: 'session-fin',
    });`,
    `authToken = jwtService.sign({
      id: 'user-fin-e2e',
      sub: 'user-fin-e2e',
      email: 'fin@example.com',
      sessionId: 'session-fin',
    });`,
  );

  save(
    file,
    before,
    after,
    'apps/api/test/sprint4.e2e-spec.ts',
  );
}

/**
 * ---------------------------------------------------------------------------
 * Contract guard
 * ---------------------------------------------------------------------------
 * A rota canônica de criação de sessão é /checkout/session. Evita reintroduzir
 * no E2E a rota /checkout/preview, que não existe no controller atual.
 */
{
  const { file, text: before } = mustRead(
    'apps/api/src/api-route-contract.spec.ts',
  );
  let after = before;

  if (!after.includes("checkout expõe session como rota canônica")) {
    const marker = '\n});\n';
    const test = `

  it('checkout expõe session como rota canônica e E2E não usa preview legado', () => {
    const controller = fs.readFileSync(
      path.join(
        srcRoot,
        'modules',
        'checkout',
        'checkout.controller.ts',
      ),
      'utf8',
    );

    expect(controller).toContain("@Controller('checkout')");
    expect(controller).toContain("@Post('session')");
    expect(controller).not.toContain("@Post('preview')");

    const sprint3 = fs.readFileSync(
      path.join(testRoot, 'sprint3.e2e-spec.ts'),
      'utf8',
    );

    expect(sprint3).toContain('/api/v1/checkout/session');
    expect(sprint3).not.toContain('/api/v1/checkout/preview');
  });
`;
    const idx = after.lastIndexOf(marker);
    if (idx < 0) {
      throw new Error(
        'Não foi possível ampliar api-route-contract.spec.ts.',
      );
    }
    after = after.slice(0, idx) + test + after.slice(idx);
  }

  save(
    file,
    before,
    after,
    'apps/api/src/api-route-contract.spec.ts',
  );
}

console.log('');
console.log('[Sprint 8.1.2] aplicação concluída.');
console.log('[Sprint 8.1.2] Nenhuma migration necessária.');
console.log(
  '[Sprint 8.1.2] Nenhuma regra financeira/checkout de produção foi alterada.',
);
console.log(
  '[Sprint 8.1.2] E2E HTTP legado agora valida contratos REST atuais sem duplicar testes internos PostgreSQL.',
);
