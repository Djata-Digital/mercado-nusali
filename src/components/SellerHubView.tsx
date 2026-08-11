import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Building2,
  CheckCircle2,
  Clock3,
  Loader2,
  Package,
  RefreshCw,
  ShieldCheck,
  ShoppingBag,
  Store as StoreIcon,
} from 'lucide-react';
import { SellerApi } from '../api/clients/SellerApi';
import { StoresApi } from '../api/clients/StoresApi';
import { ProductsApi } from '../api/clients/ProductsApi';
import { OrdersApi } from '../api/clients/OrdersApi';
import { SellerProductWizard } from './seller/SellerProductWizard';
import { SellerOnboardingForm } from './seller/SellerOnboardingForm';

type Section = 'overview' | 'products' | 'orders' | 'account';

const money = (value: string | number, currency = 'XOF') =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(Number(value || 0));

const date = (value?: string) =>
  value
    ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
    : '—';

const statusLabel: Record<string, string> = {
  DRAFT: 'Rascunho',
  PENDING_REVIEW: 'Em análise',
  APPROVED: 'Aprovado',
  ACTIVE: 'Ativo',
  PAUSED: 'Pausado',
  REJECTED: 'Rejeitado',
  ARCHIVED: 'Arquivado',
  PENDING_PAYMENT: 'Aguardando pagamento',
  PAID: 'Pago',
  CONFIRMED: 'Confirmado',
  PREPARING: 'Em preparação',
  READY_FOR_SHIPMENT: 'Pronto para expedição',
  SHIPPED: 'Enviado',
  IN_TRANSIT: 'Em trânsito',
  DELIVERED: 'Entregue',
  CANCELLED: 'Cancelado',
};

