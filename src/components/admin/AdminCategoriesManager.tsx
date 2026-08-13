import React, {
  useEffect,
  useState,
} from 'react';

import {
  Check,
  Edit2,
  Layers,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from 'lucide-react';

import { CategoriesApi } from '../../api/clients/CategoriesApi';

interface AdminCategoriesManagerProps {
  showToast: (msg: string) => void;
}

interface CategoryItem {
  id: string;
  name: string;
  slug?: string;
  description?: string | null;
  status?: string;
  isActive?: boolean;
  productCount?: number;
  _count?: {
    products?: number;
  };
}

const unwrap = (response: any): CategoryItem[] => {
  const data = response?.data;

  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.data)) return data.data;

  return [];
};

const errorMessage = (error: any) =>
  error?.response?.data?.message ||
  error?.response?.data?.error?.message ||
  error?.message ||
  'Não foi possível concluir a operação.';

const slugify = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

export const AdminCategoriesManager: React.FC<
  AdminCategoriesManagerProps
> = ({ showToast }) => {
  const [categories, setCategories] =
    useState<CategoryItem[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [isModalOpen, setIsModalOpen] =
    useState(false);

  const [
    editingCategory,
    setEditingCategory,
  ] = useState<CategoryItem | null>(null);

  const [formName, setFormName] =
    useState('');

  const [
    formDescription,
    setFormDescription,
  ] = useState('');

  const [formActive, setFormActive] =
    useState(true);

  const loadCategories = async () => {
    try {
      setLoading(true);

      const response =
        await CategoriesApi.listAdmin();

      setCategories(unwrap(response));
    } catch (error: any) {
      showToast(errorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadCategories();
  }, []);

  const openCreate = () => {
    setEditingCategory(null);
    setFormName('');
    setFormDescription('');
    setFormActive(true);
    setIsModalOpen(true);
  };

  const openEdit = (
    category: CategoryItem,
  ) => {
    setEditingCategory(category);
    setFormName(category.name);
    setFormDescription(
      category.description || '',
    );

    setFormActive(
      category.isActive ??
        category.status !== 'INACTIVE',
    );

    setIsModalOpen(true);
  };

  const handleSave = async (
    event: React.FormEvent,
  ) => {
    event.preventDefault();

    const name = formName.trim();

    if (!name) {
      showToast(
        'Informe o nome da categoria.',
      );
      return;
    }

    const payload = {
      name,
      slug:
        editingCategory?.slug ||
        slugify(name),
      description:
        formDescription.trim() ||
        undefined,
      isActive: formActive,
    };

    try {
      setSaving(true);

      if (editingCategory) {
        await CategoriesApi.update(
          editingCategory.id,
          payload,
        );

        showToast(
          `Categoria "${name}" atualizada.`,
        );
      } else {
        await CategoriesApi.create(
          payload,
        );

        showToast(
          `Categoria "${name}" criada.`,
        );
      }

      setIsModalOpen(false);
      await loadCategories();
    } catch (error: any) {
      showToast(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (
    category: CategoryItem,
  ) => {
    const confirmed = window.confirm(
      `Excluir a categoria "${category.name}"?`,
    );

    if (!confirmed) return;

    try {
      await CategoriesApi.delete(
        category.id,
      );

      showToast(
        `Categoria "${category.name}" removida.`,
      );

      await loadCategories();
    } catch (error: any) {
      showToast(errorMessage(error));
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
            <Layers className="w-6 h-6 text-purple-600" />
            Gestão de Categorias
          </h1>

          <p className="text-xs text-gray-500 mt-1">
            Estrutura real de categorias
            persistida no marketplace.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() =>
              void loadCategories()
            }
            className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 rounded-xl text-xs font-bold flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Atualizar
          </button>

          <button
            type="button"
            onClick={openCreate}
            className="bg-purple-600 hover:bg-purple-700 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            Criar Categoria
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-12 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
          </div>
        ) : !categories.length ? (
          <div className="p-12 text-center text-sm text-gray-500">
            Nenhuma categoria cadastrada.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-gray-50 border-b text-gray-500 uppercase font-black text-[10px]">
                  <th className="p-3">
                    Categoria
                  </th>
                  <th className="p-3">
                    Slug
                  </th>
                  <th className="p-3">
                    Produtos
                  </th>
                  <th className="p-3">
                    Status
                  </th>
                  <th className="p-3 text-right">
                    Ações
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y">
                {categories.map(
                  (category) => {
                    const active =
                      category.isActive ??
                      category.status !==
                        'INACTIVE';

                    const products =
                      category._count
                        ?.products ??
                      category.productCount ??
                      0;

                    return (
                      <tr
                        key={category.id}
                      >
                        <td className="p-3">
                          <div className="font-extrabold">
                            {category.name}
                          </div>

                          {category.description && (
                            <div className="text-[10px] text-gray-400 mt-1 max-w-md">
                              {
                                category.description
                              }
                            </div>
                          )}
                        </td>

                        <td className="p-3 font-mono text-gray-500">
                          {category.slug ||
                            '—'}
                        </td>

                        <td className="p-3 font-bold">
                          {products}
                        </td>

                        <td className="p-3">
                          <span
                            className={`px-2 py-1 rounded-full text-[10px] font-black ${
                              active
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            {active
                              ? 'ATIVA'
                              : 'INATIVA'}
                          </span>
                        </td>

                        <td className="p-3">
                          <div className="flex justify-end gap-1">
                            <button
                              type="button"
                              onClick={() =>
                                openEdit(
                                  category,
                                )
                              }
                              className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                void handleDelete(
                                  category,
                                )
                              }
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  },
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-black">
                {editingCategory
                  ? 'Editar Categoria'
                  : 'Criar Categoria'}
              </h3>

              <button
                type="button"
                onClick={() =>
                  setIsModalOpen(false)
                }
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={handleSave}
              className="space-y-4 mt-4 text-xs"
            >
              <div>
                <label className="font-bold block mb-1">
                  Nome
                </label>

                <input
                  required
                  value={formName}
                  onChange={(event) =>
                    setFormName(
                      event.target.value,
                    )
                  }
                  className="w-full border rounded-xl p-2.5"
                />
              </div>

              <div>
                <label className="font-bold block mb-1">
                  Descrição
                </label>

                <textarea
                  value={formDescription}
                  onChange={(event) =>
                    setFormDescription(
                      event.target.value,
                    )
                  }
                  className="w-full border rounded-xl p-2.5 min-h-[90px]"
                />
              </div>

              <label className="flex items-center gap-2 font-bold">
                <input
                  type="checkbox"
                  checked={formActive}
                  onChange={(event) =>
                    setFormActive(
                      event.target.checked,
                    )
                  }
                />
                Categoria ativa
              </label>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() =>
                    setIsModalOpen(false)
                  }
                  className="px-4 py-2 border rounded-xl font-bold"
                >
                  Cancelar
                </button>

                <button
                  disabled={saving}
                  type="submit"
                  className="px-5 py-2 bg-purple-600 text-white rounded-xl font-extrabold flex items-center gap-2 disabled:opacity-50"
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