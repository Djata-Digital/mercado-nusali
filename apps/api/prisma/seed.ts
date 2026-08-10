import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log(
    'Seeding Mercado Nusali foundation, Sprint 2 & Sprint 3 database...',
  );

  // 1. Languages
  const languages = [
    { code: 'pt', name: 'Português' },
    { code: 'en', name: 'English' },
    { code: 'fr', name: 'Français' },
  ];

  for (const lang of languages) {
    await prisma.language.upsert({
      where: { code: lang.code },
      update: { name: lang.name },
      create: lang,
    });
  }

  // 2. Currencies
  const currencies = [
    {
      code: 'XOF',
      name: 'Franco CFA',
      symbol: 'F CFA',
      decimals: 0,
    },
    {
      code: 'BRL',
      name: 'Real Brasileiro',
      symbol: 'R$',
      decimals: 2,
    },
    {
      code: 'EUR',
      name: 'Euro',
      symbol: '€',
      decimals: 2,
    },
    {
      code: 'AOA',
      name: 'Kwanza Angolano',
      symbol: 'Kz',
      decimals: 2,
    },
    {
      code: 'USD',
      name: 'Dólar Americano',
      symbol: '$',
      decimals: 2,
    },
  ];

  const currencyMap: Record<string, string> = {};

  for (const curr of currencies) {
    const created = await prisma.currency.upsert({
      where: { code: curr.code },
      update: {
        name: curr.name,
        symbol: curr.symbol,
        decimals: curr.decimals,
      },
      create: curr,
    });

    currencyMap[curr.code] = created.id;
  }

  // 3. Countries
  const countries = [
    {
      code: 'GW',
      name: 'Guiné-Bissau',
      flag: '🇬🇼',
      phonePrefix: '+245',
      defaultCurrencyCode: 'XOF',
    },
    {
      code: 'BR',
      name: 'Brasil',
      flag: '🇧🇷',
      phonePrefix: '+55',
      defaultCurrencyCode: 'BRL',
    },
    {
      code: 'PT',
      name: 'Portugal',
      flag: '🇵🇹',
      phonePrefix: '+351',
      defaultCurrencyCode: 'EUR',
    },
    {
      code: 'AO',
      name: 'Angola',
      flag: '🇦🇴',
      phonePrefix: '+244',
      defaultCurrencyCode: 'AOA',
    },
  ];

  const countryMap: Record<string, string> = {};

  for (const country of countries) {
    const defaultCurrencyId =
      currencyMap[country.defaultCurrencyCode];

    const created = await prisma.country.upsert({
      where: { code: country.code },
      update: {
        name: country.name,
        flag: country.flag,
        phonePrefix: country.phonePrefix,
        defaultCurrencyId,
      },
      create: {
        code: country.code,
        name: country.name,
        flag: country.flag,
        phonePrefix: country.phonePrefix,
        defaultCurrencyId,
      },
    });

    countryMap[country.code] = created.id;
  }

  // 4. Roles
  const roles = [
    {
      name: 'BUYER',
      description: 'Comprador padrão da plataforma',
    },
    {
      name: 'SELLER',
      description: 'Vendedor credenciado',
    },
    {
      name: 'ADMIN',
      description: 'Administrador da plataforma',
    },
    {
      name: 'GLOBAL_ADMIN',
      description: 'Administrador Global do ecossistema',
    },
    {
      name: 'COUNTRY_REPRESENTATIVE',
      description: 'Representante de País',
    },
    {
      name: 'REGIONAL_SUPERVISOR',
      description: 'Supervisor Regional',
    },
    {
      name: 'SUPPORT',
      description: 'Equipe de Suporte e Atendimento',
    },
    {
      name: 'FINANCE',
      description: 'Equipe Financeira',
    },
    {
      name: 'LOGISTICS',
      description: 'Equipe de Logística e Fulfillment',
    },
    {
      name: 'KYC_ANALYST',
      description: 'Analista de KYC e Documentos',
    },
    {
      name: 'RISK_ANALYST',
      description: 'Analista de Risco e Fraude',
    },
    {
      name: 'WAREHOUSE_MANAGER',
      description: 'Gerente de Armazém e Estoque Fulfillment',
    },
    {
      name: 'HUB_MANAGER',
      description: 'Gerente Operacional de HUB Logístico',
    },
    {
      name: 'WAREHOUSE_OPERATOR',
      description:
        'Operador de Armazenamento e Movimentação Interna',
    },
    {
      name: 'RECEIVING_OPERATOR',
      description:
        'Operador de Recebimento de Cargas e Conferência',
    },
    {
      name: 'INVENTORY_AUDITOR',
      description:
        'Auditor de Inventário Cíclico e Contagens',
    },
    {
      name: 'MODERATOR',
      description: 'Moderador de Conteúdo e Avaliações',
    },
    {
      name: 'AUDITOR',
      description: 'Auditor do Sistema e Conformidade',
    },
  ];

  const roleMap: Record<string, string> = {};

  for (const role of roles) {
    const created = await prisma.role.upsert({
      where: { name: role.name },
      update: { description: role.description },
      create: role,
    });

    roleMap[role.name] = created.id;
  }

  // 5. Permissions
  const permissions = [
    {
      slug: 'manage_products',
      name: 'Gerenciar Produtos',
      description: 'Criar, editar e remover produtos',
    },
    {
      slug: 'manage_orders',
      name: 'Gerenciar Pedidos',
      description: 'Visualizar e atualizar status de pedidos',
    },
    {
      slug: 'manage_users',
      name: 'Gerenciar Usuários',
      description: 'Administrar contas de usuário',
    },
    {
      slug: 'manage_sellers',
      name: 'Gerenciar Vendedores',
      description: 'Aprovar e gerenciar vendedores',
    },
    {
      slug: 'view_financials',
      name: 'Visualizar Financeiro',
      description: 'Acessar relatórios e métricas financeiras',
    },
    {
      slug: 'manage_kyc',
      name: 'Gerenciar KYC',
      description:
        'Analisar e aprovar documentos de validação KYC',
    },
    {
      slug: 'manage_disputes',
      name: 'Gerenciar Disputas',
      description:
        'Mediar disputas entre compradores e vendedores',
    },
    {
      slug: 'manage_warehouse',
      name: 'Gerenciar Armazém',
      description:
        'Operações de estoque e expedição fulfillment',
    },
    {
      slug: 'moderate_content',
      name: 'Moderar Conteúdo',
      description:
        'Moderar perguntas, anúncios e comentários',
    },
    {
      slug: 'view_audit_logs',
      name: 'Visualizar Auditoria',
      description:
        'Consultar histórico de auditoria e segurança',
    },

    // Sprint 2 permissions
    {
      slug: 'seller:read:self',
      name: 'Ler Próprio Perfil Vendedor',
      description: 'Visualizar próprio perfil de vendedor',
    },
    {
      slug: 'seller:update:self',
      name: 'Atualizar Próprio Perfil Vendedor',
      description: 'Atualizar dados do próprio vendedor',
    },
    {
      slug: 'seller:read:any',
      name: 'Ler Qualquer Vendedor',
      description: 'Visualizar perfis de vendedores',
    },
    {
      slug: 'seller:manage',
      name: 'Gerenciar Vendedores',
      description: 'Gestão completa de vendedores',
    },
    {
      slug: 'seller:approve',
      name: 'Aprovar Vendedores',
      description: 'Aprovação de contas de vendedores',
    },
    {
      slug: 'kyc:upload:self',
      name: 'Enviar Documentos KYC',
      description: 'Upload de documentos de verificação',
    },
    {
      slug: 'kyc:read:self',
      name: 'Ler Próprio KYC',
      description:
        'Verificar status dos próprios documentos',
    },
    {
      slug: 'kyc:read:any',
      name: 'Ler Qualquer Documento KYC',
      description: 'Acessar documentos KYC',
    },
    {
      slug: 'kyc:review',
      name: 'Revisar KYC',
      description: 'Revisar submissões de KYC',
    },
    {
      slug: 'kyc:approve',
      name: 'Aprovar KYC',
      description: 'Aprovação final de KYC',
    },

    // Sprint 3 permissions
    {
      slug: 'address:read:self',
      name: 'Ler Próprios Endereços',
      description: 'Visualizar lista de endereços do usuário',
    },
    {
      slug: 'address:create:self',
      name: 'Criar Endereço',
      description: 'Cadastrar novos endereços',
    },
    {
      slug: 'address:update:self',
      name: 'Atualizar Endereço',
      description: 'Editar endereços existentes',
    },
    {
      slug: 'address:delete:self',
      name: 'Remover Endereço',
      description: 'Excluir endereços com soft delete',
    },
    {
      slug: 'cart:manage:self',
      name: 'Gerenciar Próprio Carrinho',
      description:
        'Adicionar, atualizar e remover itens do carrinho',
    },
    {
      slug: 'checkout:create:self',
      name: 'Criar Checkout',
      description: 'Gerar preview e confirmar checkout',
    },
    {
      slug: 'order:read:self',
      name: 'Ler Próprios Pedidos',
      description: 'Visualizar histórico de pedidos do comprador',
    },
    {
      slug: 'order:cancel:self',
      name: 'Cancelar Próprio Pedido',
      description: 'Cancelar pedido antes do pagamento',
    },
    {
      slug: 'order:read:store',
      name: 'Ler Pedidos da Loja',
      description: 'Visualizar pedidos recebidos pela loja',
    },
    {
      slug: 'order:read:any',
      name: 'Ler Qualquer Pedido',
      description: 'Visão global administrativa de pedidos',
    },
    {
      slug: 'coupon:manage:store',
      name: 'Gerenciar Cupons da Loja',
      description: 'Criar e editar cupons de loja',
    },
    {
      slug: 'coupon:manage:platform',
      name: 'Gerenciar Cupons da Plataforma',
      description: 'Criar cupons globais de plataforma',
    },
    {
      slug: 'coupon:validate',
      name: 'Validar Cupom',
      description: 'Checar elegibilidade de cupons',
    },
    {
      slug: 'stock:reserve',
      name: 'Reservar Estoque',
      description: 'Realizar reservas atômicas de inventário',
    },
    {
      slug: 'stock:release',
      name: 'Liberar Estoque',
      description:
        'Liberar reservas de inventário expiradas ou canceladas',
    },

    // Sprint 5.1 Logistics Foundation permissions
    {
      slug: 'hub:read',
      name: 'Ler HUBs Logísticos',
      description: 'Visualizar HUBs, zonas e posições',
    },
    {
      slug: 'hub:create',
      name: 'Criar HUB Logístico',
      description: 'Cadastrar novos HUBs de distribuição',
    },
    {
      slug: 'hub:update',
      name: 'Atualizar HUB Logístico',
      description: 'Editar dados, zonas e posições do HUB',
    },
    {
      slug: 'hub:manage',
      name: 'Gerenciar HUB Logístico',
      description:
        'Gestão completa de infraestrutura logística',
    },
    {
      slug: 'zone:read',
      name: 'Ler Zonas',
      description: 'Visualizar zonas operacionais do HUB',
    },
    {
      slug: 'zone:manage',
      name: 'Gerenciar Zonas',
      description: 'Criar e editar zonas do HUB',
    },
    {
      slug: 'location:read',
      name: 'Ler Posições',
      description: 'Visualizar mapa e posições internas do HUB',
    },
    {
      slug: 'location:manage',
      name: 'Gerenciar Posições',
      description:
        'Criar e configurar posições físicas e capacidade',
    },
    {
      slug: 'inbound:read',
      name: 'Ler Cargas de Entrada',
      description: 'Visualizar ordens de recebimento',
    },
    {
      slug: 'inbound:create',
      name: 'Criar Carga de Entrada',
      description:
        'Registrar nova ordem de recebimento de fornecedor',
    },
    {
      slug: 'inbound:inspect',
      name: 'Inspecionar Carga',
      description:
        'Realizar conferência física e qualidade da carga',
    },
    {
      slug: 'inbound:store',
      name: 'Armazenar Carga',
      description:
        'Endereçar e armazenar carga inspecionada',
    },
    {
      slug: 'transfer:read',
      name: 'Ler Transferências',
      description:
        'Visualizar ordens de transferência entre HUBs',
    },
    {
      slug: 'transfer:create',
      name: 'Criar Transferência',
      description:
        'Solicitar transferência de produtos entre HUBs',
    },
    {
      slug: 'transfer:approve',
      name: 'Aprovar Transferência',
      description:
        'Autorizar envio de transferência entre HUBs',
    },
    {
      slug: 'transfer:ship',
      name: 'Expedir Transferência',
      description:
        'Registrar despacho de transferência entre HUBs',
    },
    {
      slug: 'transfer:receive',
      name: 'Receber Transferência',
      description:
        'Conferir e armazenar transferência recebida',
    },
    {
      slug: 'movement:read',
      name: 'Ler Movimentações',
      description:
        'Consultar histórico de movimentações internas',
    },
    {
      slug: 'movement:create',
      name: 'Criar Movimentação',
      description:
        'Mover itens entre posições físicas do HUB',
    },
    {
      slug: 'cyclecount:read',
      name: 'Ler Inventários Cíclicos',
      description: 'Visualizar ordens de contagem cíclica',
    },
    {
      slug: 'cyclecount:create',
      name: 'Criar Inventário Cíclico',
      description:
        'Agendar ordem de contagem de estoque',
    },
    {
      slug: 'cyclecount:count',
      name: 'Executar Contagem',
      description: 'Lançar contagens de inventário',
    },
    {
      slug: 'cyclecount:adjust',
      name: 'Ajustar Inventário',
      description:
        'Aprovar e aplicar conciliação de divergências no estoque',
    },

    // Sprint 5.2 Fulfillment, Picking, Packing & Shipping permissions
    {
      slug: 'manage_picking',
      name: 'Gerenciar Picking',
      description:
        'Atribuir, executar e gerenciar ordens de picking/separação',
    },
    {
      slug: 'manage_packing',
      name: 'Gerenciar Packing',
      description:
        'Pesar, embalar e conferir pacotes para expedição',
    },
    {
      slug: 'manage_shipping',
      name: 'Gerenciar Expedição',
      description: 'Gerenciar expedição e envios',
    },
    {
      slug: 'print_labels',
      name: 'Imprimir Etiquetas',
      description: 'Gerar e imprimir etiquetas de envio',
    },
    {
      slug: 'manage_manifests',
      name: 'Gerenciar Romaneios',
      description: 'Criar e fechar romaneios de expedição',
    },
    {
      slug: 'picking:read',
      name: 'Ler Ordens de Picking',
      description:
        'Visualizar ordens e lotes de separação',
    },
    {
      slug: 'picking:manage',
      name: 'Gerenciar Ordens de Picking',
      description: 'Gestão completa de separação',
    },
    {
      slug: 'packing:read',
      name: 'Ler Ordens de Packing',
      description: 'Visualizar ordens e embalagens',
    },
    {
      slug: 'packing:manage',
      name: 'Gerenciar Ordens de Packing',
      description: 'Gestão completa de embalagem',
    },

    // Sprint 5.3 Tracking, Carriers & Delivery permissions
    {
      slug: 'carrier:read',
      name: 'Ler Transportadoras',
      description:
        'Visualizar lista e dados de transportadoras',
    },
    {
      slug: 'carrier:manage',
      name: 'Gerenciar Transportadoras',
      description:
        'Criar, editar e configurar contas de transportadoras',
    },
    {
      slug: 'tracking:read:self',
      name: 'Ler Próprio Rastreamento',
      description:
        'Visualizar rastreamento dos próprios pedidos',
    },
    {
      slug: 'tracking:read:store',
      name: 'Ler Rastreamento da Loja',
      description:
        'Visualizar rastreamento dos pedidos das lojas permitidas',
    },
    {
      slug: 'tracking:read:any',
      name: 'Ler Qualquer Rastreamento',
      description: 'Acesso global a rastreamentos',
    },
    {
      slug: 'tracking:event:create',
      name: 'Criar Evento de Rastreamento',
      description:
        'Lançar evento de rastreamento manual',
    },
    {
      slug: 'pickup:read',
      name: 'Ler Coletas',
      description: 'Visualizar solicitações de coleta',
    },
    {
      slug: 'pickup:manage',
      name: 'Gerenciar Coletas',
      description:
        'Agendar e atualizar solicitações de coleta',
    },
    {
      slug: 'delivery:read',
      name: 'Ler Entregas',
      description: 'Visualizar entregas e tentativas',
    },
    {
      slug: 'delivery:manage',
      name: 'Gerenciar Entregas',
      description:
        'Criar entregas e atribuir motoristas',
    },
    {
      slug: 'delivery:complete',
      name: 'Concluir Entrega',
      description:
        'Finalizar entrega mediante validação de POD',
    },
    {
      slug: 'proof_of_delivery:create',
      name: 'Criar Prova de Entrega',
      description: 'Registrar comprovantes de entrega',
    },
    {
      slug: 'proof_of_delivery:read',
      name: 'Ler Prova de Entrega',
      description:
        'Visualizar e gerar URL para provas de entrega',
    },
    {
      slug: 'route:read',
      name: 'Ler Rotas de Entrega',
      description: 'Visualizar rotas e paradas de motoristas',
    },
    {
      slug: 'route:manage',
      name: 'Gerenciar Rotas de Entrega',
      description: 'Criar e atualizar rotas de entrega',
    },
    {
      slug: 'driver:read',
      name: 'Ler Motoristas',
      description: 'Visualizar cadastro de motoristas',
    },
    {
      slug: 'driver:manage',
      name: 'Gerenciar Motoristas',
      description: 'Cadastrar e gerenciar motoristas',
    },
    {
      slug: 'vehicle:read',
      name: 'Ler Veículos',
      description: 'Visualizar frota de veículos',
    },
    {
      slug: 'vehicle:manage',
      name: 'Gerenciar Veículos',
      description: 'Cadastrar e gerenciar veículos',
    },
    {
      slug: 'logistics_exception:read',
      name: 'Ler Exceções Logísticas',
      description:
        'Visualizar ocorrências de extravios e avarias',
    },
    {
      slug: 'logistics_exception:manage',
      name: 'Gerenciar Exceções Logísticas',
      description:
        'Tratar e resolver exceções logísticas',
    },
    {
      slug: 'carrier_webhook:process',
      name: 'Processar Webhooks DLQ',
      description:
        'Gerenciar e reprocessar eventos da DLQ',
    },
  ];

  const permMap: Record<string, string> = {};

  for (const perm of permissions) {
    const created = await prisma.permission.upsert({
      where: { slug: perm.slug },
      update: {
        name: perm.name,
        description: perm.description,
      },
      create: perm,
    });

    permMap[perm.slug] = created.id;
  }

  // 5a. Base RBAC mappings
  const rolePermissionMap: Record<string, string[]> = {
    BUYER: [
      'address:read:self',
      'address:create:self',
      'address:update:self',
      'address:delete:self',
      'cart:manage:self',
      'checkout:create:self',
    ],

    SELLER: [
      'seller:read:self',
      'seller:update:self',
      'kyc:upload:self',
      'kyc:read:self',
    ],

    KYC_ANALYST: [
      'seller:read:any',
      'kyc:read:any',
      'kyc:review',
      'kyc:approve',
    ],

    ADMIN: [
      'seller:read:any',
      'seller:approve',
      'seller:manage',
      'kyc:read:any',
      'kyc:review',
      'kyc:approve',
      'manage_users',
      'manage_sellers',
      'manage_kyc',
      'order:read:any',
    ],

    GLOBAL_ADMIN: [
      'seller:read:any',
      'seller:approve',
      'seller:manage',
      'kyc:read:any',
      'kyc:review',
      'kyc:approve',
      'manage_users',
      'manage_sellers',
      'manage_kyc',
      'manage_products',
      'manage_orders',
      'manage_disputes',
      'manage_warehouse',
      'view_financials',
      'view_audit_logs',
      'moderate_content',
      'order:read:any',
      'coupon:manage:platform',
      'carrier:read',
      'carrier:manage',
      'tracking:read:any',
      'tracking:event:create',
      'logistics_exception:read',
      'logistics_exception:manage',
      'carrier_webhook:process',
    ],
  };

  for (const [roleName, permissionSlugs] of Object.entries(
    rolePermissionMap,
  )) {
    const roleId = roleMap[roleName];

    if (!roleId) {
      throw new Error(
        `Role ${roleName} não encontrada durante o seed.`,
      );
    }

    for (const permissionSlug of permissionSlugs) {
      const permissionId = permMap[permissionSlug];

      if (!permissionId) {
        throw new Error(
          `Permission ${permissionSlug} não encontrada durante o seed.`,
        );
      }

      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId,
            permissionId,
          },
        },
        update: {},
        create: {
          roleId,
          permissionId,
        },
      });
    }
  }

  // 5b. Optional Sprint 5.3 Roles
  const optionalRoles = [
    {
      name: 'DRIVER',
      description: 'Motorista de entregas e coletas',
    },
    {
      name: 'DELIVERY_OPERATOR',
      description:
        'Operador de distribuição e logística local',
    },
    {
      name: 'LOGISTICS_SUPERVISOR',
      description:
        'Supervisor geral de transporte e transportadoras',
    },
  ];

  for (const role of optionalRoles) {
    await prisma.role.upsert({
      where: { name: role.name },
      update: { description: role.description },
      create: role,
    });
  }

  // 6. Categories (Sprint 2 & 3)
  const initialCategories = [
    {
      name: 'Alimentos e Bebidas',
      slug: 'alimentos-e-bebidas',
      description:
        'Produtos alimentícios locais e importados',
    },
    {
      name: 'Eletrônicos',
      slug: 'eletronicos',
      description:
        'Dispositivos eletrônicos e acessórios',
    },
    {
      name: 'Moda e Calçados',
      slug: 'moda-e-calcados',
      description:
        'Roupas, sapatos e acessórios de moda',
    },
    {
      name: 'Casa e Construção',
      slug: 'casa-e-construcao',
      description:
        'Materiais de construção e utensílios domésticos',
    },
    {
      name: 'Saúde e Beleza',
      slug: 'saude-e-beleza',
      description: 'Cosméticos e cuidados pessoais',
    },
  ];

  for (const cat of initialCategories) {
    await prisma.category.upsert({
      where: { slug: cat.slug },
      update: {
        name: cat.name,
        description: cat.description,
      },
      create: {
        ...cat,
        status: 'ACTIVE',
      },
    });
  }

  // 7. Sample Coupon (Development)
  const sampleCoupon = {
    code: 'BENVINDO10',
    name: 'Cupom de Boas Vindas',
    description: '10% de desconto na primeira compra',
    type: 'PERCENTAGE' as any,
    value: 10.0,
    startsAt: new Date(),
    status: 'ACTIVE' as any,
    totalUsageLimit: 1000,
    usageLimitPerUser: 1,
  };

  await prisma.coupon.upsert({
    where: { code: sampleCoupon.code },
    update: {
      name: sampleCoupon.name,
      status: sampleCoupon.status,
    },
    create: sampleCoupon,
  });

  // 8. Internal Carrier Nusali Express (Sprint 5.3)
  const nusaliCarrier = await prisma.carrier.upsert({
    where: { code: 'NUSALI_EXPRESS' },
    update: {
      name: 'Nusali Express Delivery',
      status: 'ACTIVE' as any,
    },
    create: {
      code: 'NUSALI_EXPRESS',
      name: 'Nusali Express Delivery',
      legalName: 'Nusali Logística e Transporte Ltda',
      type: 'NUSALI_INTERNAL' as any,
      status: 'ACTIVE' as any,
      supportsPickup: true,
      supportsDelivery: true,
      supportsInternational: false,
      supportsReturns: true,
    },
  });

  const services = [
    {
      serviceCode: 'STANDARD',
      name: 'Nusali Standard',
      estimatedMinDays: 2,
      estimatedMaxDays: 5,
      mode: 'ROAD' as any,
    },
    {
      serviceCode: 'EXPRESS',
      name: 'Nusali Express Same-Day',
      estimatedMinDays: 1,
      estimatedMaxDays: 2,
      mode: 'MOTORCYCLE' as any,
    },
    {
      serviceCode: 'PICKUP',
      name: 'Coleta em Ponto de Entrega',
      estimatedMinDays: 1,
      estimatedMaxDays: 3,
      mode: 'ROAD' as any,
    },
  ];

  for (const service of services) {
    await prisma.carrierService.upsert({
      where: {
        carrierId_serviceCode: {
          carrierId: nusaliCarrier.id,
          serviceCode: service.serviceCode,
        },
      },
      update: {
        name: service.name,
        estimatedMinDays: service.estimatedMinDays,
        estimatedMaxDays: service.estimatedMaxDays,
      },
      create: {
        carrierId: nusaliCarrier.id,
        serviceCode: service.serviceCode,
        name: service.name,
        estimatedMinDays: service.estimatedMinDays,
        estimatedMaxDays: service.estimatedMaxDays,
        mode: service.mode,
        status: 'ACTIVE' as any,
      },
    });
  }

  console.log('Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });