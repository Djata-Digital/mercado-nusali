import React, {
  useEffect,
  useState,
} from 'react';

import {
  CheckCircle2,
  Loader2,
  Package,
  Plus,
  RefreshCw,
  Warehouse,
  X,
} from 'lucide-react';

import { WarehouseApi } from '../../api/clients/WarehouseApi';

interface Props {
  showToast: (
    message: string,
  ) => void;
}

const unwrap = (
  response: any,
): any[] => {
  const data = response?.data;

  if (Array.isArray(data)) {
    return data;
  }

  if (Array.isArray(data?.items)) {
    return data.items;
  }

  return [];
};

const errorMessage = (
  error: any,
) =>
  error?.response?.data?.error
    ?.message ||
  error?.response?.data?.message ||
  error?.message ||
  'Não foi possível concluir a operação.';

export const AdminWarehousesManager:
React.FC<Props> = ({
  showToast,
}) => {
  const [
    warehouses,
    setWarehouses,
  ] = useState<any[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [modal, setModal] =
    useState(false);

  const [name, setName] =
    useState('');

  const [code, setCode] =
    useState('');

  const [
    countryCode,
    setCountryCode,
  ] = useState('GW');

  const [city, setCity] =
    useState('');

  const [
    addressLine1,
    setAddressLine1,
  ] = useState('');

  const [
    capacity,
    setCapacity,
  ] = useState('0');

  const [
    warehouseType,
    setWarehouseType,
  ] = useState('PLATFORM_HUB');

  const load =
    async () => {
      try {
        setLoading(true);

        const response =
          await WarehouseApi.listAdmin(
            {
              page: 1,
              limit: 100,
            },
          );

        setWarehouses(
          unwrap(response),
        );
      } catch (
        error: any
      ) {
        showToast(
          errorMessage(error),
        );
      } finally {
        setLoading(false);
      }
    };

  useEffect(() => {
    void load();
  }, []);

  const create =
    async (
      event:
        React.FormEvent,
    ) => {
      event.preventDefault();

      if (
        !name.trim() ||
        !code.trim()
      ) {
        showToast(
          'Informe nome e código do armazém.',
        );
        return;
      }

      try {
        setSaving(true);

        await WarehouseApi.create(
          {
            name:
              name.trim(),

            code:
              code
                .trim()
                .toUpperCase(),

            countryCode,

            type:
              warehouseType,

            city:
              city.trim() ||
              undefined,

            addressLine1:
              addressLine1.trim() ||
              undefined,

            capacity:
              Number(
                capacity,
              ) || 0,
          },
        );

        showToast(
          'Armazém/HUB criado com sucesso.',
        );

        setModal(false);

        setName('');
        setCode('');
        setCity('');
        setAddressLine1('');
        setCapacity('0');

        await load();
      } catch (
        error: any
      ) {
        showToast(
          errorMessage(error),
        );
      } finally {
        setSaving(false);
      }
    };

  const changeStatus =
    async (
      warehouse: any,
      status: string,
    ) => {
      try {
        await WarehouseApi.updateAdminStatus(
          warehouse.id,
          {
            status,
          },
        );

        showToast(
          `Status do armazém ${warehouse.code} atualizado.`,
        );

        await load();
      } catch (
        error: any
      ) {
        showToast(
          errorMessage(error),
        );
      }
    };

  return (
    <div className="space-y-6">
      <div className="bg-white border rounded-2xl p-6 flex flex-col md:flex-row justify-between md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black flex items-center gap-2">
            <Warehouse className="w-6 h-6 text-purple-600" />
            Armazéns & HUBs
          </h1>

          <p className="text-xs text-gray-500 mt-1">
            Gestão real da
            infraestrutura de
            armazenagem do
            marketplace.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() =>
              void load()
            }
            className="px-4 py-2 bg-gray-100 rounded-xl text-xs font-bold flex gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Atualizar
          </button>

          <button
            onClick={() =>
              setModal(true)
            }
            className="px-4 py-2 bg-purple-600 text-white rounded-xl text-xs font-black flex gap-2"
          >
            <Plus className="w-4 h-4" />
            Novo HUB
          </button>
        </div>
      </div>

      {loading ? (
        <div className="bg-white border rounded-2xl p-12 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
        </div>
      ) : !warehouses.length ? (
        <div className="bg-white border rounded-2xl p-12 text-center text-gray-500">
          Nenhum armazém
          cadastrado.
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-5">
          {warehouses.map(
            (warehouse) => (
              <div
                key={
                  warehouse.id
                }
                className="bg-white border rounded-2xl p-5 space-y-4"
              >
                <div className="flex justify-between">
                  <div>
                    <span className="text-[10px] text-gray-400 font-mono">
                      {warehouse.code}
                    </span>

                    <h3 className="font-black mt-1">
                      {warehouse.name}
                    </h3>

                    <p className="text-xs text-purple-700 font-bold mt-1">
                      {warehouse
                        .country
                        ?.name ||
                        warehouse
                          .country
                          ?.code ||
                        '—'}
                    </p>
                  </div>

                  <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-1 rounded-full h-fit font-black">
                    {
                      warehouse.status
                    }
                  </span>
                </div>

                <div className="bg-gray-50 rounded-xl p-3 text-xs space-y-2">
                  <Info
                    label="Tipo"
                    value={
                      warehouse.type ||
                      '—'
                    }
                  />

                  <Info
                    label="Cidade"
                    value={
                      warehouse.city ||
                      '—'
                    }
                  />

                  <Info
                    label="Capacidade"
                    value={
                      warehouse.capacity ??
                      0
                    }
                  />

                  <Info
                    label="Vendedor"
                    value={
                      warehouse
                        .seller
                        ?.tradeName ||
                      warehouse
                        .seller
                        ?.legalName ||
                      'Plataforma'
                    }
                  />
                </div>

                <div className="flex gap-2 border-t pt-3">
                  {warehouse.status !==
                    'ACTIVE' && (
                    <button
                      onClick={() =>
                        void changeStatus(
                          warehouse,
                          'ACTIVE',
                        )
                      }
                      className="px-3 py-2 bg-emerald-50 text-emerald-700 rounded-xl text-xs font-bold flex gap-1"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Ativar
                    </button>
                  )}

                  {warehouse.status ===
                    'ACTIVE' && (
                    <button
                      onClick={() =>
                        void changeStatus(
                          warehouse,
                          'INACTIVE',
                        )
                      }
                      className="px-3 py-2 bg-amber-50 text-amber-700 rounded-xl text-xs font-bold"
                    >
                      Desativar
                    </button>
                  )}
                </div>
              </div>
            ),
          )}
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white max-w-lg w-full rounded-2xl p-6">
            <div className="flex justify-between border-b pb-3">
              <h3 className="font-black flex gap-2">
                <Package className="w-5 h-5 text-purple-600" />
                Cadastrar HUB
              </h3>

              <button
                onClick={() =>
                  setModal(false)
                }
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={create}
              className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 text-xs"
            >
              <Field
                label="Nome"
                value={name}
                onChange={
                  setName
                }
              />

              <Field
                label="Código"
                value={code}
                onChange={
                  setCode
                }
              />

              <div>
                <label className="font-bold block mb-1">
                  País
                </label>

                <select
                  value={
                    countryCode
                  }
                  onChange={(
                    event,
                  ) =>
                    setCountryCode(
                      event.target
                        .value,
                    )
                  }
                  className="w-full border rounded-xl p-2.5"
                >
                  <option value="GW">
                    Guiné-Bissau
                  </option>
                  <option value="BR">
                    Brasil
                  </option>
                  <option value="PT">
                    Portugal
                  </option>
                  <option value="AO">
                    Angola
                  </option>
                </select>
              </div>

              <div>
                <label className="font-bold block mb-1">
                  Tipo
                </label>

                <select
                  value={
                    warehouseType
                  }
                  onChange={(
                    event,
                  ) =>
                    setWarehouseType(
                      event.target
                        .value,
                    )
                  }
                  className="w-full border rounded-xl p-2.5"
                >
                  <option value="PLATFORM_HUB">
                    HUB da Plataforma
                  </option>

                  <option value="TRANSIT_HUB">
                    HUB de Trânsito
                  </option>

                  <option value="PARTNER_WAREHOUSE">
                    Armazém Parceiro
                  </option>
                </select>
              </div>

              <Field
                label="Cidade"
                value={city}
                onChange={
                  setCity
                }
              />

              <Field
                label="Capacidade"
                value={capacity}
                onChange={
                  setCapacity
                }
              />

              <div className="md:col-span-2">
                <Field
                  label="Endereço"
                  value={
                    addressLine1
                  }
                  onChange={
                    setAddressLine1
                  }
                />
              </div>

              <div className="md:col-span-2 flex justify-end gap-2 border-t pt-4">
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
                  disabled={
                    saving
                  }
                  className="px-5 py-2 bg-purple-600 text-white rounded-xl font-black disabled:opacity-50"
                >
                  {saving
                    ? 'Salvando...'
                    : 'Cadastrar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const Info: React.FC<{
  label: string;
  value: React.ReactNode;
}> = ({
  label,
  value,
}) => (
  <div className="flex justify-between">
    <span className="text-gray-500">
      {label}
    </span>

    <strong>
      {value}
    </strong>
  </div>
);

const Field: React.FC<{
  label: string;
  value: string;
  onChange: (
    value: string,
  ) => void;
}> = ({
  label,
  value,
  onChange,
}) => (
  <div>
    <label className="font-bold block mb-1">
      {label}
    </label>

    <input
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