import { ApiResponse } from '../apiClient';
import { Product, Order, Category, Dispute, Warehouse, User, Seller, Store, AuthSession, UserRole } from '../../types';
import { mockProducts, mockCategories, mockOrders, mockBrands } from '../../data/mockData';
import { mockSellerProfile, mockSellerProducts, mockSellerOrders, mockSellerFinancialStats } from '../../data/mockSellerData';
import { mockAdminUsersList } from '../../data/mockAdminUsers';
import { mockAdminSellersList } from '../../data/mockAdminSellers';
import { mockAdminKycList } from '../../data/mockAdminKyc';

const delay = (ms = 150) => new Promise(resolve => setTimeout(resolve, ms));

// Internal stateful storage for fake API runtime mutations
let productsDb = [...mockProducts];
let ordersDb = [...mockOrders];
let categoriesDb = [...mockCategories];
let usersDb = [...mockAdminUsersList];
let sellersDb = [...mockAdminSellersList];
let kycDb = [...mockAdminKycList];

let failedLoginAttemptsMap: Record<string, number> = {};

let activeSessionsDb: AuthSession[] = [
  {
    id: 'sess-1',
    device: 'Chrome no macOS (Bissau, GW)',
    ip: '197.214.42.10',
    location: 'Bissau, Guiné-Bissau',
    lastActive: 'Agora mesmo',
    isCurrent: true,
  },
  {
    id: 'sess-2',
    device: 'App Mercado Nusali Android (Lisboa, PT)',
    ip: '85.240.112.5',
    location: 'Lisboa, Portugal',
    lastActive: 'Há 2 horas',
    isCurrent: false,
  },
  {
    id: 'sess-3',
    device: 'Safari no iPhone (São Paulo, BR)',
    ip: '177.18.220.14',
    location: 'São Paulo, Brasil',
    lastActive: 'Ontem às 18:40',
    isCurrent: false,
  },
];

