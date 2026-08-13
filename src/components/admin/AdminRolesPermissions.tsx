import React, {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  Check,
  Edit2,
  Loader2,
  Lock,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react';

import {
  AdminPermissionReal,
  AdminRoleReal,
  AdminUsersApi,
} from '../../api/clients/AdminUsersApi';

interface AdminRolesPermissionsProps {
  showToast: (msg: string) => void;
}

const PROTECTED_ROLES = new Set([
  'GLOBAL_ADMIN',
  'ADMIN',
  'BUYER',
  'SELLER',
]);

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

const getErrorMessage = (error: any) =>
  error?.response?.data?.error?.message ||
  error?.response?.data?.message ||
  error?.message ||
  'Não foi possível concluir a operação.';

const rolePermissionSlugs = (
  role: AdminRoleReal,
) =>
  (role.permissions || [])
    .map(
      (item) =>
        item.permission?.slug,
    )
    .filter(Boolean);

export const AdminRolesPermissions:
React.FC<
  AdminRolesPermissionsProps
> = ({
  showToast,
}) => {
  const [roles, setRoles] =
    useState<AdminRoleReal[]>([]);

  const [
    permissions,
    setPermissions,
  ] =
    useState<
      AdminPermissionReal[]
    >([]);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [search, setSearch] =
    useState('');

  const [modalOpen, setModalOpen] =
    useState(false);

  const [
    editingRole,
    setEditingRole,
  ] =
    useState<AdminRoleReal | null>(
      null,
    );

  const [roleName, setRoleName] =
    useState('');

  const [
    roleDescription,
    setRoleDescription,
  ] = useState('');

  const [
    selectedPermissions,
    setSelectedPermissions,
  ] = useState<string[]>([]);

  const load = async () => {
    try {
      setLoading(true);

      const [
        rolesResponse,
        permissionsResponse,
      ] = await Promise.all([
        AdminUsersApi.listRoles(),
        AdminUsersApi.listPermissions(),
      ]);

      setRoles(
        unwrapItems<AdminRoleReal>(
          rolesResponse,
        ),
      );

      setPermissions(
        unwrapItems<AdminPermissionReal>(
          permissionsResponse,
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
    void load();
  }, []);

  const filteredRoles =
    useMemo(() => {
      const term =
        search
          .trim()
          .toLowerCase();

      if (!term) {
        return roles;
      }

      return roles.filter(
        (role) =>
          role.name
            .toLowerCase()
            .includes(term) ||
          String(
            role.description ||
              '',
          )
            .toLowerCase()
            .includes(term),
      );
    }, [roles, search]);

  const openCreate = () => {
    setEditingRole(null);
    setRoleName('');
    setRoleDescription('');
    setSelectedPermissions([]);
    setModalOpen(true);
  };

  const openEdit = (
    role: AdminRoleReal,
  ) => {
    if (
      role.name ===
      'GLOBAL_ADMIN'
    ) {
      showToast(
        'GLOBAL_ADMIN é uma role estrutural crítica e não será editada por esta interface.',
      );

      return;
    }

    setEditingRole(role);
    setRoleName(role.name);

    setRoleDescription(
      role.description || '',
    );

    setSelectedPermissions(
      rolePermissionSlugs(role),
    );

    setModalOpen(true);
  };

  const togglePermission = (
    slug: string,
  ) => {
    setSelectedPermissions(
      (current) =>
        current.includes(slug)
          ? current.filter(
              (item) =>
                item !== slug,
            )
          : [
              ...current,
              slug,
            ],
    );
  };

  const saveRole = async (
    event: React.FormEvent,
  ) => {
    event.preventDefault();

    const normalizedName =
      roleName
        .trim()
        .toUpperCase();

    if (!normalizedName) {
      showToast(
        'Informe o nome da role.',
      );
      return;
    }

    if (
      !selectedPermissions.length
    ) {
      showToast(
        'Selecione pelo menos uma permissão.',
      );
      return;
    }

    try {
      setSaving(true);

      if (editingRole) {
        await AdminUsersApi.updateRole(
          editingRole.id,
          {
            /*
             * Roles estruturais continuam
             * com o nome original.
             */
            name:
              PROTECTED_ROLES.has(
                editingRole.name,
              )
                ? undefined
                : normalizedName,

            description:
              roleDescription.trim(),

            permissions:
              selectedPermissions,
          },
        );

        showToast(
          `Role ${editingRole.name} atualizada.`,
        );
      } else {
        await AdminUsersApi.createRole({
          name:
            normalizedName,

          description:
            roleDescription.trim() ||
            undefined,

          permissions:
            selectedPermissions,
        });

        showToast(
          `Role ${normalizedName} criada.`,
        );
      }

      setModalOpen(false);
      await load();
    } catch (error: any) {
      showToast(
        getErrorMessage(error),
      );
    } finally {
      setSaving(false);
    }
  };

  const deleteRole = async (
    role: AdminRoleReal,
  ) => {
    if (
      PROTECTED_ROLES.has(
        role.name,
      )
    ) {
      showToast(
        'Esta role é estrutural e não pode ser excluída.',
      );
      return;
    }

    const userCount =
      role._count?.users || 0;

    if (userCount > 0) {
      showToast(
        `Esta role ainda está atribuída a ${userCount} usuário(s).`,
      );
      return;
    }

    const confirmed =
      window.confirm(
        `Excluir a role "${role.name}"?`,
      );

    if (!confirmed) {
      return;
    }

    try {
      await AdminUsersApi.deleteRole(
        role.id,
      );

      showToast(
        `Role ${role.name} excluída.`,
      );

      await load();
    } catch (error: any) {
      showToast(
        getErrorMessage(error),
      );
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 rounded-2xl p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-purple-600" />
            Roles & Permissões
          </h1>

          <p className="text-xs text-gray-500 mt-1">
            Controle real de acesso
            administrativo e operacional
            da plataforma.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() =>
              void load()
            }
            className="px-4 py-2.5 bg-gray-100 rounded-xl text-xs font-bold flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Atualizar
          </button>

          <button
            type="button"
            onClick={openCreate}
            className="px-4 py-2.5 bg-purple-600 text-white rounded-xl text-xs font-black flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Nova role
          </button>
        </div>
      </div>

      <div className="bg-white border rounded-2xl p-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />

          <input
            value={search}
            onChange={(event) =>
              setSearch(
                event.target.value,
              )
            }
            placeholder="Buscar role..."
            className="w-full pl-9 pr-3 py-2 border rounded-xl text-xs"
          />
        </div>
      </div>

      {loading ? (
        <div className="bg-white border rounded-2xl p-12 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
        </div>
      ) : (
        <div className="grid lg:grid-cols-2 gap-5">
          {filteredRoles.map(
            (role) => {
              const structural =
                PROTECTED_ROLES.has(
                  role.name,
                );

              const rolePermissions =
                rolePermissionSlugs(
                  role,
                );

              return (
                <div
                  key={role.id}
                  className="bg-white border rounded-2xl p-5 space-y-4"
                >
                  <div className="flex justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        {structural && (
                          <Lock className="w-4 h-4 text-amber-600" />
                        )}

                        <h3 className="font-black">
                          {role.name}
                        </h3>
                      </div>

                      <p className="text-xs text-gray-500 mt-1">
                        {role.description ||
                          'Sem descrição.'}
                      </p>
                    </div>

                    <div className="text-right">
                      <strong className="block text-lg">
                        {role._count
                          ?.users || 0}
                      </strong>

                      <span className="text-[9px] text-gray-400">
                        usuários
                      </span>
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] uppercase font-black text-gray-400">
                      Permissões
                    </span>

                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {rolePermissions.length ? (
                        rolePermissions.map(
                          (permission) => (
                            <span
                              key={
                                permission
                              }
                              className="text-[9px] bg-purple-50 text-purple-700 px-2 py-1 rounded-full font-bold"
                            >
                              {
                                permission
                              }
                            </span>
                          ),
                        )
                      ) : (
                        <span className="text-xs text-gray-400">
                          Nenhuma permissão.
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="border-t pt-3 flex justify-end gap-2">
                    {role.name !==
                      'GLOBAL_ADMIN' && (
                      <button
                        type="button"
                        onClick={() =>
                          openEdit(role)
                        }
                        className="px-3 py-2 bg-purple-50 text-purple-700 rounded-xl text-xs font-bold flex items-center gap-1"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        Editar
                      </button>
                    )}

                    {!structural && (
                      <button
                        type="button"
                        onClick={() =>
                          void deleteRole(
                            role,
                          )
                        }
                        className="px-3 py-2 bg-red-50 text-red-700 rounded-xl text-xs font-bold flex items-center gap-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Excluir
                      </button>
                    )}
                  </div>
                </div>
              );
            },
          )}
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between border-b pb-3">
              <div>
                <h3 className="font-black text-lg">
                  {editingRole
                    ? 'Editar role'
                    : 'Criar role'}
                </h3>

                <p className="text-[10px] text-gray-500 mt-1">
                  As permissões escolhidas
                  terão efeito real no backend.
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setModalOpen(false)
                }
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={saveRole}
              className="space-y-5 mt-5"
            >
              <div>
                <label className="block text-xs font-bold mb-1">
                  Nome
                </label>

                <input
                  required
                  disabled={
                    !!editingRole &&
                    PROTECTED_ROLES.has(
                      editingRole.name,
                    )
                  }
                  value={roleName}
                  onChange={(event) =>
                    setRoleName(
                      event.target.value,
                    )
                  }
                  className="w-full border rounded-xl p-2.5 text-xs disabled:bg-gray-100"
                />
              </div>

              <div>
                <label className="block text-xs font-bold mb-1">
                  Descrição
                </label>

                <textarea
                  value={
                    roleDescription
                  }
                  onChange={(event) =>
                    setRoleDescription(
                      event.target.value,
                    )
                  }
                  className="w-full border rounded-xl p-2.5 text-xs min-h-[80px]"
                />
              </div>

              <div>
                <div className="flex justify-between items-center">
                  <label className="text-xs font-black">
                    Permissões
                  </label>

                  <span className="text-[10px] text-gray-500">
                    {
                      selectedPermissions.length
                    }{' '}
                    selecionadas
                  </span>
                </div>

                <div className="grid md:grid-cols-2 gap-2 mt-3">
                  {permissions.map(
                    (permission) => {
                      const checked =
                        selectedPermissions.includes(
                          permission.slug,
                        );

                      return (
                        <label
                          key={
                            permission.id
                          }
                          className={`border rounded-xl p-3 flex gap-2 cursor-pointer ${
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
                              togglePermission(
                                permission.slug,
                              )
                            }
                          />

                          <div>
                            <strong className="block text-[11px]">
                              {
                                permission.name
                              }
                            </strong>

                            <span className="block text-[9px] text-purple-700 font-mono mt-0.5">
                              {
                                permission.slug
                              }
                            </span>

                            {permission.description && (
                              <span className="block text-[9px] text-gray-400 mt-1">
                                {
                                  permission.description
                                }
                              </span>
                            )}
                          </div>
                        </label>
                      );
                    },
                  )}
                </div>
              </div>

              <div className="border-t pt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setModalOpen(false)
                  }
                  className="px-4 py-2 border rounded-xl text-xs font-bold"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-purple-600 text-white rounded-xl text-xs font-black flex items-center gap-2 disabled:opacity-50"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}

                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};