import React, {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  Ban,
  CheckCircle2,
  Eye,
  KeyRound,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  UserCog,
  Users,
  X,
} from 'lucide-react';

import {
  AdminRoleReal,
  AdminUserReal,
  AdminUsersApi,
} from '../../api/clients/AdminUsersApi';

import { CountriesApi } from '../../api/clients/CountriesApi';

interface AdminUsersManagerProps {
  showToast: (msg: string) => void;
}

interface CountryOption {
  id?: string;
  code: string;
  name: string;
  phonePrefix?: string;
  phoneCode?: string;
}

const getErrorMessage = (error: any) =>
  error?.response?.data?.error?.message ||
  error?.response?.data?.message ||
  error?.message ||
  'Não foi possível concluir a operação.';

const unwrapItems = <T,>(
  response: any,
): T[] => {
  const data = response?.data;

  if (Array.isArray(data)) {
    return data;
  }

  if (Array.isArray(data?.items)) {
    return data.items;
  }

  if (Array.isArray(data?.data)) {
    return data.data;
  }

  return [];
};

const statusLabel = (status: string) => {
  switch (status) {
    case 'active':
      return 'Ativo';

    case 'blocked':
      return 'Bloqueado';

    case 'suspended':
      return 'Suspenso';

    case 'inactive':
      return 'Inativo';

    default:
      return status;
  }
};

const statusClasses = (status: string) => {
  switch (status) {
    case 'active':
      return 'bg-emerald-100 text-emerald-700';

    case 'blocked':
      return 'bg-red-100 text-red-700';

    case 'suspended':
      return 'bg-amber-100 text-amber-700';

    default:
      return 'bg-gray-100 text-gray-600';
  }
};

