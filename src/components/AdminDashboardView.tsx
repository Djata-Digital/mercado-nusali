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
import { FulfillmentCoreView } from './admin/FulfillmentCoreView';
import { AdminLogisticsDashboard } from './admin/AdminLogisticsDashboard';
import { AdminFinanceDashboard } from './admin/AdminFinanceDashboard';
import { AdminRefundsManager } from './admin/AdminRefundsManager';
import { AdminPayoutsManager } from './admin/AdminPayoutsManager';
import { AdminSettlementsManager } from './admin/AdminSettlementsManager';
import { AdminDisputesManager } from './admin/AdminDisputesManager';
import { AdminReturnsManager } from './admin/AdminReturnsManager';
import { AdminSupportTickets } from './admin/AdminSupportTickets';

import {
  CheckCircle2,
  ChevronDown,
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
  LifeBuoy,
  XCircle,
} from 'lucide-react';

import {
  AdminAuditApi,
  AdminKycApi,
  AdminProductsApi,
  AdminSellersApi,
} from '../api/clients/AdminCoreApi';

type Tab =
  | 'overview'
  | 'kyc'
  | 'stores'
  | 'products'
  | 'categories'
  | 'brands'
  | 'orders'
  | 'warehouses'
  | 'fulfillment'
  | 'logistics'
  | 'users'
  | 'access'
  | 'audit'
  | 'finance'
  | 'refunds'
  | 'payouts'
  | 'settlements'
  | 'disputes'
  | 'returns'
  | 'support';

interface TabItem {
  id: Tab;
  label: string;
  icon: React.ReactNode;
}

interface TabGroup {
  title: string;
  items: Tab[];
}

const date = (
  value?: string | null,
) =>
  value
    ? new Intl.DateTimeFormat(
        'pt-BR',
        {
          dateStyle: 'short',
          timeStyle: 'short',
        },
      ).format(new Date(value))
    : '—';

const unwrap = (
  response: any,
) => {
  const data = response?.data;

  return {
    items: Array.isArray(data?.items)
      ? data.items
      : Array.isArray(data)
        ? data
        : [],

    total: Number(
      data?.total ||
        (Array.isArray(data)
          ? data.length
          : 0),
    ),
  };
};

const tabs: TabItem[] = [
  {
    id: 'overview',
    label: 'Visão Geral',
    icon: (
      <ShieldCheck className="w-4 h-4" />
    ),
  },

  {
    id: 'kyc',
    label: 'KYC & Vendedores',
    icon: (
      <FileCheck2 className="w-4 h-4" />
    ),
  },

  {
    id: 'stores',
    label: 'Lojas',
    icon: (
      <Store className="w-4 h-4" />
    ),
  },

  {
    id: 'products',
    label: 'Produtos',
    icon: (
      <PackageCheck className="w-4 h-4" />
    ),
  },

  {
    id: 'categories',
    label: 'Categorias',
    icon: (
      <PackageCheck className="w-4 h-4" />
    ),
  },

  {
    id: 'brands',
    label: 'Marcas',
    icon: (
      <Store className="w-4 h-4" />
    ),
  },

  {
    id: 'orders',
    label: 'Pedidos',
    icon: (
      <PackageCheck className="w-4 h-4" />
    ),
  },

  {
    id: 'warehouses',
    label: 'Armazéns',
    icon: (
      <PackageCheck className="w-4 h-4" />
    ),
  },

  {
    id: 'fulfillment',
    label: 'Fulfillment',
    icon: (
      <PackageCheck className="w-4 h-4" />
    ),
  },

  {
    id: 'logistics',
    label: 'Logística',
    icon: (
      <Truck className="w-4 h-4" />
    ),
  },

  {
    id: 'users',
    label: 'Usuários',
    icon: (
      <Users className="w-4 h-4" />
    ),
  },

  {
    id: 'access',
    label: 'Roles & Permissões',
    icon: (
      <ShieldCheck className="w-4 h-4" />
    ),
  },

  {
    id: 'disputes',
    label: 'Disputas',
    icon: (
      <ShieldCheck className="w-4 h-4" />
    ),
  },

  {
    id: 'finance',
    label: 'Visão Financeira',
    icon: (
      <ShieldCheck className="w-4 h-4" />
    ),
  },

  {
    id: 'returns',
    label: 'Devoluções',
    icon: (
      <RefreshCw className="w-4 h-4" />
    ),
  },

  {
    id: 'refunds',
    label: 'Reembolsos',
    icon: (
      <RefreshCw className="w-4 h-4" />
    ),
  },

  {
    id: 'payouts',
    label: 'Payouts',
    icon: (
      <CheckCircle2 className="w-4 h-4" />
    ),
  },

  {
    id: 'settlements',
    label: 'Settlements',
    icon: (
      <ShieldCheck className="w-4 h-4" />
    ),
  },

  {
    id: 'audit',
    label: 'Auditoria',
    icon: (
      <History className="w-4 h-4" />
    ),
  },

  {
    id: 'support',
    label: 'Suporte',
    icon: (
      <LifeBuoy className="w-4 h-4" />
    ),
  },
];

