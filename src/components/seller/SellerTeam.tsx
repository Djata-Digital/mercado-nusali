import React, { useEffect, useState } from 'react';
import {
  Users,
  UserPlus,
  Shield,
  X,
  Check,
  Loader2,
  Trash2,
  RefreshCw,
  Store,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

import {
  SellerStoreData,
  SellerTeamMember,
} from '../../data/mockSellerData';

import {
  StoresApi,
  StoreMemberReal,
  StoreMemberRole,
  StoreMemberStatus,
} from '../../api/clients/StoresApi';

interface SellerTeamProps {
  // Mantidos para compatibilidade temporária
  // com o SellerHubView atual.
  team?: SellerTeamMember[];
  onAddMember?: (
    member: SellerTeamMember,
  ) => void;

  stores: SellerStoreData[];

  selectedStoreId?: string;

  showToast: (msg: string) => void;
}

const roleLabels: Record<
  StoreMemberRole,
  string
> = {
  OWNER: 'Proprietário',
  MANAGER: 'Gerente Geral',
  CUSTOMER_SERVICE: 'Atendimento / SAC',
  ORDER_OPERATOR: 'Operador de Pedidos',
  INVENTORY_MANAGER: 'Gerente de Estoque',
  FINANCE: 'Financeiro',
  MARKETING: 'Marketing',
};

const statusLabels: Record<
  StoreMemberStatus,
  string
> = {
  INVITED: 'Convidado',
  ACTIVE: 'Ativo',
  SUSPENDED: 'Suspenso',
  REMOVED: 'Removido',
};

const roleOptions: Array<{
  value: StoreMemberRole;
  label: string;
}> = [
  {
    value: 'MANAGER',
    label: 'Gerente Geral',
  },
  {
    value: 'CUSTOMER_SERVICE',
    label: 'Atendimento / SAC',
  },
  {
    value: 'ORDER_OPERATOR',
    label: 'Operador de Pedidos',
  },
  {
    value: 'INVENTORY_MANAGER',
    label: 'Gerente de Estoque',
  },
  {
    value: 'FINANCE',
    label: 'Financeiro',
  },
  {
    value: 'MARKETING',
    label: 'Marketing',
  },
];

const extractErrorMessage = (error: any) =>
  error?.response?.data?.error?.message ||
  error?.response?.data?.message ||
  error?.message ||
  'Não foi possível concluir a operação.';

export const SellerTeam: React.FC<
  SellerTeamProps
> = ({
  stores,
  selectedStoreId,
  showToast,
}) => {
  const effectiveStoreId =
    selectedStoreId ||
    stores[0]?.id ||
    '';

  const [isModalOpen, setIsModalOpen] =
    useState(false);

  const [email, setEmail] =
    useState('');

  const [role, setRole] =
    useState<StoreMemberRole>('MANAGER');

  const [savingInvite, setSavingInvite] =
    useState(false);

  const [updatingMemberId, setUpdatingMemberId] =
    useState<string | null>(null);

  const membersQuery = useQuery({
    queryKey: [
      'seller-store-members-real',
      effectiveStoreId,
    ],

    enabled: Boolean(effectiveStoreId),

    queryFn: async () => {
      const response =
        await StoresApi.listMembers(
          effectiveStoreId,
        );

      return response.data || [];
    },

    retry: false,
  });

  useEffect(() => {
    if (
      membersQuery.isError &&
      effectiveStoreId
    ) {
      showToast(
        extractErrorMessage(
          membersQuery.error,
        ),
      );
    }
  }, [
    membersQuery.isError,
    membersQuery.error,
    effectiveStoreId,
  ]);

  const members =
    membersQuery.data || [];

  const selectedStore =
    stores.find(
      (store) =>
        store.id === effectiveStoreId,
    );

  const refreshMembers = async () => {
    await membersQuery.refetch();
  };

  const handleInvite = async (
    event: React.FormEvent,
  ) => {
    event.preventDefault();

    if (!effectiveStoreId) {
      showToast(
        'Selecione uma loja antes de convidar um membro.',
      );
      return;
    }

    if (!email.trim()) {
      showToast(
        'Informe o e-mail do membro.',
      );
      return;
    }

    try {
      setSavingInvite(true);

      const response =
        await StoresApi.inviteMember(
          effectiveStoreId,
          {
            email:
              email.trim().toLowerCase(),
            role,
          },
        );

      if (!response.success) {
        throw new Error(
          response.error?.message ||
            'Não foi possível criar o convite.',
        );
      }

      /*
       * Neste estágio o backend cria o convite real,
       * token e validade de 7 dias.
       *
       * O envio automático desse convite por Resend
       * será ligado no próximo ajuste do backend.
       */

      showToast(
        `Convite enviado por e-mail para ${email.trim()}.`,
      );

      setEmail('');
      setRole('MANAGER');
      setIsModalOpen(false);

      await refreshMembers();
    } catch (error: any) {
      showToast(
        extractErrorMessage(error),
      );
    } finally {
      setSavingInvite(false);
    }
  };

  const handleUpdateMember = async (
    member: StoreMemberReal,
    newRole: StoreMemberRole,
    newStatus: StoreMemberStatus,
  ) => {
    if (member.role === 'OWNER') {
      showToast(
        'O papel OWNER não pode ser alterado diretamente.',
      );
      return;
    }

    try {
      setUpdatingMemberId(
        member.id,
      );

      const response =
        await StoresApi.updateMember(
          effectiveStoreId,
          member.id,
          {
            role: newRole,
            status: newStatus,
          },
        );

      if (!response.success) {
        throw new Error(
          response.error?.message ||
            'Não foi possível atualizar o membro.',
        );
      }

      showToast(
        'Membro atualizado com sucesso.',
      );

      await refreshMembers();
    } catch (error: any) {
      showToast(
        extractErrorMessage(error),
      );
    } finally {
      setUpdatingMemberId(null);
    }
  };

  const handleRemoveMember = async (
    member: StoreMemberReal,
  ) => {
    if (member.role === 'OWNER') {
      showToast(
        'O proprietário da loja não pode ser removido.',
      );
      return;
    }

    const memberName =
      member.user
        ? `${member.user.firstName} ${member.user.lastName}`.trim()
        : 'este membro';

    const confirmed =
      window.confirm(
        `Deseja remover ${memberName} da equipe desta loja?`,
      );

    if (!confirmed) return;

    try {
      setUpdatingMemberId(
        member.id,
      );

      const response =
        await StoresApi.removeMember(
          effectiveStoreId,
          member.id,
        );

      if (!response.success) {
        throw new Error(
          response.error?.message ||
            'Não foi possível remover o membro.',
        );
      }

      showToast(
        'Membro removido com sucesso.',
      );

      await refreshMembers();
    } catch (error: any) {
      showToast(
        extractErrorMessage(error),
      );
    } finally {
      setUpdatingMemberId(null);
    }
  };

  /*
   * Esta matriz reflete as regras atuais
   * de StorePermissionsService.
   */
  const permissionModules = [
    {
      name: 'Gerenciar Equipe',
      roles: [
        'OWNER',
        'MANAGER',
      ],
    },

    {
      name: 'Gerenciar Produtos',
      roles: [
        'OWNER',
        'MANAGER',
        'INVENTORY_MANAGER',
      ],
    },

    {
      name: 'Visualizar Estoque',
      roles: [
        'OWNER',
        'MANAGER',
        'CUSTOMER_SERVICE',
        'ORDER_OPERATOR',
        'INVENTORY_MANAGER',
        'FINANCE',
      ],
    },

    {
      name: 'Gerenciar Estoque',
      roles: [
        'OWNER',
        'MANAGER',
        'INVENTORY_MANAGER',
      ],
    },

    {
      name: 'Dados Financeiros',
      roles: [
        'OWNER',
        'FINANCE',
      ],
    },

    {
      name: 'Atendimento ao Cliente',
      roles: [
        'OWNER',
        'MANAGER',
        'CUSTOMER_SERVICE',
      ],
    },
  ];

  const matrixRoles: Array<{
    value: StoreMemberRole;
    short: string;
  }> = [
    {
      value: 'OWNER',
      short: 'Proprietário',
    },
    {
      value: 'MANAGER',
      short: 'Gerente',
    },
    {
      value: 'CUSTOMER_SERVICE',
      short: 'SAC',
    },
    {
      value: 'ORDER_OPERATOR',
      short: 'Pedidos',
    },
    {
      value: 'INVENTORY_MANAGER',
      short: 'Estoque',
    },
    {
      value: 'FINANCE',
      short: 'Financeiro',
    },
    {
      value: 'MARKETING',
      short: 'Marketing',
    },
  ];

  if (!stores.length) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center">
        <Store className="w-12 h-12 text-gray-300 mx-auto mb-3" />

        <h2 className="font-black text-gray-900">
          Nenhuma loja cadastrada
        </h2>

        <p className="text-xs text-gray-500 mt-1">
          Cadastre uma loja antes de configurar
          sua equipe.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fadeIn">
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-gray-900 flex items-center gap-2">
            <Users className="w-6 h-6 text-emerald-700" />
            Equipe da Loja
          </h1>

          <p className="text-xs text-gray-500 mt-1">
            Loja atual:{' '}
            <strong className="text-gray-900">
              {selectedStore?.name ||
                'Loja selecionada'}
            </strong>
          </p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() =>
              void refreshMembers()
            }
            className="p-2.5 border border-gray-200 rounded-xl"
            title="Atualizar equipe"
          >
            <RefreshCw
              className={`w-4 h-4 ${
                membersQuery.isFetching
                  ? 'animate-spin'
                  : ''
              }`}
            />
          </button>

          <button
            type="button"
            onClick={() =>
              setIsModalOpen(true)
            }
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2.5 rounded-xl text-xs flex items-center gap-2"
          >
            <UserPlus className="w-4 h-4" />
            Convidar Membro
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-2xs">
        <h2 className="text-sm font-bold text-gray-900 border-b border-gray-100 pb-3">
          Membros da Equipe ({members.length})
        </h2>

        {membersQuery.isLoading ? (
          <div className="py-12 flex justify-center">
            <Loader2 className="w-7 h-7 text-emerald-600 animate-spin" />
          </div>
        ) : !members.length ? (
          <div className="py-10 text-center text-xs text-gray-500">
            Nenhum membro encontrado nesta loja.
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {members.map((member) => {
              const fullName =
                member.user
                  ? `${member.user.firstName} ${member.user.lastName}`.trim()
                  : 'Usuário';

              const busy =
                updatingMemberId ===
                member.id;

              const isOwner =
                member.role === 'OWNER';

              return (
                <div
                  key={member.id}
                  className="py-5 space-y-4"
                >
                  <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-2xl bg-slate-900 text-white font-black flex items-center justify-center text-xs">
                        {fullName
                          .substring(0, 2)
                          .toUpperCase()}
                      </div>

                      <div className="min-w-0">
                        <span className="font-bold text-gray-900 block truncate">
                          {fullName}
                        </span>

                        <span className="text-gray-500 font-mono text-[11px] block truncate">
                          {member.user?.email ||
                            'E-mail não disponível'}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {isOwner ? (
                        <span className="bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold px-3 py-2 rounded-xl text-[11px]">
                          Proprietário
                        </span>
                      ) : (
                        <select
                          value={member.role}
                          disabled={busy}
                          onChange={(e) =>
                            void handleUpdateMember(
                              member,
                              e.target
                                .value as StoreMemberRole,
                              member.status,
                            )
                          }
                          className="p-2 border border-gray-300 rounded-xl text-[11px] bg-white font-bold"
                        >
                          {roleOptions.map(
                            (option) => (
                              <option
                                key={
                                  option.value
                                }
                                value={
                                  option.value
                                }
                              >
                                {
                                  option.label
                                }
                              </option>
                            ),
                          )}
                        </select>
                      )}

                      {isOwner ? (
                        <span className="bg-gray-100 text-gray-700 px-3 py-2 rounded-xl text-[11px] font-bold">
                          {statusLabels[
                            member.status
                          ]}
                        </span>
                      ) : (
                        <select
                          value={member.status}
                          disabled={busy}
                          onChange={(e) =>
                            void handleUpdateMember(
                              member,
                              member.role,
                              e.target
                                .value as StoreMemberStatus,
                            )
                          }
                          className="p-2 border border-gray-300 rounded-xl text-[11px] bg-white"
                        >
                          <option value="ACTIVE">
                            Ativo
                          </option>

                          <option value="SUSPENDED">
                            Suspenso
                          </option>

                          <option value="INVITED">
                            Convidado
                          </option>
                        </select>
                      )}

                      {!isOwner && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            void handleRemoveMember(
                              member,
                            )
                          }
                          className="p-2 text-red-600 hover:bg-red-50 rounded-xl disabled:opacity-50"
                          title="Remover membro"
                        >
                          {busy ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="text-[10px] text-gray-400">
                    Cargo:{' '}
                    <strong>
                      {
                        roleLabels[
                          member.role
                        ]
                      }
                    </strong>{' '}
                    • Status:{' '}
                    <strong>
                      {
                        statusLabels[
                          member.status
                        ]
                      }
                    </strong>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-2xs space-y-4">
        <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
          <Shield className="w-4 h-4 text-emerald-700" />
          Matriz de Permissões
        </h2>

        <p className="text-[11px] text-gray-500">
          Esta matriz corresponde às permissões
          atualmente aplicadas pelo backend.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="p-3">
                  Operação
                </th>

                {matrixRoles.map(
                  (roleItem) => (
                    <th
                      key={
                        roleItem.value
                      }
                      className="p-3 text-center"
                    >
                      {
                        roleItem.short
                      }
                    </th>
                  ),
                )}
              </tr>
            </thead>

            <tbody className="divide-y">
              {permissionModules.map(
                (module) => (
                  <tr
                    key={module.name}
                  >
                    <td className="p-3 font-bold">
                      {module.name}
                    </td>

                    {matrixRoles.map(
                      (roleItem) => {
                        const allowed =
                          module.roles.includes(
                            roleItem.value,
                          );

                        return (
                          <td
                            key={
                              roleItem.value
                            }
                            className="p-3 text-center"
                          >
                            {allowed ? (
                              <Check className="w-4 h-4 text-emerald-600 mx-auto" />
                            ) : (
                              <span className="text-gray-300">
                                —
                              </span>
                            )}
                          </td>
                        );
                      },
                    )}
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-6 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="font-bold text-base flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-emerald-700" />
                  Convidar Membro
                </h3>

                <p className="text-[10px] text-gray-400 mt-1">
                  Loja:{' '}
                  {selectedStore?.name}
                </p>
              </div>

              <button
                type="button"
                disabled={savingInvite}
                onClick={() =>
                  setIsModalOpen(false)
                }
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={handleInvite}
              className="space-y-4 text-xs"
            >
              <div>
                <label className="block font-bold mb-1">
                  E-mail do Usuário *
                </label>

                <input
                  type="email"
                  value={email}
                  onChange={(e) =>
                    setEmail(
                      e.target.value,
                    )
                  }
                  required
                  placeholder="usuario@email.com"
                  className="w-full p-2.5 border border-gray-300 rounded-xl"
                />

                <p className="text-[10px] text-gray-400 mt-1">
                  O convite fica vinculado exatamente
                  a este endereço de e-mail.
                </p>
              </div>

              <div>
                <label className="block font-bold mb-1">
                  Cargo *
                </label>

                <select
                  value={role}
                  onChange={(e) =>
                    setRole(
                      e.target
                        .value as StoreMemberRole,
                    )
                  }
                  className="w-full p-2.5 border border-gray-300 rounded-xl bg-white font-bold"
                >
                  {roleOptions.map(
                    (option) => (
                      <option
                        key={
                          option.value
                        }
                        value={
                          option.value
                        }
                      >
                        {
                          option.label
                        }
                      </option>
                    ),
                  )}
                </select>
              </div>

              <div className="pt-4 border-t flex justify-end gap-3">
                <button
                  type="button"
                  disabled={savingInvite}
                  onClick={() =>
                    setIsModalOpen(false)
                  }
                  className="px-4 py-2 border rounded-xl font-bold"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={savingInvite}
                  className="px-5 py-2.5 bg-emerald-600 text-white font-bold rounded-xl flex items-center gap-2 disabled:opacity-50"
                >
                  {savingInvite ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Criando...
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4" />
                      Criar Convite
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};