export const AdminUsersManager:
React.FC<AdminUsersManagerProps> = ({
  showToast,
}) => {
  const [users, setUsers] =
    useState<AdminUserReal[]>([]);

  const [roles, setRoles] =
    useState<AdminRoleReal[]>([]);

  const [countries, setCountries] =
    useState<CountryOption[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [search, setSearch] =
    useState('');

  const [statusFilter, setStatusFilter] =
    useState('');

  const [roleFilter, setRoleFilter] =
    useState('');

  const [
    createModalOpen,
    setCreateModalOpen,
  ] = useState(false);

  const [
    selectedUser,
    setSelectedUser,
  ] = useState<AdminUserReal | null>(
    null,
  );

  const [
    roleUser,
    setRoleUser,
  ] = useState<AdminUserReal | null>(
    null,
  );

  const [
    selectedRoles,
    setSelectedRoles,
  ] = useState<string[]>([]);

  const [firstName, setFirstName] =
    useState('');

  const [lastName, setLastName] =
    useState('');

  const [email, setEmail] =
    useState('');

  const [phone, setPhone] =
    useState('');

  const [phoneCode, setPhoneCode] =
    useState('+245');

  const [countryCode, setCountryCode] =
    useState('GW');

  const [createRoles, setCreateRoles] =
    useState<string[]>(['BUYER']);

  const loadReferenceData = async () => {
    try {
      const [
        rolesResponse,
        countriesResponse,
      ] = await Promise.all([
        AdminUsersApi.listRoles(),
        CountriesApi.list(),
      ]);

      setRoles(
        unwrapItems<AdminRoleReal>(
          rolesResponse,
        ),
      );

      const countryList =
        unwrapItems<CountryOption>(
          countriesResponse,
        );

      setCountries(countryList);
    } catch (error: any) {
      showToast(
        getErrorMessage(error),
      );
    }
  };

  const loadUsers = async () => {
    try {
      setLoading(true);

      const response =
        await AdminUsersApi.listUsers({
          page: 1,
          limit: 100,

          search:
            search.trim() ||
            undefined,

          status:
            statusFilter ||
            undefined,

          role:
            roleFilter ||
            undefined,
        });

      setUsers(
        unwrapItems<AdminUserReal>(
          response,
        ),
      );
    } catch (error: any) {
      showToast(
        getErrorMessage(error),
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void Promise.all([
      loadReferenceData(),
      loadUsers(),
    ]);
  }, []);

  useEffect(() => {
    void loadUsers();
  }, [
    statusFilter,
    roleFilter,
  ]);

  const filteredUsers = useMemo(() => {
    if (!search.trim()) {
      return users;
    }

    const term =
      search
        .trim()
        .toLowerCase();

    return users.filter((user) =>
      [
        user.name,
        user.email,
        user.phone,
        user.roles?.join(' '),
        user.country?.name,
      ].some((value) =>
        String(value || '')
          .toLowerCase()
          .includes(term),
      ),
    );
  }, [users, search]);

  const resetCreateForm = () => {
    setFirstName('');
    setLastName('');
    setEmail('');
    setPhone('');
    setPhoneCode('+245');
    setCountryCode('GW');
    setCreateRoles(['BUYER']);
  };

  const toggleCreateRole = (
    roleName: string,
  ) => {
    setCreateRoles((current) => {
      if (
        current.includes(roleName)
      ) {
        if (current.length === 1) {
          return current;
        }

        return current.filter(
          (role) =>
            role !== roleName,
        );
      }

      return [
        ...current,
        roleName,
      ];
    });
  };

  const handleCountryChange = (
    nextCode: string,
  ) => {
    setCountryCode(nextCode);

    const country =
      countries.find(
        (item) =>
          item.code === nextCode,
      );

    const prefix =
      country?.phonePrefix ||
      country?.phoneCode;

    if (prefix) {
      setPhoneCode(prefix);
    }
  };

  const handleCreateUser = async (
    event: React.FormEvent,
  ) => {
    event.preventDefault();

    if (
      !firstName.trim() ||
      !lastName.trim() ||
      !email.trim() ||
      !phone.trim()
    ) {
      showToast(
        'Preencha os dados obrigatórios.',
      );
      return;
    }

    if (!createRoles.length) {
      showToast(
        'Selecione pelo menos uma role.',
      );
      return;
    }

    try {
      setSaving(true);

      const response =
        await AdminUsersApi.createUser({
          firstName:
            firstName.trim(),

          lastName:
            lastName.trim(),

          email:
            email
              .trim()
              .toLowerCase(),

          phone:
            phone.trim(),

          phoneCode:
            phoneCode.trim(),

          countryCode,

          roles: createRoles,
        });

      const createdUser =
        response?.data as
          | AdminUserReal
          | undefined;

      /*
       * A conta não recebe uma senha conhecida
       * pelo administrador.
       *
       * Após criar, enviamos o fluxo seguro
       * de definição de senha por e-mail.
       */
      if (createdUser?.id) {
        try {
          await AdminUsersApi.sendPasswordReset(
            createdUser.id,
          );

          showToast(
            'Usuário criado e instruções para definir a senha enviadas por e-mail.',
          );
        } catch {
          showToast(
            'Usuário criado, mas não foi possível enviar o e-mail de definição de senha. Você pode reenviá-lo pela lista.',
          );
        }
      } else {
        showToast(
          'Usuário criado com sucesso.',
        );
      }

      setCreateModalOpen(false);
      resetCreateForm();

      await loadUsers();
    } catch (error: any) {
      showToast(
        getErrorMessage(error),
      );
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (
    user: AdminUserReal,
    status:
      | 'active'
      | 'blocked'
      | 'suspended'
      | 'inactive',
  ) => {
    let reason:
      | string
      | undefined;

    if (
      status === 'blocked' ||
      status === 'suspended'
    ) {
      const typedReason =
        window.prompt(
          status === 'blocked'
            ? 'Informe o motivo do bloqueio:'
            : 'Informe o motivo da suspensão:',
        );

      if (
        typedReason === null
      ) {
        return;
      }

      reason =
        typedReason.trim() ||
        undefined;
    }

    try {
      await AdminUsersApi.updateStatus(
        user.id,
        {
          status,
          reason,
        },
      );

      showToast(
        `${user.name} agora está ${statusLabel(
          status,
        ).toLowerCase()}.`,
      );

      await loadUsers();
    } catch (error: any) {
      showToast(
        getErrorMessage(error),
      );
    }
  };

  const sendPasswordReset = async (
    user: AdminUserReal,
  ) => {
    const confirmed =
      window.confirm(
        `Enviar instruções de redefinição de senha para ${user.email}?`,
      );

    if (!confirmed) {
      return;
    }

    try {
      await AdminUsersApi.sendPasswordReset(
        user.id,
      );

      showToast(
        `Instruções de redefinição enviadas para ${user.email}.`,
      );
    } catch (error: any) {
      showToast(
        getErrorMessage(error),
      );
    }
  };

  const openRolesModal = (
    user: AdminUserReal,
  ) => {
    setRoleUser(user);

    setSelectedRoles(
      user.roles || [],
    );
  };

  const toggleUserRole = (
    roleName: string,
  ) => {
    setSelectedRoles(
      (current) => {
        if (
          current.includes(roleName)
        ) {
          if (
            current.length === 1
          ) {
            return current;
          }

          return current.filter(
            (role) =>
              role !==
              roleName,
          );
        }

        return [
          ...current,
          roleName,
        ];
      },
    );
  };

  const saveUserRoles =
    async () => {
      if (!roleUser) {
        return;
      }

      if (!selectedRoles.length) {
        showToast(
          'O usuário precisa ter pelo menos uma role.',
        );
        return;
      }

      try {
        setSaving(true);

        await AdminUsersApi.updateRoles(
          roleUser.id,
          selectedRoles,
        );

        showToast(
          `Perfis de acesso de ${roleUser.name} atualizados.`,
        );

        setRoleUser(null);

        await loadUsers();
      } catch (error: any) {
        showToast(
          getErrorMessage(error),
        );
      } finally {
        setSaving(false);
      }
    };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-gray-200 p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
            <Users className="w-6 h-6 text-purple-600" />
            Usuários da Plataforma
          </h1>

          <p className="text-xs text-gray-500 mt-1">
            Contas, status de acesso,
            perfis administrativos e
            segurança.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() =>
              void loadUsers()
            }
            className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 rounded-xl text-xs font-bold flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Atualizar
          </button>

          <button
            type="button"
            onClick={() => {
              resetCreateForm();
              setCreateModalOpen(
                true,
              );
            }}
            className="px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-black flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Novo usuário
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-4 flex flex-col lg:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />

          <input
            value={search}
            onChange={(event) =>
              setSearch(
                event.target.value,
              )
            }
            onKeyDown={(event) => {
              if (
                event.key ===
                'Enter'
              ) {
                void loadUsers();
              }
            }}
            placeholder="Nome, e-mail, telefone..."
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-xl text-xs"
          />
        </div>

        <select
          value={roleFilter}
          onChange={(event) =>
            setRoleFilter(
              event.target.value,
            )
          }
          className="border rounded-xl px-3 py-2 text-xs font-bold"
        >
          <option value="">
            Todas as roles
          </option>

          {roles.map((role) => (
            <option
              key={role.id}
              value={role.name}
            >
              {role.name}
            </option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(event) =>
            setStatusFilter(
              event.target.value,
            )
          }
          className="border rounded-xl px-3 py-2 text-xs font-bold"
        >
          <option value="">
            Todos os status
          </option>

          <option value="active">
            Ativos
          </option>

          <option value="blocked">
            Bloqueados
          </option>

          <option value="suspended">
            Suspensos
          </option>

          <option value="inactive">
            Inativos
          </option>
        </select>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-12 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
          </div>
        ) : !filteredUsers.length ? (
          <div className="p-12 text-center text-sm text-gray-500">
            Nenhum usuário encontrado.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 border-b">
                <tr className="text-[10px] uppercase font-black text-gray-500">
                  <th className="p-3">
                    Usuário
                  </th>

                  <th className="p-3">
                    País
                  </th>

                  <th className="p-3">
                    Roles
                  </th>

                  <th className="p-3">
                    Status
                  </th>

                  <th className="p-3">
                    Verificação
                  </th>

                  <th className="p-3 text-right">
                    Ações
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y">
                {filteredUsers.map(
                  (user) => (
                    <tr
                      key={user.id}
                      className="hover:bg-gray-50/60"
                    >
                      <td className="p-3">
                        <strong className="block text-gray-900">
                          {user.name}
                        </strong>

                        <span className="block text-[10px] text-gray-500">
                          {user.email}
                        </span>

                        <span className="block text-[10px] text-gray-400">
                          {user.phoneCode}{' '}
                          {user.phone}
                        </span>
                      </td>

                      <td className="p-3 font-bold">
                        {user.country?.name ||
                          user.country?.code ||
                          '—'}
                      </td>

                      <td className="p-3">
                        <div className="flex flex-wrap gap-1">
                          {(user.roles || []).map(
                            (role) => (
                              <span
                                key={role}
                                className="bg-purple-50 text-purple-700 px-2 py-1 rounded-full text-[9px] font-black"
                              >
                                {role}
                              </span>
                            ),
                          )}
                        </div>
                      </td>

                      <td className="p-3">
                        <span
                          className={`px-2 py-1 rounded-full text-[9px] font-black ${statusClasses(
                            user.status,
                          )}`}
                        >
                          {statusLabel(
                            user.status,
                          ).toUpperCase()}
                        </span>
                      </td>

                      <td className="p-3">
                        <div className="space-y-1">
                          <div
                            className={
                              user.isEmailVerified
                                ? 'text-emerald-700'
                                : 'text-gray-400'
                            }
                          >
                            E-mail:{' '}
                            {user.isEmailVerified
                              ? 'verificado'
                              : 'pendente'}
                          </div>

                          <div
                            className={
                              user.isPhoneVerified
                                ? 'text-emerald-700'
                                : 'text-gray-400'
                            }
                          >
                            Telefone:{' '}
                            {user.isPhoneVerified
                              ? 'verificado'
                              : 'pendente'}
                          </div>
                        </div>
                      </td>

                      <td className="p-3">
                        <div className="flex justify-end gap-1 flex-wrap">
                          <button
                            type="button"
                            title="Detalhes"
                            onClick={() =>
                              setSelectedUser(
                                user,
                              )
                            }
                            className="p-2 text-purple-700 hover:bg-purple-50 rounded-lg"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            title="Roles"
                            onClick={() =>
                              openRolesModal(
                                user,
                              )
                            }
                            className="p-2 text-blue-700 hover:bg-blue-50 rounded-lg"
                          >
                            <UserCog className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            title="Redefinição de senha"
                            onClick={() =>
                              void sendPasswordReset(
                                user,
                              )
                            }
                            className="p-2 text-amber-700 hover:bg-amber-50 rounded-lg"
                          >
                            <KeyRound className="w-4 h-4" />
                          </button>

                          {user.status !==
                          'active' ? (
                            <button
                              type="button"
                              title="Reativar"
                              onClick={() =>
                                void changeStatus(
                                  user,
                                  'active',
                                )
                              }
                              className="p-2 text-emerald-700 hover:bg-emerald-50 rounded-lg"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                            </button>
                          ) : (
                            <>
                              <button
                                type="button"
                                title="Suspender"
                                onClick={() =>
                                  void changeStatus(
                                    user,
                                    'suspended',
                                  )
                                }
                                className="p-2 text-amber-700 hover:bg-amber-50 rounded-lg"
                              >
                                <ShieldCheck className="w-4 h-4" />
                              </button>

                              <button
                                type="button"
                                title="Bloquear"
                                onClick={() =>
                                  void changeStatus(
                                    user,
                                    'blocked',
                                  )
                                }
                                className="p-2 text-red-700 hover:bg-red-50 rounded-lg"
                              >
                                <Ban className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {createModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="font-black text-lg">
                  Criar usuário
                </h3>

                <p className="text-[10px] text-gray-500 mt-1">
                  O usuário receberá por
                  e-mail o procedimento
                  seguro para definir sua
                  senha.
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setCreateModalOpen(
                    false,
                  )
                }
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={
                handleCreateUser
              }
              className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5 text-xs"
            >
              <Field
                label="Nome"
                value={firstName}
                onChange={
                  setFirstName
                }
                required
              />

              <Field
                label="Sobrenome"
                value={lastName}
                onChange={
                  setLastName
                }
                required
              />

              <Field
                label="E-mail"
                value={email}
                onChange={setEmail}
                type="email"
                required
              />

              <Field
                label="Telefone"
                value={phone}
                onChange={setPhone}
                required
              />

              <Field
                label="Código telefônico"
                value={phoneCode}
                onChange={
                  setPhoneCode
                }
                required
              />

              <div>
                <label className="block font-bold mb-1">
                  País
                </label>

                <select
                  value={countryCode}
                  onChange={(event) =>
                    handleCountryChange(
                      event.target.value,
                    )
                  }
                  className="w-full border rounded-xl p-2.5"
                >
                  {countries.length ? (
                    countries.map(
                      (country) => (
                        <option
                          key={
                            country.code
                          }
                          value={
                            country.code
                          }
                        >
                          {
                            country.name
                          }{' '}
                          (
                          {
                            country.code
                          }
                          )
                        </option>
                      ),
                    )
                  ) : (
                    <option value="GW">
                      Guiné-Bissau
                    </option>
                  )}
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block font-bold mb-2">
                  Perfis de acesso
                </label>

                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {roles.map(
                    (role) => {
                      const checked =
                        createRoles.includes(
                          role.name,
                        );

                      return (
                        <label
                          key={
                            role.id
                          }
                          className={`border rounded-xl p-3 flex items-center gap-2 cursor-pointer ${
                            checked
                              ? 'border-purple-400 bg-purple-50'
                              : 'border-gray-200'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={
                              checked
                            }
                            onChange={() =>
                              toggleCreateRole(
                                role.name,
                              )
                            }
                          />

                          <span className="font-bold">
                            {
                              role.name
                            }
                          </span>
                        </label>
                      );
                    },
                  )}
                </div>
              </div>

              <div className="md:col-span-2 border-t pt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setCreateModalOpen(
                      false,
                    )
                  }
                  className="px-4 py-2 border rounded-xl font-bold"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-purple-600 text-white rounded-xl font-black disabled:opacity-50 flex items-center gap-2"
                >
                  {saving && (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  )}

                  Criar usuário
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedUser && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6">
            <div className="flex justify-between border-b pb-3">
              <h3 className="font-black">
                Detalhes do usuário
              </h3>

              <button
                type="button"
                onClick={() =>
                  setSelectedUser(
                    null,
                  )
                }
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 text-xs space-y-3">
              <Info
                label="Nome"
                value={
                  selectedUser.name
                }
              />

              <Info
                label="E-mail"
                value={
                  selectedUser.email
                }
              />

              <Info
                label="Telefone"
                value={`${selectedUser.phoneCode} ${selectedUser.phone}`}
              />

              <Info
                label="País"
                value={
                  selectedUser
                    .country?.name ||
                  '—'
                }
              />

              <Info
                label="Status"
                value={statusLabel(
                  selectedUser.status,
                )}
              />

              <Info
                label="Roles"
                value={
                  selectedUser.roles?.join(
                    ', ',
                  ) || '—'
                }
              />

              <Info
                label="Criado em"
                value={
                  selectedUser.createdAt
                    ? new Date(
                        selectedUser.createdAt,
                      ).toLocaleString(
                        'pt-BR',
                      )
                    : '—'
                }
              />
            </div>
          </div>
        </div>
      )}

      {roleUser && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6">
            <div className="flex justify-between border-b pb-3">
              <div>
                <h3 className="font-black">
                  Perfis de acesso
                </h3>

                <p className="text-[10px] text-gray-500">
                  {roleUser.name}
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setRoleUser(null)
                }
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid sm:grid-cols-2 gap-2 mt-4">
              {roles.map((role) => {
                const checked =
                  selectedRoles.includes(
                    role.name,
                  );

                return (
                  <label
                    key={role.id}
                    className={`p-3 border rounded-xl flex gap-2 items-start cursor-pointer ${
                      checked
                        ? 'border-purple-400 bg-purple-50'
                        : ''
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        toggleUserRole(
                          role.name,
                        )
                      }
                    />

                    <div>
                      <strong className="block text-xs">
                        {role.name}
                      </strong>

                      {role.description && (
                        <span className="text-[9px] text-gray-500">
                          {
                            role.description
                          }
                        </span>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>

            <div className="border-t mt-5 pt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() =>
                  setRoleUser(null)
                }
                className="px-4 py-2 border rounded-xl text-xs font-bold"
              >
                Cancelar
              </button>

              <button
                type="button"
                disabled={saving}
                onClick={() =>
                  void saveUserRoles()
                }
                className="px-5 py-2 bg-purple-600 text-white rounded-xl text-xs font-black disabled:opacity-50"
              >
                Salvar perfis
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const Field: React.FC<{
  label: string;
  value: string;
  onChange: (
    value: string,
  ) => void;
  type?: string;
  required?: boolean;
}> = ({
  label,
  value,
  onChange,
  type = 'text',
  required = false,
}) => (
  <div>
    <label className="block font-bold mb-1">
      {label}
    </label>

    <input
      type={type}
      required={required}
      value={value}
      onChange={(event) =>
        onChange(
          event.target.value,
        )
      }
      className="w-full border rounded-xl p-2.5"
    />
  </div>
);

const Info: React.FC<{
  label: string;
  value: React.ReactNode;
}> = ({
  label,
  value,
}) => (
  <div className="flex justify-between gap-4 border-b pb-2">
    <span className="text-gray-500">
      {label}
    </span>

    <strong className="text-right">
      {value}
    </strong>
  </div>
);