const tabGroups: TabGroup[] = [
  {
    title: 'Resumo',
    items: ['overview'],
  },

  {
    title: 'Comercial',
    items: [
      'kyc',
      'stores',
      'products',
      'categories',
      'brands',
      'orders',
    ],
  },

  {
    title: 'Operações',
    items: [
      'warehouses',
      'fulfillment',
      'logistics',
    ],
  },

  {
    title: 'Financeiro',
    items: [
      'finance',
      'refunds',
      'payouts',
      'settlements',
    ],
  },

  {
    title: 'Atendimento & Confiança',
    items: [
      'disputes',
      'returns',
      'support',
    ],
  },

  {
    title: 'Administração',
    items: [
      'users',
      'access',
      'audit',
    ],
  },
];

export const AdminDashboardView:
React.FC = () => {
  const queryClient =
    useQueryClient();

  const [
    tab,
    setTab,
  ] = useState<Tab>(
    'overview',
  );

  const [
    message,
    setMessage,
  ] = useState<
    string | null
  >(null);

  const [
    mobileMenuOpen,
    setMobileMenuOpen,
  ] = useState(false);

  const [
    productStatus,
    setProductStatus,
  ] = useState(
    'PENDING_REVIEW',
  );

  const [
    documentStatus,
    setDocumentStatus,
  ] = useState(
    'PENDING',
  );

  const productsQuery =
    useQuery({
      queryKey: [
        'admin-core-products',
        productStatus,
      ],

      queryFn: async () =>
        unwrap(
          await AdminProductsApi.list(
            {
              page: 1,
              limit: 100,

              ...(productStatus
                ? {
                    status:
                      productStatus,
                  }
                : {}),
            },
          ),
        ),

      retry: false,
    });

  const documentsQuery =
    useQuery({
      queryKey: [
        'admin-core-kyc-documents',
        documentStatus,
      ],

      queryFn: async () =>
        unwrap(
          await AdminKycApi.listDocuments(
            {
              page: 1,
              limit: 100,

              ...(documentStatus
                ? {
                    status:
                      documentStatus,
                  }
                : {}),
            },
          ),
        ),

      retry: false,
    });

  const sellersQuery =
    useQuery({
      queryKey: [
        'admin-core-sellers',
      ],

      queryFn: async () =>
        unwrap(
          await AdminSellersApi.list(
            {
              page: 1,
              limit: 100,
            },
          ),
        ),

      retry: false,
    });

  const auditQuery =
    useQuery({
      queryKey: [
        'admin-core-audit',
      ],

      queryFn: async () =>
        unwrap(
          await AdminAuditApi.list(
            1,
            100,
          ),
        ),

      retry: false,
    });

  const products =
    productsQuery.data
      ?.items || [];

  const documents =
    documentsQuery.data
      ?.items || [];

  const sellers =
    sellersQuery.data
      ?.items || [];

  const logs =
    auditQuery.data?.items ||
    [];

  const pendingSellerCount =
    useMemo(
      () =>
        sellers.filter(
          (
            seller: any,
          ) =>
            ![
              'VERIFIED',
              'REJECTED',
              'BLOCKED',
            ].includes(
              seller.status,
            ),
        ).length,

      [sellers],
    );

  const invalidate =
    async (
      ...keys: string[]
    ) => {
      await Promise.all(
        keys.map((key) =>
          queryClient.invalidateQueries(
            {
              queryKey: [
                key,
              ],
            },
          ),
        ),
      );
    };

  const approveProduct =
    async (id: string) => {
      setMessage(null);

      try {
        await AdminProductsApi.approve(
          id,
        );

        await invalidate(
          'admin-core-products',
          'admin-core-audit',
        );

        setMessage(
          'Produto aprovado no backend e liberado para o catálogo público.',
        );
      } catch (
        error: any
      ) {
        setMessage(
          error?.response?.data
            ?.message ||
            error?.message ||
            'Não foi possível aprovar o produto.',
        );
      }
    };

  const rejectProduct =
    async (id: string) => {
      const reason =
        window
          .prompt(
            'Informe o motivo real da rejeição do anúncio:',
          )
          ?.trim();

      if (!reason) {
        return;
      }

      setMessage(null);

      try {
        await AdminProductsApi.reject(
          id,
          reason,
        );

        await invalidate(
          'admin-core-products',
          'admin-core-audit',
        );

        setMessage(
          'Produto rejeitado e decisão registrada em auditoria.',
        );
      } catch (
        error: any
      ) {
        setMessage(
          error?.response?.data
            ?.message ||
            error?.message ||
            'Não foi possível rejeitar o produto.',
        );
      }
    };

  const approveDocument =
    async (id: string) => {
      setMessage(null);

      try {
        await AdminKycApi.approveDocument(
          id,
        );

        await invalidate(
          'admin-core-kyc-documents',
          'admin-core-sellers',
          'admin-core-audit',
        );

        setMessage(
          'Documento KYC aprovado no backend.',
        );
      } catch (
        error: any
      ) {
        setMessage(
          error?.response?.data
            ?.message ||
            error?.message ||
            'Não foi possível aprovar o documento.',
        );
      }
    };

  const rejectDocument =
    async (id: string) => {
      const reason =
        window
          .prompt(
            'Informe a justificativa real para rejeitar este documento:',
          )
          ?.trim();

      if (!reason) {
        return;
      }

      setMessage(null);

      try {
        await AdminKycApi.rejectDocument(
          id,
          reason,
        );

        await invalidate(
          'admin-core-kyc-documents',
          'admin-core-sellers',
          'admin-core-audit',
        );

        setMessage(
          'Documento KYC rejeitado no backend.',
        );
      } catch (
        error: any
      ) {
        setMessage(
          error?.response?.data
            ?.message ||
            error?.message ||
            'Não foi possível rejeitar o documento.',
        );
      }
    };

  const approveSeller =
    async (
      sellerId: string,
    ) => {
      const notes =
        window.prompt(
          'Notas opcionais da aprovação KYC:',
        ) || '';

      setMessage(null);

      try {
        await AdminKycApi.approveSeller(
          sellerId,
          notes,
        );

        await invalidate(
          'admin-core-kyc-documents',
          'admin-core-sellers',
          'admin-core-audit',
        );

        setMessage(
          'KYC completo aprovado. O backend validou os documentos mínimos e concedeu o papel SELLER.',
        );
      } catch (
        error: any
      ) {
        setMessage(
          error?.response?.data
            ?.message ||
            error?.message ||
            'Não foi possível aprovar o vendedor.',
        );
      }
    };

  const rejectSeller =
    async (
      sellerId: string,
    ) => {
      const reason =
        window
          .prompt(
            'Informe o motivo real da rejeição KYC do vendedor:',
          )
          ?.trim();

      if (!reason) {
        return;
      }

      setMessage(null);

      try {
        await AdminKycApi.rejectSeller(
          sellerId,
          reason,
        );

        await invalidate(
          'admin-core-kyc-documents',
          'admin-core-sellers',
          'admin-core-audit',
        );

        setMessage(
          'KYC do vendedor rejeitado no backend.',
        );
      } catch (
        error: any
      ) {
        setMessage(
          error?.response?.data
            ?.message ||
            error?.message ||
            'Não foi possível rejeitar o vendedor.',
        );
      }
    };

  const refresh =
    async () => {
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

  const currentTab =
    tabs.find(
      (item) =>
        item.id === tab,
    );

  if (loading) {
    return (
      <div className="min-h-[65vh] flex items-center justify-center text-emerald-700">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  const renderSidebar =
    () => (
      <>
        {tabGroups.map(
          (group) => (
            <div
              key={
                group.title
              }
              className="mb-6 last:mb-0"
            >
              <div className="px-3 mb-2 text-[10px] font-black uppercase tracking-[0.14em] text-gray-400">
                {
                  group.title
                }
              </div>

              <div className="space-y-1">
                {group.items.map(
                  (
                    tabId,
                  ) => {
                    const item =
                      tabs.find(
                        (
                          candidate,
                        ) =>
                          candidate.id ===
                          tabId,
                      );

                    if (!item) {
                      return null;
                    }

                    const active =
                      tab ===
                      item.id;

                    return (
                      <button
                        key={
                          item.id
                        }
                        type="button"
                        onClick={() =>
                          setTab(
                            item.id,
                          )
                        }
                        className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left text-xs font-extrabold transition ${
                          active
                            ? 'bg-emerald-600 text-white shadow-sm'
                            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                        }`}
                      >
                        <span
                          className={
                            active
                              ? 'text-white'
                              : 'text-gray-400'
                          }
                        >
                          {
                            item.icon
                          }
                        </span>

                        <span className="min-w-0">
                          {
                            item.label
                          }
                        </span>
                      </button>
                    );
                  },
                )}
              </div>
            </div>
          ),
        )}
      </>
    );

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="bg-slate-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl mb-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div>
            <div className="inline-flex items-center gap-2 text-emerald-300 text-xs font-black mb-2">
              <ShieldCheck className="w-4 h-4" />

              ADMIN CORE REAL
            </div>

            <h1 className="text-2xl font-black">
              Operação & Administração Mercado Nusali
            </h1>

            <p className="text-xs text-slate-400 mt-2 max-w-3xl">
              Administração central do Mercado Nusali:
              comercial, vendedores, catálogo, pedidos,
              operação logística, usuários, acessos e auditoria.
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              void refresh()
            }
            className="bg-slate-900 border border-slate-700 p-2.5 rounded-xl self-start md:self-auto"
            title="Atualizar"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* MENU MOBILE */}
      <div className="lg:hidden mb-4">
        <button
          type="button"
          onClick={() =>
            setMobileMenuOpen(
              (current) =>
                !current,
            )
          }
          className="w-full bg-white border border-gray-200 rounded-2xl px-4 py-3 flex items-center justify-between shadow-sm"
        >
          <div className="flex items-center gap-2">
            {
              currentTab
                ?.icon
            }

            <span className="text-sm font-black text-gray-900">
              {
                currentTab
                  ?.label
              }
            </span>
          </div>

          <ChevronDown
            className={`w-4 h-4 transition-transform ${
              mobileMenuOpen
                ? 'rotate-180'
                : ''
            }`}
          />
        </button>

        {mobileMenuOpen && (
          <div className="mt-2 bg-white border border-gray-200 rounded-2xl shadow-lg p-3 space-y-4">
            {tabGroups.map(
              (
                group,
              ) => (
                <div
                  key={
                    group.title
                  }
                >
                  <div className="px-2 mb-1 text-[10px] font-black uppercase tracking-wider text-gray-400">
                    {
                      group.title
                    }
                  </div>

                  <div className="space-y-1">
                    {group.items.map(
                      (
                        tabId,
                      ) => {
                        const item =
                          tabs.find(
                            (
                              candidate,
                            ) =>
                              candidate.id ===
                              tabId,
                          );

                        if (
                          !item
                        ) {
                          return null;
                        }

                        return (
                          <button
                            key={
                              item.id
                            }
                            type="button"
                            onClick={() => {
                              setTab(
                                item.id,
                              );

                              setMobileMenuOpen(
                                false,
                              );
                            }}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition ${
                              tab ===
                              item.id
                                ? 'bg-emerald-600 text-white'
                                : 'text-gray-700 hover:bg-gray-50'
                            }`}
                          >
                            {
                              item.icon
                            }

                            {
                              item.label
                            }
                          </button>
                        );
                      },
                    )}
                  </div>
                </div>
              ),
            )}
          </div>
        )}
      </div>

      {/* SIDEBAR + CONTEÚDO */}
      <div className="grid lg:grid-cols-[250px_minmax(0,1fr)] gap-6 items-start">
        <aside className="hidden lg:block">
          <div className="bg-white border border-gray-200 rounded-3xl p-3 sticky top-24 shadow-sm max-h-[calc(100vh-7rem)] overflow-y-auto">
            {renderSidebar()}
          </div>
        </aside>

        <main className="min-w-0">
          {message && (
            <div className="mb-6 bg-blue-50 border border-blue-200 text-blue-900 rounded-xl px-4 py-3 text-xs font-semibold">
              {message}
            </div>
          )}

          {tab ===
            'overview' && (
            <div className="space-y-6">
              <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
                <div className="bg-white border rounded-2xl p-5">
                  <div className="text-xs text-gray-500">
                    Produtos na fila atual
                  </div>

                  <div className="text-3xl font-black mt-1">
                    {
                      products.length
                    }
                  </div>
                </div>

                <div className="bg-white border rounded-2xl p-5">
                  <div className="text-xs text-gray-500">
                    Documentos KYC na fila atual
                  </div>

                  <div className="text-3xl font-black mt-1">
                    {
                      documents.length
                    }
                  </div>
                </div>

                <div className="bg-white border rounded-2xl p-5">
                  <div className="text-xs text-gray-500">
                    Vendedores cadastrados
                  </div>

                  <div className="text-3xl font-black mt-1">
                    {
                      sellers.length
                    }
                  </div>
                </div>

                <div className="bg-white border rounded-2xl p-5">
                  <div className="text-xs text-gray-500">
                    Vendedores pendentes
                  </div>

                  <div className="text-3xl font-black mt-1">
                    {
                      pendingSellerCount
                    }
                  </div>
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 text-xs text-amber-900 flex gap-3">
                <Clock3 className="w-5 h-5 shrink-0" />

                <div>
                  Os módulos exibidos neste painel estão sendo
                  conectados progressivamente ao backend real.
                  Funcionalidades que ainda dependem de mocks
                  permanecem fora do menu até que tenham
                  persistência e regras reais implementadas.
                </div>
              </div>
            </div>
          )}

          {tab ===
            'products' && (
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
              <div className="p-5 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="font-black text-gray-900">
                    Moderação real de produtos
                  </h2>

                  <p className="text-xs text-gray-500 mt-1">
                    Aprovação exige variante e imagem principal no backend.
                  </p>
                </div>

                <select
                  value={
                    productStatus
                  }
                  onChange={(
                    event,
                  ) =>
                    setProductStatus(
                      event.target
                        .value,
                    )
                  }
                  className="border rounded-xl px-3 py-2 text-xs bg-white"
                >
                  <option value="PENDING_REVIEW">
                    PENDING_REVIEW
                  </option>

                  <option value="APPROVED">
                    APPROVED
                  </option>

                  <option value="REJECTED">
                    REJECTED
                  </option>

                  <option value="">
                    Todos
                  </option>
                </select>
              </div>

              {!products.length ? (
                <div className="p-10 text-center text-sm text-gray-500">
                  Nenhum produto nesta fila.
                </div>
              ) : (
                <div className="divide-y">
                  {products.map(
                    (
                      product: any,
                    ) => (
                      <div
                        key={
                          product.id
                        }
                        className="p-5 grid lg:grid-cols-[1fr_auto] gap-4"
                      >
                        <div>
                          <div className="font-black text-gray-900">
                            {
                              product.title
                            }
                          </div>

                          <div className="text-xs text-gray-500 mt-1">
                            {product.store
                              ?.name ||
                              product.storeId}{' '}
                            •{' '}
                            {product.category
                              ?.name ||
                              'Sem categoria'}{' '}
                            •{' '}
                            {
                              product.status
                            }
                          </div>

                          <div className="text-[11px] text-gray-400 mt-1">
                            {product
                              .variants
                              ?.length ||
                              0}{' '}
                            variante(s) •{' '}
                            {product
                              .images
                              ?.length ||
                              0}{' '}
                            imagem(ns) •{' '}
                            {date(
                              product.createdAt,
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {product.status ===
                            'PENDING_REVIEW' && (
                            <>
                              <button
                                type="button"
                                onClick={() =>
                                  void rejectProduct(
                                    product.id,
                                  )
                                }
                                className="px-3 py-2 border border-red-200 text-red-700 rounded-xl text-xs font-bold flex items-center gap-1"
                              >
                                <XCircle className="w-4 h-4" />

                                Rejeitar
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  void approveProduct(
                                    product.id,
                                  )
                                }
                                className="px-3 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold flex items-center gap-1"
                              >
                                <CheckCircle2 className="w-4 h-4" />

                                Aprovar
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    ),
                  )}
                </div>
              )}
            </div>
          )}

          {tab ===
            'kyc' && (
            <AdminKycReview
              showToast={
                setMessage
              }
            />
          )}

          {tab ===
            'stores' && (
            <AdminStoresManager
              showToast={
                setMessage
              }
            />
          )}

          {tab ===
            'categories' && (
            <AdminCategoriesManager
              showToast={
                setMessage
              }
            />
          )}

          {tab ===
            'brands' && (
            <AdminBrandsManager
              showToast={
                setMessage
              }
            />
          )}

          {tab ===
            'orders' && (
            <AdminOrdersManager
              showToast={
                setMessage
              }
            />
          )}

          {tab ===
            'warehouses' && (
            <AdminWarehousesManager
              showToast={
                setMessage
              }
            />
          )}

          {tab ===
            'fulfillment' && (
            <FulfillmentCoreView
              showToast={
                setMessage
              }
            />
          )}

          {tab ===
            'logistics' && (
            <AdminLogisticsDashboard
              showToast={
                setMessage
              }
            />
          )}

          {tab === 'finance' && (
            <AdminFinanceDashboard
              showToast={
                setMessage
              }
            />
          )}

          {tab === 'disputes' && (
            <AdminDisputesManager
              showToast={
                setMessage
              }
            />
          )}

          {tab === 'refunds' && (
            <AdminRefundsManager
              showToast={
                setMessage
              }
            />
          )}

          {tab === 'returns' && (
            <AdminReturnsManager
              showToast={
                setMessage
              }
            />
          )}

          {tab === 'support' && (
            <AdminSupportTickets
              showToast={
                setMessage
              }
            />
          )}

          {tab === 'payouts' && (
            <AdminPayoutsManager
              showToast={
                setMessage
              }
            />
          )}

          {tab === 'settlements' && (
            <AdminSettlementsManager
              showToast={
                setMessage
              }
            />
          )}

          {tab ===
            'users' && (
            <AdminUsersManager
              showToast={
                setMessage
              }
            />
          )}

          {tab ===
            'access' && (
            <AdminRolesPermissions
              showToast={
                setMessage
              }
            />
          )}

          {tab ===
            'audit' && (
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
              <div className="p-5 border-b">
                <h2 className="font-black text-gray-900">
                  Logs reais de auditoria
                </h2>

                <p className="text-xs text-gray-500 mt-1">
                  Últimos registros persistidos no PostgreSQL.
                </p>
              </div>

              {!logs.length ? (
                <div className="p-10 text-center text-sm text-gray-500">
                  Nenhum log encontrado.
                </div>
              ) : (
                <div className="divide-y">
                  {logs.map(
                    (
                      log: any,
                    ) => (
                      <div
                        key={
                          log.id
                        }
                        className="p-4 grid md:grid-cols-2 xl:grid-cols-4 gap-3 text-xs"
                      >
                        <div>
                          <span className="text-gray-400 block">
                            Data
                          </span>

                          <strong>
                            {date(
                              log.createdAt,
                            )}
                          </strong>
                        </div>

                        <div>
                          <span className="text-gray-400 block">
                            Ação
                          </span>

                          <strong>
                            {
                              log.action
                            }
                          </strong>
                        </div>

                        <div>
                          <span className="text-gray-400 block">
                            Entidade
                          </span>

                          <strong>
                            {log.entity ||
                              '—'}{' '}
                            {log.entityId ||
                              ''}
                          </strong>
                        </div>

                        <div>
                          <span className="text-gray-400 block">
                            Usuário
                          </span>

                          <strong>
                            {log.user
                              ?.email ||
                              log.userId ||
                              'Sistema'}
                          </strong>
                        </div>
                      </div>
                    ),
                  )}
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
};