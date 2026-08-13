import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AdminKycReview } from './admin/AdminKycReview';
import { AdminCategoriesManager } from './admin/AdminCategoriesManager';
import { AdminBrandsManager } from './admin/AdminBrandsManager';
import { AdminOrdersManager } from './admin/AdminOrdersManager';
import { AdminStoresManager } from './admin/AdminStoresManager';
import { AdminWarehousesManager } from './admin/AdminWarehousesManager';
import { AdminUsersManager } from './admin/AdminUsersManager';
import { AdminRolesPermissions } from './admin/AdminRolesPermissions';
import {
  CheckCircle2,
  Clock3,
  FileCheck2,
  History,
  Loader2,
  PackageCheck,
  RefreshCw,
  ShieldCheck,
  Store,
  Truck,
  Users,
  XCircle,
} from 'lucide-react';
import { FulfillmentCoreView } from './admin/FulfillmentCoreView';
import { AdminLogisticsDashboard } from './admin/AdminLogisticsDashboard';
import {
  AdminAuditApi,
  AdminKycApi,
  AdminProductsApi,
  AdminSellersApi,
} from '../api/clients/AdminCoreApi';

type Tab =
  | 'overview'
  | 'products'
  | 'kyc'
  | 'fulfillment'
  | 'logistics'
  | 'audit'
  | 'categories'
  | 'brands'
  | 'stores'
  | 'orders'
  | 'warehouses'
  | 'users'
  | 'access';

const date = (value?: string | null) =>
  value
    ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
    : '—';

const unwrap = (response: any) => {
  const data = response?.data;
  return {
    items: Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [],
    total: Number(data?.total || (Array.isArray(data) ? data.length : 0)),
  };
};