export const fakeApi = {
  // Auth
  async login(identifier: string, role = 'BUYER', password?: string): Promise<ApiResponse<{ token: string; refreshToken: string; user: User }>> {
    await delay();
    const cleanId = identifier.toLowerCase().trim();

    // Track failed attempts simulation
    const currentAttempts = failedLoginAttemptsMap[cleanId] || 0;
    if (currentAttempts >= 3 && !cleanId.includes('reset')) {
      return {
        success: false,
        error: {
          code: 'TOO_MANY_ATTEMPTS',
          message: 'Muitas tentativas malsucedidas. Sua conta foi bloqueada temporariamente por 30 segundos para sua proteção.',
        },
      };
    }

    if (cleanId.includes('suspended')) {
      return {
        success: false,
        error: {
          code: 'ACCOUNT_SUSPENDED',
          message: 'Sua conta do Mercado Nusali está suspensa por violação dos termos de serviço. Entre em contato com a ouvidoria.',
        },
      };
    }

    if (cleanId.includes('blocked')) {
      return {
        success: false,
        error: {
          code: 'ACCOUNT_BLOCKED',
          message: 'Esta conta foi bloqueada preventivamente por suspeita de acesso não autorizado.',
        },
      };
    }

    if (cleanId === 'invalido@nusali.com' || password === 'errada') {
      failedLoginAttemptsMap[cleanId] = (failedLoginAttemptsMap[cleanId] || 0) + 1;
      return {
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'E-mail, telefone ou senha incorretos. Por favor, verifique seus dados.',
        },
      };
    }

    // Reset attempts on success
    failedLoginAttemptsMap[cleanId] = 0;

    const isUnverified = cleanId.includes('unverified') || cleanId.includes('naoverificado');

    let resolvedRole: UserRole = (role as UserRole) || 'BUYER';
    if (cleanId.includes('admin')) resolvedRole = 'ADMIN';
    if (cleanId.includes('vendedor') || cleanId.includes('seller')) resolvedRole = 'SELLER';

    const mockUser: User = {
      id: 'usr_' + Math.floor(100000 + Math.random() * 900000),
      name: cleanId.includes('@') ? cleanId.split('@')[0].toUpperCase() : 'Usuário Nusali',
      email: cleanId.includes('@') ? cleanId : `${cleanId}@nusali.cplp`,
      phone: cleanId.includes('@') ? '+245 955 123 456' : cleanId,
      role: resolvedRole,
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
      country: 'GW',
      createdAt: new Date().toISOString(),
      isEmailVerified: !isUnverified,
      isPhoneVerified: !isUnverified,
      status: 'active',
      sellerId: resolvedRole === 'SELLER' ? 'seller_001' : undefined,
    };

    return {
      success: true,
      data: {
        token: 'fake_jwt_token_nusali_cplp_' + Date.now(),
        refreshToken: 'fake_refresh_token_nusali_' + Date.now(),
        user: mockUser,
      },
      message: 'Autenticado com sucesso no Mercado Nusali',
    };
  },

  async register(data: any): Promise<ApiResponse<{ token: string; refreshToken: string; user: User }>> {
    await delay();
    const isSeller = data.role === 'SELLER';
    const fullName = `${data.firstName || ''} ${data.lastName || ''}`.trim() || 'Novo Usuário';

    const newUser: User = {
      id: 'usr_' + Date.now(),
      name: fullName,
      email: data.email || 'usuario@nusali.cplp',
      phone: data.phoneCode ? `${data.phoneCode} ${data.phone}` : data.phone || '+245 955000111',
      role: isSeller ? 'SELLER' : 'BUYER',
      country: data.country || 'GW',
      createdAt: new Date().toISOString(),
      isEmailVerified: false, // Requires email verification step
      isPhoneVerified: false, // Requires phone verification step
      status: 'active',
      sellerId: isSeller ? 'seller_' + Date.now() : undefined,
    };

    usersDb.push(newUser as any);

    return {
      success: true,
      data: {
        token: 'fake_jwt_token_nusali_cplp_' + Date.now(),
        refreshToken: 'fake_refresh_token_nusali_' + Date.now(),
        user: newUser,
      },
      message: 'Conta registrada com sucesso! Verifique seu e-mail e telefone para ativar todas as funcionalidades.',
    };
  },

  async getMe(): Promise<ApiResponse<User>> {
    await delay();
    return {
      success: true,
      data: {
        id: 'usr_001',
        name: 'Bacai Sanhá',
        email: 'bacai.sanha@nusali.cplp',
        phone: '+245 955 888 777',
        role: 'BUYER',
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
        country: 'GW',
        createdAt: '2025-01-10T00:00:00Z',
        isEmailVerified: true,
        isPhoneVerified: true,
        status: 'active',
      },
    };
  },

  async forgotPassword(identifier: string, method = 'email'): Promise<ApiResponse<{ message: string; methodSent: string }>> {
    await delay();
    return {
      success: true,
      data: {
        message: 'Se os dados informados estiverem cadastrados, enviaremos as instruções de recuperação.',
        methodSent: method,
      },
    };
  },

  async resetPassword(newPassword: string, tokenOrCode?: string): Promise<ApiResponse<{ message: string }>> {
    await delay();
    if (tokenOrCode === '000000' || tokenOrCode === 'invalido') {
      return {
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'O código de recuperação é inválido ou expirou. Solicite um novo código.',
        },
      };
    }
    return {
      success: true,
      data: {
        message: 'Sua senha foi redefinida com sucesso. Faça login com sua nova credencial.',
      },
    };
  },

  async verifyEmail(code: string): Promise<ApiResponse<{ user: User; message: string }>> {
    await delay();
    if (code === '000000') {
      return {
        success: false,
        error: {
          code: 'INVALID_CODE',
          message: 'Código de e-mail inválido. Verifique os 6 dígitos digitados.',
        },
      };
    }
    if (code === '999999') {
      return {
        success: false,
        error: {
          code: 'CODE_EXPIRED',
          message: 'O código de verificação expirou. Clique em reenviar código.',
        },
      };
    }
    return {
      success: true,
      data: {
        user: {
          id: 'usr_001',
          name: 'Bacai Sanhá',
          email: 'bacai.sanha@nusali.cplp',
          role: 'BUYER',
          country: 'GW',
          createdAt: new Date().toISOString(),
          isEmailVerified: true,
          isPhoneVerified: true,
          status: 'active',
        },
        message: 'E-mail verificado com sucesso!',
      },
    };
  },

  async verifyPhone(code: string): Promise<ApiResponse<{ user: User; message: string }>> {
    await delay();
    if (code === '000000') {
      return {
        success: false,
        error: {
          code: 'INVALID_CODE',
          message: 'Código SMS/WhatsApp inválido. Digite novamente.',
        },
      };
    }
    return {
      success: true,
      data: {
        user: {
          id: 'usr_001',
          name: 'Bacai Sanhá',
          email: 'bacai.sanha@nusali.cplp',
          role: 'BUYER',
          country: 'GW',
          createdAt: new Date().toISOString(),
          isEmailVerified: true,
          isPhoneVerified: true,
          status: 'active',
        },
        message: 'Telefone verificado com sucesso!',
      },
    };
  },

  async resendVerification(type: 'email' | 'phone'): Promise<ApiResponse<{ message: string }>> {
    await delay();
    return {
      success: true,
      data: {
        message: type === 'email' ? 'Novo código enviado para seu e-mail.' : 'Novo código SMS enviado para seu telefone.',
      },
    };
  },

  async changePassword(currentPassword: string, newPassword: string): Promise<ApiResponse<{ message: string }>> {
    await delay();
    if (currentPassword === 'errada') {
      return {
        success: false,
        error: {
          code: 'WRONG_PASSWORD',
          message: 'A senha atual informada está incorreta.',
        },
      };
    }
    return {
      success: true,
      data: {
        message: 'Senha alterada com sucesso! Suas outras sessões foram atualizadas.',
      },
    };
  },

  async getSessions(): Promise<ApiResponse<AuthSession[]>> {
    await delay();
    return {
      success: true,
      data: activeSessionsDb,
    };
  },

  async revokeSession(id: string): Promise<ApiResponse<{ message: string }>> {
    await delay();
    activeSessionsDb = activeSessionsDb.filter(s => s.id !== id);
    return {
      success: true,
      data: { message: 'Sessão encerrada com sucesso.' },
    };
  },

  async revokeAllOtherSessions(): Promise<ApiResponse<{ message: string }>> {
    await delay();
    activeSessionsDb = activeSessionsDb.filter(s => s.isCurrent);
    return {
      success: true,
      data: { message: 'Todas as outras sessões foram encerradas.' },
    };
  },

  // Products
  async getProducts(params?: any): Promise<ApiResponse<Product[]>> {
    await delay();
    let result = [...productsDb];
    if (params?.category && params.category !== 'all') {
      result = result.filter(p => p.categorySlug === params.category || p.category === params.category);
    }
    if (params?.query) {
      const q = params.query.toLowerCase();
      result = result.filter(p => p.title.toLowerCase().includes(q) || p.description.toLowerCase().includes(q));
    }
    if (params?.country && params.country !== 'all') {
      result = result.filter(p => p.shipping?.originCountry === params.country);
    }
    return {
      success: true,
      data: result,
      meta: { total: result.length, page: 1, limit: 50 },
    };
  },

  async getProductById(id: string): Promise<ApiResponse<Product | null>> {
    await delay();
    const item = productsDb.find(p => p.id === id) || null;
    return {
      success: true,
      data: item,
    };
  },

  async getCategories(): Promise<ApiResponse<Category[]>> {
    await delay();
    return {
      success: true,
      data: categoriesDb,
    };
  },

  async getBrands(): Promise<ApiResponse<string[]>> {
    await delay();
    return {
      success: true,
      data: mockBrands,
    };
  },

  // Orders
  async getOrders(): Promise<ApiResponse<Order[]>> {
    await delay();
    return {
      success: true,
      data: ordersDb,
    };
  },

  async getOrderById(id: string): Promise<ApiResponse<Order | null>> {
    await delay();
    const order = ordersDb.find(o => o.id === id) || null;
    return {
      success: true,
      data: order,
    };
  },

  async createOrder(orderData: Partial<Order>): Promise<ApiResponse<Order>> {
    await delay();
    const newOrder: Order = {
      id: 'ORD-' + Math.floor(1000 + Math.random() * 9000),
      date: new Date().toLocaleDateString('pt-BR'),
      items: orderData.items || [],
      subtotal: orderData.subtotal || 0,
      shippingFee: orderData.shippingFee || 0,
      customsDuty: orderData.customsDuty || 0,
      discount: orderData.discount || 0,
      total: orderData.total || 0,
      currency: orderData.currency || 'XOF',
      deliveryAddress: orderData.deliveryAddress || ({} as any),
      paymentDetails: orderData.paymentDetails || ({} as any),
      status: 'confirmed',
      escrow: {
        status: 'retained',
        amountRetained: orderData.total || 0,
        currency: orderData.currency || 'XOF',
        retainedAt: new Date().toISOString(),
        releaseEligibleAt: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
      },
      estimatedDelivery: '3 a 5 dias úteis',
      trackingCode: 'NSL-GW-' + Math.floor(100000 + Math.random() * 900000),
      carrierName: 'Nusali Express Bissau',
      trackingSteps: [
        {
          status: 'confirmed',
          title: 'Pedido Confirmado',
          description: 'Pagamento retido com segurança no Nusali Escrow',
          timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
          completed: true,
        },
      ],
      originCountry: 'GW',
      destinationCountry: 'GW',
    };
    ordersDb.unshift(newOrder);
    return {
      success: true,
      data: newOrder,
      message: 'Pedido criado com sucesso! Código de rastreamento gerado.',
    };
  },

  // Seller
  async getSellerProfile(): Promise<ApiResponse<typeof mockSellerProfile>> {
    await delay();
    return {
      success: true,
      data: mockSellerProfile,
    };
  },

  async getSellerProducts(): Promise<ApiResponse<typeof mockSellerProducts>> {
    await delay();
    return {
      success: true,
      data: mockSellerProducts,
    };
  },

  async getSellerOrders(): Promise<ApiResponse<typeof mockSellerOrders>> {
    await delay();
    return {
      success: true,
      data: mockSellerOrders,
    };
  },

  async getSellerFinancials(): Promise<ApiResponse<typeof mockSellerFinancialStats>> {
    await delay();
    return {
      success: true,
      data: mockSellerFinancialStats,
    };
  },
};
