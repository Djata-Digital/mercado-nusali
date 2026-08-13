import React, {
  useEffect,
  useState,
} from 'react';

import {
  Check,
  Edit2,
  Loader2,
  Plus,
  RefreshCw,
  Tag,
  Trash2,
  X,
} from 'lucide-react';

import { BrandsApi } from '../../api/clients/BrandsApi';

interface Props {
  showToast: (msg: string) => void;
}

interface BrandItem {
  id: string;
  name: string;
  slug?: string;
  description?: string | null;
  status?: string;
  isActive?: boolean;
  isVerified?: boolean;
  productCount?: number;
  _count?: {
    products?: number;
  };
}

const unwrap = (response: any): BrandItem[] => {
  const data = response?.data;

  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.data)) return data.data;

  return [];
};

const slugify = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const errorMessage = (error: any) =>
  error?.response?.data?.message ||
  error?.response?.data?.error?.message ||
  error?.message ||
  'Operação não concluída.';

export const AdminBrandsManager: React.FC<
  Props
> = ({ showToast }) => {
  const [brands, setBrands] =
    useState<BrandItem[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [modal, setModal] =
    useState(false);

  const [editing, setEditing] =
    useState<BrandItem | null>(null);

  const [name, setName] =
    useState('');

  const [description, setDescription] =
    useState('');

  const [active, setActive] =
    useState(true);

  const load = async () => {
    try {
      setLoading(true);

      const response =
        await BrandsApi.listAdmin();

      setBrands(unwrap(response));
    } catch (error: any) {
      showToast(errorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setName('');
    setDescription('');
    setActive(true);
    setModal(true);
  };

  const openEdit = (
    brand: BrandItem,
  ) => {
    setEditing(brand);
    setName(brand.name);
    setDescription(
      brand.description || '',
    );
    setActive(
      brand.isActive ??
        brand.status !== 'INACTIVE',
    );
    setModal(true);
  };

  const save = async (
    event: React.FormEvent,
  ) => {
    event.preventDefault();

    if (!name.trim()) {
      showToast(
        'Informe o nome da marca.',
      );
      return;
    }

    const payload = {
      name: name.trim(),
      slug:
        editing?.slug ||
        slugify(name),
      description:
        description.trim() ||
        undefined,
      isActive: active,
    };

    try {
      setSaving(true);

      if (editing) {
        await BrandsApi.update(
          editing.id,
          payload,
        );

        showToast(
          'Marca atualizada com sucesso.',
        );
      } else {
        await BrandsApi.create(
          payload,
        );

        showToast(
          'Marca cadastrada com sucesso.',
        );
      }

      setModal(false);
      await load();
    } catch (error: any) {
      showToast(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (
    brand: BrandItem,
  ) => {
    if (
      !window.confirm(
        `Remover a marca "${brand.name}"?`,
      )
    ) {
      return;
    }

    try {
      await BrandsApi.delete(brand.id);

      showToast('Marca removida.');
      await load();
    } catch (error: any) {
      showToast(errorMessage(error));
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-6 border border-gray-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black flex items-center gap-2">
            <Tag className="w-6 h-6 text-purple-600" />
            Gestão de Marcas
          </h1>

          <p className="text-xs text-gray-500 mt-1">
            Cadastro real de marcas
            utilizadas pelo catálogo.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void load()}
            className="px-4 py-2.5 bg-gray-100 rounded-xl text-xs font-bold flex gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Atualizar
          </button>

          <button
            type="button"
            onClick={openCreate}
            className="px-4 py-2.5 bg-purple-600 text-white rounded-xl text-xs font-extrabold flex gap-2"
          >
            <Plus className="w-4 h-4" />
            Registrar Marca
          </button>
        </div>
      </div>

      {loading ? (
        <div className="bg-white border rounded-2xl p-12 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
        </div>
      ) : (
        <div className="grid md:grid-cols-3 gap-5">
          {brands.map((brand) => {
            const productCount =
              brand._count?.products ??
              brand.productCount ??
              0;

            const enabled =
              brand.isActive ??
              brand.status !== 'INACTIVE';

            return (
              <div
                key={brand.id}
                className="bg-white rounded-2xl border p-5 space-y-4"
              >
                <div>
                  <div className="flex justify-between gap-2">
                    <h3 className="font-extrabold">
                      {brand.name}
                    </h3>

                    <span
                      className={`text-[10px] px-2 py-1 rounded-full font-black ${
                        enabled
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {enabled
                        ? 'ATIVA'
                        : 'INATIVA'}
                    </span>
                  </div>

                  <p className="text-[10px] text-gray-400 mt-1">
                    {brand.slug || '—'}
                  </p>

                  {brand.description && (
                    <p className="text-xs text-gray-500 mt-3">
                      {brand.description}
                    </p>
                  )}
                </div>

                <div className="border-t pt-3 flex justify-between items-center">
                  <span className="text-xs font-bold text-gray-600">
                    {productCount} produto(s)
                  </span>

                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() =>
                        openEdit(brand)
                      }
                      className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        void remove(brand)
                      }
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6">
            <div className="flex justify-between border-b pb-3">
              <h3 className="font-black">
                {editing
                  ? 'Editar Marca'
                  : 'Registrar Marca'}
              </h3>

              <button
                type="button"
                onClick={() =>
                  setModal(false)
                }
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={save}
              className="space-y-4 mt-4 text-xs"
            >
              <div>
                <label className="font-bold block mb-1">
                  Nome
                </label>

                <input
                  value={name}
                  required
                  onChange={(event) =>
                    setName(
                      event.target.value,
                    )
                  }
                  className="w-full p-2.5 border rounded-xl"
                />
              </div>

              <div>
                <label className="font-bold block mb-1">
                  Descrição
                </label>

                <textarea
                  value={description}
                  onChange={(event) =>
                    setDescription(
                      event.target.value,
                    )
                  }
                  className="w-full p-2.5 border rounded-xl min-h-[90px]"
                />
              </div>

              <label className="flex gap-2 items-center font-bold">
                <input
                  type="checkbox"
                  checked={active}
                  onChange={(event) =>
                    setActive(
                      event.target.checked,
                    )
                  }
                />
                Marca ativa
              </label>

              <div className="flex justify-end gap-2 border-t pt-3">
                <button
                  type="button"
                  onClick={() =>
                    setModal(false)
                  }
                  className="px-4 py-2 border rounded-xl font-bold"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-purple-600 text-white rounded-xl font-black flex gap-2 items-center disabled:opacity-50"
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