export const AdminDashboardView: React.FC = () => {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('overview');
  const [message, setMessage] = useState<string | null>(null);
  const [productStatus, setProductStatus] = useState('PENDING_REVIEW');
  const [documentStatus, setDocumentStatus] = useState('PENDING');

  const productsQuery = useQuery({
    queryKey: ['admin-core-products', productStatus],
    queryFn: async () =>
      unwrap(
        await AdminProductsApi.list({
          page: 1,
          limit: 100,
          ...(productStatus ? { status: productStatus } : {}),
        }),
      ),
    retry: false,
  });

  const documentsQuery = useQuery({
    queryKey: ['admin-core-kyc-documents', documentStatus],
    queryFn: async () =>
      unwrap(
        await AdminKycApi.listDocuments({
          page: 1,
          limit: 100,
          ...(documentStatus ? { status: documentStatus } : {}),
        }),
      ),
    retry: false,
  });

  const sellersQuery = useQuery({
    queryKey: ['admin-core-sellers'],
    queryFn: async () => unwrap(await AdminSellersApi.list({ page: 1, limit: 100 })),
    retry: false,
  });

  const auditQuery = useQuery({
    queryKey: ['admin-core-audit'],
    queryFn: async () => unwrap(await AdminAuditApi.list(1, 100)),
    retry: false,
  });

  const products = productsQuery.data?.items || [];
  const documents = documentsQuery.data?.items || [];
  const sellers = sellersQuery.data?.items || [];
  const logs = auditQuery.data?.items || [];

  const pendingSellerCount = useMemo(
    () => sellers.filter((seller: any) => !['VERIFIED', 'REJECTED', 'BLOCKED'].includes(seller.status)).length,
    [sellers],
  );

  const invalidate = async (...keys: string[]) => {
    await Promise.all(keys.map((key) => queryClient.invalidateQueries({ queryKey: [key] })));
  };

  const approveProduct = async (id: string) => {
    setMessage(null);
    try {
      await AdminProductsApi.approve(id);
      await invalidate('admin-core-products', 'admin-core-audit');
      setMessage('Produto aprovado no backend e liberado para o catálogo público.');
    } catch (error: any) {
      setMessage(error?.response?.data?.message || error?.message || 'Não foi possível aprovar o produto.');
    }
  };

  const rejectProduct = async (id: string) => {
    const reason = window.prompt('Informe o motivo real da rejeição do anúncio:')?.trim();
    if (!reason) return;
    setMessage(null);
    try {
      await AdminProductsApi.reject(id, reason);
      await invalidate('admin-core-products', 'admin-core-audit');
      setMessage('Produto rejeitado e decisão registrada em auditoria.');
    } catch (error: any) {
      setMessage(error?.response?.data?.message || error?.message || 'Não foi possível rejeitar o produto.');
    }
  };

  const approveDocument = async (id: string) => {
    setMessage(null);
    try {
      await AdminKycApi.approveDocument(id);
      await invalidate('admin-core-kyc-documents', 'admin-core-sellers', 'admin-core-audit');
      setMessage('Documento KYC aprovado no backend.');
    } catch (error: any) {
      setMessage(error?.response?.data?.message || error?.message || 'Não foi possível aprovar o documento.');
    }
  };

  const rejectDocument = async (id: string) => {
    const reason = window.prompt('Informe a justificativa real para rejeitar este documento:')?.trim();
    if (!reason) return;
    setMessage(null);
    try {
      await AdminKycApi.rejectDocument(id, reason);
      await invalidate('admin-core-kyc-documents', 'admin-core-sellers', 'admin-core-audit');
      setMessage('Documento KYC rejeitado no backend.');
    } catch (error: any) {
      setMessage(error?.response?.data?.message || error?.message || 'Não foi possível rejeitar o documento.');
    }
  };

  const approveSeller = async (sellerId: string) => {
    const notes = window.prompt('Notas opcionais da aprovação KYC:') || '';
    setMessage(null);
    try {
      await AdminKycApi.approveSeller(sellerId, notes);
      await invalidate('admin-core-kyc-documents', 'admin-core-sellers', 'admin-core-audit');
      setMessage('KYC completo aprovado. O backend validou os documentos mínimos e concedeu o papel SELLER.');
    } catch (error: any) {
      setMessage(error?.response?.data?.message || error?.message || 'Não foi possível aprovar o vendedor.');
    }
  };

  const rejectSeller = async (sellerId: string) => {
    const reason = window.prompt('Informe o motivo real da rejeição KYC do vendedor:')?.trim();
    if (!reason) return;
    setMessage(null);
    try {
      await AdminKycApi.rejectSeller(sellerId, reason);
      await invalidate('admin-core-kyc-documents', 'admin-core-sellers', 'admin-core-audit');
      setMessage('KYC do vendedor rejeitado no backend.');
    } catch (error: any) {
      setMessage(error?.response?.data?.message || error?.message || 'Não foi possível rejeitar o vendedor.');
    }
  };

  const refresh = async () => {
    await invalidate(
      'admin-core-products',
      'admin-core-kyc-documents',
      'admin-core-sellers',
      'admin-core-audit',
    );
  };

  const loading =
    productsQuery.isLoading ||
    documentsQuery.isLoading ||
    sellersQuery.isLoading ||
    auditQuery.isLoading;

  if (loading) {
    return (
      <div className="min-h-[65vh] flex items-center justify-center text-emerald-700">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  const tabs: Array<{
    id: Tab;
    label: string;
    icon: React.ReactNode;
  }> = [
    {
      id: 'overview',
      label: 'Resumo',
      icon: <ShieldCheck className="w-4 h-4" />,
    },
    {
      id: 'kyc',
      label: 'KYC & Vendedores',
      icon: <FileCheck2 className="w-4 h-4" />,
    },
    {
      id: 'stores',
      label: 'Lojas',
      icon: <Store className="w-4 h-4" />,
    },
    {
      id: 'products',
      label: 'Produtos',
      icon: <PackageCheck className="w-4 h-4" />,
    },
    {
      id: 'categories',
      label: 'Categorias',
      icon: <PackageCheck className="w-4 h-4" />,
    },
    {
      id: 'brands',
      label: 'Marcas',
      icon: <Store className="w-4 h-4" />,
    },
    {
      id: 'orders',
      label: 'Pedidos',
      icon: <PackageCheck className="w-4 h-4" />,
    },
    {
      id: 'warehouses',
      label: 'Armazéns',
      icon: <PackageCheck className="w-4 h-4" />,
    },
    {
      id: 'fulfillment',
      label: 'Fulfillment',
      icon: <PackageCheck className="w-4 h-4" />,
    },
    {
      id: 'logistics',
      label: 'Logística',
      icon: <Truck className="w-4 h-4" />,
    },
    {
      id: 'users',
      label: 'Usuários',
      icon: <Users className="w-4 h-4" />,
    },
    {
      id: 'access',
      label: 'Roles & Permissões',
      icon: <ShieldCheck className="w-4 h-4" />,
    },
    {
      id: 'audit',
      label: 'Auditoria',
      icon: <History className="w-4 h-4" />,
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="bg-slate-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl mb-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div>
            <div className="inline-flex items-center gap-2 text-emerald-300 text-xs font-black mb-2">
              <ShieldCheck className="w-4 h-4" /> ADMIN CORE REAL
            </div>
            <h1 className="text-2xl font-black">Operação & Moderação Mercado Nusali</h1>
            <p className="text-xs text-slate-400 mt-2 max-w-3xl">
              Apenas módulos administrativos ligados a contratos reais estão habilitados aqui:
              moderação de produtos, KYC de vendedores e auditoria.
            </p>
          </div>
          <button onClick={() => void refresh()} className="bg-slate-900 border border-slate-700 p-2.5 rounded-xl" title="Atualizar">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto mb-6">
        {tabs.map((item) => (
          <button
            key={item.id}
            onClick={() => setTab(item.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black border whitespace-nowrap ${
              tab === item.id
                ? 'bg-emerald-600 text-white border-emerald-600'
                : 'bg-white text-gray-600 border-gray-200'
            }`}
          >
            {item.icon}{item.label}
          </button>
        ))}
      </div>

      {message && (
        <div className="mb-6 bg-blue-50 border border-blue-200 text-blue-900 rounded-xl px-4 py-3 text-xs font-semibold">
          {message}
        </div>
      )}

      {tab === 'overview' && (
        <div className="space-y-6">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border rounded-2xl p-5">
              <div className="text-xs text-gray-500">Produtos na fila atual</div>
              <div className="text-3xl font-black mt-1">{products.length}</div>
            </div>
            <div className="bg-white border rounded-2xl p-5">
              <div className="text-xs text-gray-500">Documentos KYC na fila atual</div>
              <div className="text-3xl font-black mt-1">{documents.length}</div>
            </div>
            <div className="bg-white border rounded-2xl p-5">
              <div className="text-xs text-gray-500">Vendedores cadastrados</div>
              <div className="text-3xl font-black mt-1">{sellers.length}</div>
            </div>
            <div className="bg-white border rounded-2xl p-5">
              <div className="text-xs text-gray-500">Vendedores pendentes</div>
              <div className="text-3xl font-black mt-1">{pendingSellerCount}</div>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 text-xs text-amber-900 flex gap-3">
            <Clock3 className="w-5 h-5 shrink-0" />
            <div>
              Financeiro, risco, suporte, disputas, marketing, países/regiões e demais painéis administrativos
              continuam fora deste Admin Core enquanto ainda dependerem de mocks ou contratos não comprovados.
            </div>
          </div>
        </div>
      )}

      {tab === 'products' && (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <div className="p-5 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="font-black text-gray-900">Moderação real de produtos</h2>
              <p className="text-xs text-gray-500 mt-1">Aprovação exige variante e imagem principal no backend.</p>
            </div>
            <select value={productStatus} onChange={(e) => setProductStatus(e.target.value)} className="border rounded-xl px-3 py-2 text-xs bg-white">
              <option value="PENDING_REVIEW">PENDING_REVIEW</option>
              <option value="APPROVED">APPROVED</option>
              <option value="REJECTED">REJECTED</option>
              <option value="">Todos</option>
            </select>
          </div>
          {!products.length ? (
            <div className="p-10 text-center text-sm text-gray-500">Nenhum produto nesta fila.</div>
          ) : (
            <div className="divide-y">
              {products.map((product: any) => (
                <div key={product.id} className="p-5 grid lg:grid-cols-[1fr_auto] gap-4">
                  <div>
                    <div className="font-black text-gray-900">{product.title}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      {product.store?.name || product.storeId} • {product.category?.name || 'Sem categoria'} • {product.status}
                    </div>
                    <div className="text-[11px] text-gray-400 mt-1">
                      {product.variants?.length || 0} variante(s) • {product.images?.length || 0} imagem(ns) • {date(product.createdAt)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {product.status === 'PENDING_REVIEW' && (
                      <>
                        <button onClick={() => void rejectProduct(product.id)} className="px-3 py-2 border border-red-200 text-red-700 rounded-xl text-xs font-bold flex items-center gap-1">
                          <XCircle className="w-4 h-4" /> Rejeitar
                        </button>
                        <button onClick={() => void approveProduct(product.id)} className="px-3 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-4 h-4" /> Aprovar
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'kyc' && (
        <AdminKycReview
          showToast={setMessage}
        />
      )}

      {tab === 'fulfillment' && (
        <FulfillmentCoreView showToast={setMessage} />
      )}

      {tab === 'logistics' && (
        <AdminLogisticsDashboard
          showToast={setMessage}
        />
      )}

      {tab === 'categories' && (
        <AdminCategoriesManager
          showToast={setMessage}
        />
      )}

      {tab === 'brands' && (
        <AdminBrandsManager
          showToast={setMessage}
        />
      )}

      {tab === 'stores' && (
        <AdminStoresManager
          showToast={setMessage}
        />
      )}

      {tab === 'orders' && (
        <AdminOrdersManager
          showToast={setMessage}
        />
      )}

      {tab === 'warehouses' && (
        <AdminWarehousesManager
          showToast={setMessage}
        />
      )}

      {tab === 'users' && (
        <AdminUsersManager
          showToast={setMessage}
        />
      )}

      {tab === 'access' && (
        <AdminRolesPermissions
          showToast={setMessage}
        />
      )}

      {tab === 'audit' && (
        <div className="bg-white border rounded-2xl overflow-hidden">
          <div className="p-5 border-b">
            <h2 className="font-black text-gray-900">Logs reais de auditoria</h2>
            <p className="text-xs text-gray-500 mt-1">Últimos registros persistidos no PostgreSQL.</p>
          </div>
          {!logs.length ? (
            <div className="p-10 text-center text-sm text-gray-500">Nenhum log encontrado.</div>
          ) : (
            <div className="divide-y">
              {logs.map((log: any) => (
                <div key={log.id} className="p-4 grid md:grid-cols-4 gap-3 text-xs">
                  <div><span className="text-gray-400 block">Data</span><strong>{date(log.createdAt)}</strong></div>
                  <div><span className="text-gray-400 block">Ação</span><strong>{log.action}</strong></div>
                  <div><span className="text-gray-400 block">Entidade</span><strong>{log.entity || '—'} {log.entityId || ''}</strong></div>
                  <div><span className="text-gray-400 block">Usuário</span><strong>{log.user?.email || log.userId || 'Sistema'}</strong></div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
