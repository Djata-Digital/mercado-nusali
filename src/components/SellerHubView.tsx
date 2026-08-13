import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Loader2,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';

import { SellerApi } from '../api/clients/SellerApi';
import { StoresApi } from '../api/clients/StoresApi';
import { ProductsApi } from '../api/clients/ProductsApi';
import { OrdersApi } from '../api/clients/OrdersApi';
import { AddressesApi } from '../api/clients/AddressesApi';

import {
  SellerSidebar,
  SellerNavSection,
} from './seller/SellerSidebar';

import { SellerOverview } from './seller/SellerOverview';
import { SellerAccount } from './seller/SellerAccount';
import { SellerKyc } from './seller/SellerKyc';
import { SellerMultiStore } from './seller/SellerMultiStore';
import { SellerTeam } from './seller/SellerTeam';
import { SellerStockManager } from './seller/SellerStockManager';
import { SellerSalesAnalytics } from './seller/SellerSalesAnalytics';
import { SellerReturnsManager } from './seller/SellerReturnsManager';
import { SellerDisputesManager } from './seller/SellerDisputesManager';
import { SellerFinancialManager } from './seller/SellerFinancialManager';
import { SellerWallet } from './seller/SellerWallet';
import { SellerPayouts } from './seller/SellerPayouts';
import { SellerInvoices } from './seller/SellerInvoices';
import { SellerLogisticsFulfillment } from './seller/SellerLogisticsFulfillment';
import { SellerPromotions } from './seller/SellerPromotions';
import { SellerCoupons } from './seller/SellerCoupons';
import { SellerCampaigns } from './seller/SellerCampaigns';
import { SellerAds } from './seller/SellerAds';
import { SellerCustomers } from './seller/SellerCustomers';
import { SellerQuestions } from './seller/SellerQuestions';
import { SellerReviews } from './seller/SellerReviews';
import { SellerMessages } from './seller/SellerMessages';
import { SellerNotifications } from './seller/SellerNotifications';
import { SellerReports } from './seller/SellerReports';
import { SellerSettings } from './seller/SellerSettings';
import { SellerHelpCenter } from './seller/SellerHelpCenter';

import { SellerProductWizard } from './seller/SellerProductWizard';
import { SellerOnboardingForm } from './seller/SellerOnboardingForm';

import {
  initialWarehouses,
  initialSellerQuestions,
  initialSellerCustomers,
  SellerProfileData,
  SellerStoreData,
  SellerQuestion,
} from '../data/mockSellerData';

import {
  CurrencyCode,
  CountryCode,
} from '../types';

const mapSellerType = (
  value?: string,
): SellerProfileData['sellerType'] => {
  switch (value) {
    case 'SOLE_PROPRIETOR':
      return 'empresa_individual';

    case 'COMPANY':
      return 'sociedade';

    case 'OFFICIAL_BRAND':
      return 'marca_oficial';

    case 'INTERNATIONAL':
      return 'vendedor_internacional';

    default:
      return 'pessoa_fisica';
  }
};

const mapKycStatus = (
  value?: string,
): SellerProfileData['kycStatus'] => {
  switch (value) {
    case 'VERIFIED':
      return 'verified';

    case 'UNDER_REVIEW':
      return 'under_review';

    case 'REJECTED':
      return 'rejected';

    default:
      return 'pending';
  }
};