export const SellerHubView: React.FC = () => {
  const queryClient = useQueryClient();
  const [section, setSection] = useState<Section>('overview');
  const [selectedStoreId, setSelectedStoreId] = useState('');
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [isAuthoringProduct, setIsAuthoringProduct] = useState(false);

  const profileQuery = useQuery({
    queryKey: ['seller-profile-real'],
    queryFn: async () => (await SellerApi.getMyProfile()).data,
    retry: false,
  });

  const storesQuery = useQuery({
    queryKey: ['seller-stores-real'],
    queryFn: async () => (await StoresApi.listMine()).data || [],
    retry: false,
  });

  const productsQuery = useQuery({
    queryKey: ['seller-products-real'],
    queryFn: async () => {
      const response = await ProductsApi.listMine({ page: 1, limit: 100 } as any);
      const data: any = response.data;
      return Array.isArray(data?.items) ? data.items : [];
    },
    retry: false,
  });

  const ordersQuery = useQuery({
    queryKey: ['seller-orders-real', selectedStoreId],
    queryFn: async () => (await OrdersApi.listSeller(selectedStoreId || undefined)).data || [],
    retry: false,
  });

  const stores = storesQuery.data || [];
  const products = productsQuery.data || [];
  const orders = ordersQuery.data || [];
  const profile = profileQuery.data;

  const selectedStore = useMemo(
    () => stores.find((store: any) => store.id === selectedStoreId) || stores[0],
    [stores, selectedStoreId],
  );

  React.useEffect(() => {
    if (!selectedStoreId && stores[0]?.id) setSelectedStoreId(stores[0].id);
  }, [stores, selectedStoreId]);

  const reload = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['seller-profile-real'] }),
      queryClient.invalidateQueries({ queryKey: ['seller-stores-real'] }),
      queryClient.invalidateQueries({ queryKey: ['seller-products-real'] }),
      queryClient.invalidateQueries({ queryKey: ['seller-orders-real'] }),
    ]);
  };

  const productAction = async (id: string, action: 'submit' | 'pause' | 'activate' | 'delete') => {
    setActionMessage(null);
    try {
      if (action === 'submit') await ProductsApi.submit(id);
      if (action === 'pause') await ProductsApi.pause(id);
      if (action === 'activate') await ProductsApi.activate(id);
      if (action === 'delete') await ProductsApi.delete(id);
      await queryClient.invalidateQueries({ queryKey: ['seller-products-real'] });
      setActionMessage('Produto atualizado no backend com sucesso.');
    } catch (error: any) {
      setActionMessage(error?.response?.data?.message || error?.message || 'Não foi possível atualizar o produto.');
    }
  };

  const loading =
    profileQuery.isLoading ||
    storesQuery.isLoading ||
    productsQuery.isLoading ||
    ordersQuery.isLoading;

  if (loading) {
    return <div className="min-h-[60vh] flex items-center justify-center text-emerald-700"><Loader2 className="w-8 h-8 animate-spin" /></div>;
  }

  if (profileQuery.isError || !profile) {
    const status = (profileQuery.error as any)?.response?.status;

    if (status === 404) {
      return (
        <SellerOnboardingForm
          onCreated={async () => {
            await queryClient.invalidateQueries({
              queryKey: ['seller-profile-real'],
            });

            await profileQuery.refetch();
          }}
        />
      );
    }

    return (
      <div className="max-w-3xl mx-auto p-8 text-center bg-white border border-gray-200 rounded-2xl mt-10">
        <ShieldCheck className="w-14 h-14 text-red-400 mx-auto mb-4" />

        <h1 className="text-xl font-black text-gray-900">
          Não foi possível carregar o perfil
        </h1>

        <p className="text-sm text-gray-500 mt-2">
          O Mercado Nusali não conseguiu consultar seu perfil de
          vendedor neste momento.
        </p>

        <button
          type="button"
          onClick={() => void profileQuery.refetch()}
          className="mt-5 px-5 py-3 bg-emerald-600 text-white rounded-xl text-xs font-black"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  const nav: Array<{ id: Section; label: string; icon: React.ReactNode }> = [
    { id: 'overview', label: 'Resumo', icon: <Building2 className="w-4 h-4" /> },
    { id: 'products', label: 'Produtos', icon: <Package className="w-4 h-4" /> },
    { id: 'orders', label: 'Pedidos', icon: <ShoppingBag className="w-4 h-4" /> },
    { id: 'account', label: 'Conta e lojas', icon: <StoreIcon className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-slate-950 text-white border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-black">{profile.tradeName || profile.legalName}</h1>
              <span className="text-[10px] font-black px-2 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                {profile.status}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Seller Core conectado ao backend real do Mercado Nusali.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {stores.length > 0 && (
              <select
                value={selectedStore?.id || ''}
                onChange={(e) => setSelectedStoreId(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold"
              >
                {stores.map((store: any) => (
                  <option key={store.id} value={store.id}>
                    {store.name} — {store.status}
                  </option>
                ))}
              </select>
            )}
            <button onClick={() => void reload()} className="p-2.5 rounded-xl bg-slate-900 border border-slate-700" title="Atualizar">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex gap-2 overflow-x-auto mb-6">
          {nav.map((item) => (
            <button
              key={item.id}
              onClick={() => setSection(item.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black whitespace-nowrap border ${
                section === item.id
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-emerald-300'
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>

        {actionMessage && (
          <div className="mb-5 bg-blue-50 border border-blue-200 text-blue-900 rounded-xl px-4 py-3 text-xs font-semibold">
            {actionMessage}
          </div>
        )}

        {isAuthoringProduct && selectedStore ? (
          <SellerProductWizard
            storeId={selectedStore.id}
            storeCountryCode={selectedStore.country?.code || ''}
            onCancel={() => setIsAuthoringProduct(false)}
            onComplete={async () => {
              setIsAuthoringProduct(false);
              await queryClient.invalidateQueries({ queryKey: ['seller-products-real'] });
              setSection('products');
              setActionMessage('Produto enviado para moderação com dados reais.');
            }}
          />
        ) : section === 'overview' && (
          <div className="space-y-6">
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white border border-gray-200 rounded-2xl p-5">
                <div className="text-xs text-gray-500">Lojas cadastradas</div>
                <div className="text-3xl font-black text-gray-900 mt-1">{stores.length}</div>
              </div>
              <div className="bg-white border border-gray-200 rounded-2xl p-5">
                <div className="text-xs text-gray-500">Produtos cadastrados</div>
                <div className="text-3xl font-black text-gray-900 mt-1">{products.length}</div>
              </div>
              <div className="bg-white border border-gray-200 rounded-2xl p-5">
                <div className="text-xs text-gray-500">Pedidos reais</div>
                <div className="text-3xl font-black text-gray-900 mt-1">{orders.length}</div>
              </div>
              <div className="bg-white border border-gray-200 rounded-2xl p-5">
                <div className="text-xs text-gray-500">Vendas registradas</div>
                <div className="text-3xl font-black text-gray-900 mt-1">{profile.totalSales || 0}</div>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl p-6">
              <h2 className="font-black text-gray-900">Estado comercial</h2>
              <div className="grid sm:grid-cols-2 gap-4 mt-4 text-xs">
                <div className="p-4 bg-gray-50 rounded-xl">
                  <div className="text-gray-500">Vendedor</div>
                  <div className="font-black mt-1">{profile.status}</div>
                </div>
                <div className="p-4 bg-gray-50 rounded-xl">
                  <div className="text-gray-500">Avaliação registrada</div>
                  <div className="font-black mt-1">{Number(profile.averageRating || 0).toFixed(1)} ({profile.totalReviews || 0})</div>
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-4">
                Não são exibidos receita, saldo, escrow, gráficos ou metas enquanto esses agregados não estiverem conectados a APIs reais.
              </p>
            </div>
          </div>
        )}

        {section === 'products' && (
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <div className="p-5 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="font-black text-gray-900">Produtos reais ({products.length})</h2>
                <p className="text-xs text-gray-500 mt-1">Dados de GET /products/me, com cadastro real de variante, imagem e estoque.</p>
              </div>
              <button onClick={() => setIsAuthoringProduct(true)} className="bg-emerald-600 text-white px-4 py-2.5 rounded-xl text-xs font-black">Cadastrar produto</button>
            </div>

            {!products.length ? (
              <div className="p-10 text-center text-sm text-gray-500">Nenhum produto cadastrado.</div>
            ) : (
              <div className="divide-y divide-gray-100">
                {products.map((product: any) => (
                  <div key={product.id} className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="font-bold text-gray-900">{product.title}</div>
                      <div className="text-xs text-gray-500 mt-1">
                        {product.store?.name || 'Loja'} • {product.category?.name || 'Sem categoria'} • {statusLabel[product.status] || product.status}
                      </div>
                      <div className="text-[11px] text-gray-400 mt-1">
                        {product.variants?.length || 0} variante(s) • criado {date(product.createdAt)}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs font-bold">
                      {product.status === 'DRAFT' && (
                        <button onClick={() => void productAction(product.id, 'submit')} className="px-3 py-2 bg-blue-600 text-white rounded-lg">
                          Enviar para análise
                        </button>
                      )}
                      {product.status === 'APPROVED' && (
                        <button onClick={() => void productAction(product.id, 'pause')} className="px-3 py-2 bg-amber-100 text-amber-900 rounded-lg">
                          Pausar
                        </button>
                      )}
                      {product.status === 'PAUSED' && (
                        <button onClick={() => void productAction(product.id, 'activate')} className="px-3 py-2 bg-emerald-600 text-white rounded-lg">
                          Reativar
                        </button>
                      )}
                      <button onClick={() => void productAction(product.id, 'delete')} className="px-3 py-2 border border-red-200 text-red-700 rounded-lg">
                        Arquivar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {section === 'orders' && (
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <div className="p-5 border-b border-gray-200">
              <h2 className="font-black text-gray-900">Pedidos reais ({orders.length})</h2>
              <p className="text-xs text-gray-500 mt-1">Pedidos reais da loja. Status de picking, packing, READY_FOR_SHIPMENT e SHIPPED são atualizados pelo fulfillment/logística, não manualmente pelo Seller.</p>
            </div>

            {!orders.length ? (
              <div className="p-10 text-center text-sm text-gray-500">Nenhum pedido encontrado.</div>
            ) : (
              <div className="divide-y divide-gray-100">
                {orders.map((order: any) => (
                  <div key={order.id} className="p-5 grid lg:grid-cols-[1fr_1fr_1fr_1fr_auto] gap-4 text-xs lg:items-center">
                    <div>
                      <div className="text-gray-500">Pedido</div>
                      <div className="font-black text-gray-900 mt-1">{order.orderNumber}</div>
                      <div className="text-gray-400 mt-1">{date(order.createdAt)}</div>
                    </div>
                    <div>
                      <div className="text-gray-500">Cliente</div>
                      <div className="font-bold text-gray-900 mt-1">{order.user?.name || order.user?.email || 'Cliente'}</div>
                    </div>
                    <div>
                      <div className="text-gray-500">Status</div>
                      <div className="font-black text-emerald-800 mt-1">{statusLabel[order.status] || order.status}</div>
                    </div>
                    <div>
                      <div className="text-gray-500">Total persistido</div>
                      <div className="font-black text-gray-900 mt-1">
                        {money(order.total, order.priceSnapshotRelation?.currencyCode || 'XOF')}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 lg:justify-end">
                      {order.status === 'PENDING_PAYMENT' && (
                        <span className="px-3 py-2 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg font-bold">
                          Aguardando pagamento
                        </span>
                      )}
                      {order.status === 'PAID' && (
                        <span className="px-3 py-2 bg-blue-50 border border-blue-200 text-blue-800 rounded-lg font-bold">
                          Aguardando fulfillment
                        </span>
                      )}
                      {['PREPARING', 'READY_FOR_PICKING', 'PICKING', 'PACKING'].includes(order.status) && (
                        <span className="px-3 py-2 bg-purple-50 border border-purple-200 text-purple-800 rounded-lg font-bold">
                          Em fulfillment
                        </span>
                      )}
                      {order.status === 'READY_FOR_SHIPMENT' && (
                        <span className="px-3 py-2 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg font-bold">
                          Aguardando expedição
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {section === 'account' && (
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="bg-white border border-gray-200 rounded-2xl p-6">
              <h2 className="font-black text-gray-900 flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-emerald-600" /> Perfil real</h2>
              <dl className="mt-5 space-y-3 text-xs">
                <div><dt className="text-gray-500">Razão social</dt><dd className="font-bold text-gray-900">{profile.legalName}</dd></div>
                <div><dt className="text-gray-500">Nome comercial</dt><dd className="font-bold text-gray-900">{profile.tradeName || '—'}</dd></div>
                <div><dt className="text-gray-500">País</dt><dd className="font-bold text-gray-900">{profile.country?.name || profile.countryId}</dd></div>
                <div><dt className="text-gray-500">Status KYC</dt><dd className="font-bold text-gray-900">{profile.status}</dd></div>
              </dl>
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl p-6">
              <h2 className="font-black text-gray-900 flex items-center gap-2"><StoreIcon className="w-5 h-5 text-blue-600" /> Lojas reais</h2>
              <div className="mt-5 space-y-3">
                {stores.length ? stores.map((store: any) => (
                  <div key={store.id} className="p-4 bg-gray-50 border border-gray-200 rounded-xl text-xs">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-black text-gray-900">{store.name}</div>
                      <div className="font-bold text-emerald-800">{store.status}</div>
                    </div>
                    <div className="text-gray-500 mt-1">{store.slug}</div>
                    <div className="text-gray-500 mt-1">{[store.city, store.region, store.country?.name].filter(Boolean).join(', ')}</div>
                  </div>
                )) : (
                  <div className="text-xs text-gray-500">Nenhuma loja associada ao vendedor.</div>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="mt-8 p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex gap-2">
          <Clock3 className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            Recursos Seller ainda não comprovados como reais — financeiro agregado, campanhas, mensagens, perguntas,
            reviews detalhados, devoluções, disputas e relatórios avançados — permanecem fora deste portal core.
          </div>
        </div>
      </div>
    </div>
  );
};