export const SellerHubView: React.FC = () => {
  const queryClient = useQueryClient();

  const [activeSection, setActiveSection] =
    useState<SellerNavSection>('overview');

  const [selectedStoreId, setSelectedStoreId] =
    useState('');

  const [toastMessage, setToastMessage] =
    useState<string | null>(null);

  const [warehouses] =
    useState(initialWarehouses);

  const [questions, setQuestions] =
    useState<SellerQuestion[]>(
      initialSellerQuestions,
    );

  const [customers] =
    useState(initialSellerCustomers);

  const profileQuery = useQuery({
    queryKey: ['seller-profile-real'],

    queryFn: async () => {
      const response =
        await SellerApi.getMyProfile();

      return response.data;
    },

    retry: false,
  });

  const storesQuery = useQuery({
    queryKey: ['seller-stores-real'],

    queryFn: async () => {
      const response =
        await StoresApi.listMine();

      return response.data || [];
    },

    retry: false,
  });

  const productsQuery = useQuery({
    queryKey: ['seller-products-real'],

    queryFn: async () => {
      const response =
        await ProductsApi.listMine({
          page: 1,
          limit: 100,
        } as any);

      const data: any = response.data;

      return Array.isArray(data?.items)
        ? data.items
        : Array.isArray(data)
          ? data
          : [];
    },

    retry: false,
  });

  const ordersQuery = useQuery({
    queryKey: [
      'seller-orders-real',
      selectedStoreId,
    ],

    queryFn: async () => {
      const response =
        await OrdersApi.listSeller(
          selectedStoreId || undefined,
        );

      return response.data || [];
    },

    retry: false,
  });

  const profileReal =
    profileQuery.data;

  const storesReal: any[] =
    storesQuery.data || [];

  const productsReal: any[] =
    productsQuery.data || [];

  const ordersReal: any[] =
    ordersQuery.data || [];

  React.useEffect(() => {
    if (
      !selectedStoreId &&
      storesReal[0]?.id
    ) {
      setSelectedStoreId(
        storesReal[0].id,
      );
    }
  }, [
    storesReal,
    selectedStoreId,
  ]);

  const showToast = (
    message: string,
  ) => {
    setToastMessage(message);

    window.setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  const profile = useMemo<
    SellerProfileData | null
  >(() => {
    if (!profileReal) {
      return null;
    }

    const commercialAddress =
      profileReal.user?.addresses?.find(
        (item) =>
          item.type === 'COMMERCIAL',
      ) ||
      profileReal.user?.addresses?.[0];

    return {
      id: profileReal.id,

      fullName:
        profileReal.legalName ||
        profileReal.tradeName ||
        'Vendedor Nusali',

      commercialName:
        profileReal.tradeName ||
        profileReal.legalName,

      sellerType: mapSellerType(
        profileReal.sellerType,
      ),

      taxId:
        profileReal.taxId || '',

      country:
        (
          profileReal.country?.code ||
          'GW'
        ) as CountryCode,

      city:
        commercialAddress?.city ||
        '',

      address:
        commercialAddress
          ? [
              commercialAddress.street,
              commercialAddress.number,
              commercialAddress.complement,
            ]
              .filter(Boolean)
              .join(', ')
          : '',

      phone:
        profileReal.businessPhone ||
        '',

      email:
        profileReal.businessEmail ||
        '',

      kycStatus:
        mapKycStatus(
          profileReal.status,
        ),

      kycLevel:
        profileReal.status ===
        'VERIFIED'
          ? `Nível ${
              profileReal.verificationLevel ||
              1
            } - Vendedor Verificado`
          : `Nível ${
              profileReal.verificationLevel ||
              1
            } - Verificação pendente`,

      verificationDate:
        profileReal.status ===
        'VERIFIED'
          ? new Date(
              profileReal.updatedAt,
            ).toLocaleDateString(
              'pt-BR',
            )
          : '',

      reputationLevel: 'lider',

      reputationScore:
        Number(
          profileReal.averageRating ||
          0,
        ),

      authorizedCountries: [
        (
          profileReal.country?.code ||
          'GW'
        ) as CountryCode,
      ],

      preferredCurrency:
        (
          profileReal.user
            ?.preferredCurrency
            ?.code ||
          'XOF'
        ) as CurrencyCode,

      payoutMethods: [],

      vacationMode: false,
    };
  }, [profileReal]);

  const stores = useMemo<
    SellerStoreData[]
  >(() => {
    return storesReal.map(
      (store: any) => ({
        id: store.id,

        name:
          store.name ||
          'Loja Nusali',

        slug:
          store.slug ||
          store.id,

        logo:
          store.logoUrl ||
          store.logo ||
          '',

        banner:
          store.bannerUrl ||
          store.banner ||
          '',

        description:
          store.description ||
          '',

        category:
          store.category?.name ||
          'Loja Nusali',

        country:
          (
            store.country?.code ||
            profile?.country ||
            'GW'
          ) as CountryCode,

        city:
          store.city || '',

        address:
          store.address || '',

        phone:
          store.phone || '',

        email:
          store.email || '',

        openingHours:
          store.openingHours ||
          '',

        exchangePolicy:
          store.exchangePolicy ||
          '',

        warrantyPolicy:
          store.warrantyPolicy ||
          '',

        returnPolicy:
          store.returnPolicy ||
          '',

        status:
          store.status === 'ACTIVE'
            ? 'active'
            : store.status ===
                'SUSPENDED'
              ? 'suspended'
              : 'pending_approval',

        isOfficial:
          Boolean(
            store.isOfficial,
          ),

        rating:
          Number(
            store.rating || 0,
          ),

        followersCount:
          Number(
            store.followersCount ||
            0,
          ),

        salesCount:
          Number(
            store.salesCount || 0,
          ),

        acceptedCurrencies:
          store.acceptedCurrencies ||
          [],

        acceptedPayments:
          store.acceptedPayments ||
          [],

        shippingMethods:
          store.shippingMethods ||
          [],
      }),
    );
  }, [
    storesReal,
    profile,
  ]);

  const selectedStore =
    stores.find(
      (store) =>
        store.id ===
        selectedStoreId,
    ) || stores[0];

  const pendingQuestionsCount =
    questions.filter(
      (question) =>
        question.status ===
        'pending',
    ).length;

  const handleAnswerQuestion = (
    id: string,
    text: string,
  ) => {
    setQuestions((current) =>
      current.map(
        (question) =>
          question.id === id
            ? {
                ...question,
                answerText:
                  text,
                answerDate:
                  'Agora mesmo',
                status:
                  'answered',
              }
            : question,
      ),
    );
  };

  const reload = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: [
          'seller-profile-real',
        ],
      }),

      queryClient.invalidateQueries({
        queryKey: [
          'seller-stores-real',
        ],
      }),

      queryClient.invalidateQueries({
        queryKey: [
          'seller-products-real',
        ],
      }),

      queryClient.invalidateQueries({
        queryKey: [
          'seller-orders-real',
        ],
      }),
    ]);
  };

  const loading =
    profileQuery.isLoading ||
    storesQuery.isLoading ||
    productsQuery.isLoading ||
    ordersQuery.isLoading;

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-emerald-700">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (
    profileQuery.isError ||
    !profileReal
  ) {
    const status = (
      profileQuery.error as any
    )?.response?.status;

    if (status === 404) {
      return (
        <SellerOnboardingForm
          onCreated={async () => {
            await queryClient.invalidateQueries(
              {
                queryKey: [
                  'seller-profile-real',
                ],
              },
            );

            await profileQuery.refetch();
          }}
        />
      );
    }

    return (
      <div className="max-w-3xl mx-auto p-8 text-center bg-white border border-gray-200 rounded-2xl mt-10">
        <ShieldCheck className="w-14 h-14 text-red-400 mx-auto mb-4" />

        <h1 className="text-xl font-black text-gray-900">
          Não foi possível carregar
          o perfil
        </h1>

        <p className="text-sm text-gray-500 mt-2">
          O Mercado Nusali não
          conseguiu consultar seu
          perfil de vendedor neste
          momento.
        </p>

        <button
          type="button"
          onClick={() =>
            void profileQuery.refetch()
          }
          className="mt-5 px-5 py-3 bg-emerald-600 text-white rounded-xl text-xs font-black"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  if (!profile) {
    return null;
  }

  const selectedCurrency =
    profile.preferredCurrency;

  return (
    <div className="min-h-screen bg-gray-100/70 flex flex-col lg:flex-row relative font-sans">
      {toastMessage && (
        <div className="fixed top-20 right-4 z-[100] bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-2xl border border-emerald-500 flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse shrink-0" />

          <span className="text-xs font-bold">
            {toastMessage}
          </span>
        </div>
      )}

      <SellerSidebar
        activeSection={
          activeSection
        }
        onSelectSection={
          setActiveSection
        }
        stores={stores}
        selectedStoreId={
          selectedStoreId
        }
        onSelectStore={
          setSelectedStoreId
        }
        sellerName={
          profile.fullName
        }
        sellerCountry={
          profile.country
        }
        pendingQuestionsCount={
          pendingQuestionsCount
        }
        unreadMessagesCount={0}
        openDisputesCount={0}
      />

      <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto max-w-7xl mx-auto w-full">
        <div className="flex justify-end mb-4">
          <button
            type="button"
            onClick={() =>
              void reload()
            }
            className="p-2.5 rounded-xl bg-white border border-gray-200 text-gray-600 hover:text-emerald-700"
            title="Atualizar dados"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {activeSection ===
          'overview' && (
          <SellerOverview
            selectedCurrency={
              selectedCurrency
            }
            selectedStoreName={
              selectedStore?.name ||
              profile.commercialName
            }
            onNavigateSection={
              setActiveSection
            }
          />
        )}

        {activeSection ===
          'account' && (
          <SellerAccount
            profile={profile}
            onUpdateProfile={async (
              updatedProfile,
            ) => {
              try {
                const sellerTypeMap: Record<
                  string,
                  string
                > = {
                  pessoa_fisica:
                    'INDIVIDUAL',

                  empresa_individual:
                    'SOLE_PROPRIETOR',

                  sociedade:
                    'COMPANY',

                  marca_oficial:
                    'OFFICIAL_BRAND',

                  vendedor_internacional:
                    'INTERNATIONAL',
                };

                const sellerResponse =
                  await SellerApi.updateMyProfile(
                    {
                      legalName:
                        updatedProfile.fullName,

                      tradeName:
                        updatedProfile.commercialName,

                      sellerType:
                        sellerTypeMap[
                          updatedProfile
                            .sellerType
                        ],

                      taxId:
                        updatedProfile.taxId,

                      businessPhone:
                        updatedProfile.phone,

                      businessEmail:
                        updatedProfile.email,

                      countryCode:
                        updatedProfile.country,

                      preferredCurrencyCode:
                        updatedProfile.preferredCurrency,
                    },
                  );

                const refreshedSeller =
                  sellerResponse.data;

                const existingCommercialAddress =
                  profileReal.user?.addresses?.find(
                    (item) =>
                      item.type ===
                      'COMMERCIAL',
                  );

                const newCountryId =
                  refreshedSeller?.country
                    ?.id ||
                  profileReal.country?.id;

                const newPhonePrefix =
                  refreshedSeller?.country
                    ?.phonePrefix ||
                  profileReal.country
                    ?.phonePrefix ||
                  '+245';

                if (
                  updatedProfile.city.trim() &&
                  updatedProfile.address.trim() &&
                  newCountryId
                ) {
                  const addressData = {
                    label:
                      'Sede Comercial',

                    recipientName:
                      updatedProfile.fullName,

                    phone:
                      updatedProfile.phone.replace(
                        /^\+\d+\s*/,
                        '',
                      ),

                    phoneCode:
                      newPhonePrefix,

                    countryId:
                      newCountryId,

                    region:
                      updatedProfile.city,

                    city:
                      updatedProfile.city,

                    street:
                      updatedProfile.address,

                    number:
                      existingCommercialAddress
                        ?.number ||
                      'S/N',

                    isDefault: true,

                    type:
                      'COMMERCIAL' as const,
                  };

                  if (
                    existingCommercialAddress
                  ) {
                    const countryChanged =
                      existingCommercialAddress.countryId !==
                      newCountryId;

                    if (
                      countryChanged
                    ) {
                      await AddressesApi.delete(
                        existingCommercialAddress.id,
                      );

                      await AddressesApi.create(
                        addressData,
                      );
                    } else {
                      await AddressesApi.update(
                        existingCommercialAddress.id,
                        {
                          label:
                            addressData.label,

                          recipientName:
                            addressData.recipientName,

                          phone:
                            addressData.phone,

                          phoneCode:
                            addressData.phoneCode,

                          region:
                            addressData.region,

                          city:
                            addressData.city,

                          street:
                            addressData.street,

                          number:
                            addressData.number,

                          isDefault:
                            true,

                          type:
                            'COMMERCIAL',
                        },
                      );
                    }
                  } else {
                    await AddressesApi.create(
                      addressData,
                    );
                  }
                }

                await queryClient.invalidateQueries(
                  {
                    queryKey: [
                      'seller-profile-real',
                    ],
                  },
                );

                await profileQuery.refetch();

                showToast(
                  'Dados da conta de vendedor salvos com sucesso.',
                );
              } catch (
                error: any
              ) {
                showToast(
                  error?.response?.data
                    ?.error?.message ||
                    error?.response?.data
                      ?.message ||
                    error?.message ||
                    'Não foi possível salvar os dados do vendedor.',
                );
              }
            }}
            showToast={showToast}
            onNavigateSection={
              setActiveSection
            }
          />
        )}

        {activeSection ===
          'kyc' && (
          <SellerKyc
            profile={profile}
            showToast={showToast}
            onNavigateSection={
              setActiveSection
            }
          />
        )}

        {activeSection ===
          'stores' && (
          <SellerMultiStore
            stores={stores}
            selectedStoreId={
              selectedStoreId
            }
            onSelectStore={
              setSelectedStoreId
            }
            onAddStore={() => {
              showToast(
                'A criação de lojas será conectada ao backend na próxima etapa.',
              );
            }}
            onUpdateStore={() => {
              showToast(
                'A atualização da loja será conectada ao backend na próxima etapa.',
              );
            }}
            showToast={
              showToast
            }
          />
        )}

        {activeSection ===
          'team' && (
          <SellerTeam
            stores={stores}
            selectedStoreId={
              selectedStoreId
            }
            showToast={
              showToast
            }
          />
        )}

        {activeSection ===
          'products_list' && (
          <div className="space-y-5">
            <div className="bg-white border border-gray-200 rounded-2xl p-5 flex items-center justify-between gap-4">
              <div>
                <h1 className="font-black text-gray-900">
                  Meus Produtos
                </h1>

                <p className="text-xs text-gray-500 mt-1">
                  Produtos carregados do
                  backend real.
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setActiveSection(
                    'product_create',
                  )
                }
                className="bg-emerald-600 text-white px-4 py-2.5 rounded-xl text-xs font-black"
              >
                Cadastrar Produto
              </button>
            </div>

            {!productsReal.length ? (
              <div className="bg-white border border-gray-200 rounded-2xl p-10 text-center text-sm text-gray-500">
                Nenhum produto
                cadastrado.
              </div>
            ) : (
              <div className="bg-white border border-gray-200 rounded-2xl divide-y divide-gray-100">
                {productsReal.map(
                  (
                    product: any,
                  ) => (
                    <div
                      key={
                        product.id
                      }
                      className="p-5"
                    >
                      <div className="font-bold text-gray-900">
                        {
                          product.title
                        }
                      </div>

                      <div className="text-xs text-gray-500 mt-1">
                        {product
                          .store
                          ?.name ||
                          'Loja'}{' '}
                        •{' '}
                        {
                          product.status
                        }
                      </div>
                    </div>
                  ),
                )}
              </div>
            )}
          </div>
        )}

        {activeSection ===
          'product_create' &&
          selectedStore && (
            <SellerProductWizard
              storeId={
                selectedStore.id
              }
              storeCountryCode={
                selectedStore.country
              }
              onCancel={() =>
                setActiveSection(
                  'products_list',
                )
              }
              onComplete={async () => {
                await queryClient.invalidateQueries(
                  {
                    queryKey: [
                      'seller-products-real',
                    ],
                  },
                );

                setActiveSection(
                  'products_list',
                );

                showToast(
                  'Produto cadastrado com sucesso.',
                );
              }}
            />
          )}

        {activeSection ===
          'stock' && (
          <SellerStockManager
            warehouses={
              warehouses
            }
            showToast={
              showToast
            }
          />
        )}

        {activeSection ===
          'orders' && (
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <div className="p-5 border-b border-gray-200">
              <h1 className="font-black text-gray-900">
                Pedidos de Venda
              </h1>

              <p className="text-xs text-gray-500 mt-1">
                Pedidos carregados do
                backend real.
              </p>
            </div>

            {!ordersReal.length ? (
              <div className="p-10 text-center text-sm text-gray-500">
                Nenhum pedido
                encontrado.
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {ordersReal.map(
                  (
                    order: any,
                  ) => (
                    <div
                      key={
                        order.id
                      }
                      className="p-5 grid sm:grid-cols-3 gap-4 text-xs"
                    >
                      <div>
                        <div className="text-gray-500">
                          Pedido
                        </div>

                        <div className="font-black mt-1">
                          {
                            order.orderNumber
                          }
                        </div>
                      </div>

                      <div>
                        <div className="text-gray-500">
                          Status
                        </div>

                        <div className="font-black mt-1 text-emerald-700">
                          {
                            order.status
                          }
                        </div>
                      </div>

                      <div>
                        <div className="text-gray-500">
                          Total
                        </div>

                        <div className="font-black mt-1">
                          {order.total ??
                            '—'}
                        </div>
                      </div>
                    </div>
                  ),
                )}
              </div>
            )}
          </div>
        )}

        {activeSection ===
          'sales' && (
          <SellerSalesAnalytics
            showToast={
              showToast
            }
            selectedCurrency={
              selectedCurrency
            }
          />
        )}

        {activeSection ===
          'logistics' && (
          <SellerLogisticsFulfillment
            showToast={
              showToast
            }
          />
        )}

        {activeSection ===
          'returns' && (
          <SellerReturnsManager
            showToast={
              showToast
            }
            selectedCurrency={
              selectedCurrency
            }
          />
        )}

        {activeSection ===
          'disputes' && (
          <SellerDisputesManager
            showToast={
              showToast
            }
            selectedCurrency={
              selectedCurrency
            }
          />
        )}

        {activeSection ===
          'financial' && (
          <SellerFinancialManager
            selectedCurrency={
              selectedCurrency
            }
            showToast={
              showToast
            }
          />
        )}

        {activeSection ===
          'wallet' && (
          <SellerWallet
            showToast={
              showToast
            }
            selectedCurrency={
              selectedCurrency
            }
          />
        )}

        {activeSection ===
          'payouts' && (
          <SellerPayouts
            showToast={
              showToast
            }
            selectedCurrency={
              selectedCurrency
            }
          />
        )}

        {activeSection ===
          'invoices' && (
          <SellerInvoices
            showToast={
              showToast
            }
            selectedCurrency={
              selectedCurrency
            }
          />
        )}

        {activeSection ===
          'promos' && (
          <SellerPromotions
            showToast={
              showToast
            }
          />
        )}

        {activeSection ===
          'coupons' && (
          <SellerCoupons
            showToast={
              showToast
            }
          />
        )}

        {activeSection ===
          'campaigns' && (
          <SellerCampaigns
            showToast={
              showToast
            }
          />
        )}

        {activeSection ===
          'ads' && (
          <SellerAds
            showToast={
              showToast
            }
          />
        )}

        {activeSection ===
          'customers' && (
          <SellerCustomers
            showToast={
              showToast
            }
            customers={
              customers
            }
          />
        )}

        {activeSection ===
          'questions' && (
          <SellerQuestions
            showToast={
              showToast
            }
            questions={
              questions
            }
            onAnswerQuestion={
              handleAnswerQuestion
            }
          />
        )}

        {activeSection ===
          'reviews' && (
          <SellerReviews
            showToast={
              showToast
            }
          />
        )}

        {activeSection ===
          'messages' && (
          <SellerMessages
            showToast={
              showToast
            }
          />
        )}

        {activeSection ===
          'notifications' && (
          <SellerNotifications
            showToast={
              showToast
            }
          />
        )}

        {activeSection ===
          'reports' && (
          <SellerReports
            showToast={
              showToast
            }
          />
        )}

        {activeSection ===
          'settings' && (
          <SellerSettings
            showToast={
              showToast
            }
            profile={
              profile
            }
            onUpdateProfile={() => {
              showToast(
                'Configurações serão persistidas no backend na etapa correspondente.',
              );
            }}
          />
        )}

        {activeSection ===
          'help' && (
          <SellerHelpCenter
            showToast={
              showToast
            }
          />
        )}
      </main>
    </div>
  );
};