import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Loader2,
  PackageCheck,
  RefreshCw,
  Search,
  Truck,
} from 'lucide-react';
import {
  AdminLogisticsApi,
  AdminShipment,
  AdminTracking,
} from '../../api/clients/AdminLogisticsApi';

interface AdminLogisticsDashboardProps {
  showToast: (msg: string) => void;
}

const shipmentStatuses = ['', 'CREATED', 'READY_TO_SHIP', 'DISPATCHED', 'WAITING_CARRIER', 'CANCELLED'];
const trackingStatuses = [
  '',
  'LABEL_CREATED',
  'PICKUP_SCHEDULED',
  'PICKED_UP',
  'RECEIVED_AT_ORIGIN_HUB',
  'IN_TRANSIT',
  'ARRIVED_AT_TRANSIT_HUB',
  'DEPARTED_TRANSIT_HUB',
  'ARRIVED_AT_DESTINATION_HUB',
  'CUSTOMS_PENDING',
  'CUSTOMS_CLEARED',
  'CUSTOMS_HELD',
  'READY_FOR_DELIVERY',
  'OUT_FOR_DELIVERY',
  'DELIVERY_ATTEMPTED',
  'DELIVERED',
  'DELIVERY_FAILED',
  'RETURN_REQUESTED',
  'RETURN_IN_TRANSIT',
  'RETURNED',
  'LOST',
  'DAMAGED',
  'CANCELLED',
  'EXCEPTION',
];

const date = (value?: string | null) =>
  value
    ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
    : '—';

const statusLabel = (status?: string | null) =>
  (status || 'SEM_STATUS').replaceAll('_', ' ');

const unwrapShipments = (response: any): { items: AdminShipment[]; total: number } => {
  const payload = response?.data;
  const nested = payload?.data;
  const items = Array.isArray(nested) ? nested : Array.isArray(payload) ? payload : [];
  const total = Number(payload?.meta?.total ?? response?.meta?.total ?? items.length);
  return { items, total };
};

const unwrapTrackings = (response: any): AdminTracking[] =>
  Array.isArray(response?.data) ? response.data : [];

export const AdminLogisticsDashboard: React.FC<AdminLogisticsDashboardProps> = ({ showToast }) => {
  const [tab, setTab] = useState<'shipments' | 'tracking'>('shipments');
  const [shipmentStatus, setShipmentStatus] = useState('');
  const [trackingStatus, setTrackingStatus] = useState('');
  const [search, setSearch] = useState('');

  const shipmentsQuery = useQuery({
    queryKey: ['admin-logistics-shipments', shipmentStatus],
    queryFn: async () =>
      unwrapShipments(
        await AdminLogisticsApi.listShipments({
          page: 1,
          limit: 100,
          ...(shipmentStatus ? { status: shipmentStatus } : {}),
        }),
      ),
    retry: false,
  });

  const trackingsQuery = useQuery({
    queryKey: ['admin-logistics-trackings', trackingStatus],
    queryFn: async () =>
      unwrapTrackings(
        await AdminLogisticsApi.listTrackings(
          trackingStatus ? { status: trackingStatus } : undefined,
        ),
      ),
    retry: false,
  });

  const shipments = shipmentsQuery.data?.items || [];
  const trackings = trackingsQuery.data || [];

  const visibleShipments = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return shipments;
    return shipments.filter((shipment) =>
      [
        shipment.shipmentCode,
        shipment.order?.orderNumber,
        shipment.packingOrder?.packingNumber,
        shipment.manifest?.manifestNumber,
        ...(shipment.packages || []).map((pkg) => pkg.trackingCode),
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q)),
    );
  }, [shipments, search]);

  const visibleTrackings = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return trackings;
    return trackings.filter((tracking) =>
      [
        tracking.trackingNumber,
        tracking.externalTrackingNumber,
        tracking.carrier?.name,
        tracking.shipment?.shipmentCode,
        tracking.shipment?.order?.orderNumber,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q)),
    );
  }, [trackings, search]);

  const refresh = async () => {
    const result =
      tab === 'shipments'
        ? await shipmentsQuery.refetch()
        : await trackingsQuery.refetch();

    if (result.error) {
      showToast('Não foi possível atualizar os dados logísticos.');
      return;
    }
    showToast('Dados logísticos atualizados a partir do backend.');
  };

  const loading = shipmentsQuery.isLoading || trackingsQuery.isLoading;
  const error = shipmentsQuery.error || trackingsQuery.error;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
            <Truck className="w-6 h-6 text-purple-600" />
            Nusali Logística
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Expedições e rastreamentos persistidos no backend. Nenhum envio, transportadora ou prazo é simulado nesta tela.
          </p>
        </div>
        <button
          onClick={() => void refresh()}
          disabled={shipmentsQuery.isFetching || trackingsQuery.isFetching}
          className="px-4 py-2 rounded-xl bg-purple-600 text-white text-xs font-black flex items-center gap-2 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${(shipmentsQuery.isFetching || trackingsQuery.isFetching) ? 'animate-spin' : ''}`} />
          Atualizar
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <div className="text-xs text-gray-500">Expedições persistidas</div>
          <div className="text-2xl font-black text-gray-900 mt-1">{shipmentsQuery.data?.total ?? 0}</div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <div className="text-xs text-gray-500">Rastreamentos carregados</div>
          <div className="text-2xl font-black text-gray-900 mt-1">{trackings.length}</div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <div className="text-xs text-gray-500">Em trânsito</div>
          <div className="text-2xl font-black text-gray-900 mt-1">
            {trackings.filter((item) => item.currentStatus === 'IN_TRANSIT').length}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-4 flex flex-col lg:flex-row gap-3 lg:items-center">
        <div className="flex gap-2">
          <button
            onClick={() => setTab('shipments')}
            className={`px-4 py-2 rounded-xl text-xs font-black ${tab === 'shipments' ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-700'}`}
          >
            Expedições
          </button>
          <button
            onClick={() => setTab('tracking')}
            className={`px-4 py-2 rounded-xl text-xs font-black ${tab === 'tracking' ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-700'}`}
          >
            Rastreamentos
          </button>
        </div>

        <div className="relative flex-1">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por pedido, envio, packing, manifesto ou rastreio"
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-xs outline-none focus:border-purple-400"
          />
        </div>

        {tab === 'shipments' ? (
          <select
            value={shipmentStatus}
            onChange={(event) => setShipmentStatus(event.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-xl text-xs bg-white"
          >
            {shipmentStatuses.map((status) => (
              <option key={status || 'ALL'} value={status}>
                {status ? statusLabel(status) : 'Todos os status'}
              </option>
            ))}
          </select>
        ) : (
          <select
            value={trackingStatus}
            onChange={(event) => setTrackingStatus(event.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-xl text-xs bg-white"
          >
            {trackingStatuses.map((status) => (
              <option key={status || 'ALL'} value={status}>
                {status ? statusLabel(status) : 'Todos os status'}
              </option>
            ))}
          </select>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-2xl p-4 text-sm flex gap-2">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span>
            A API logística recusou ou não conseguiu atender a consulta. Verifique autenticação/permissões e a disponibilidade do backend.
          </span>
        </div>
      )}

      {loading ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-10 flex items-center justify-center gap-3 text-sm text-gray-600">
          <Loader2 className="w-5 h-5 animate-spin" />
          Carregando dados reais...
        </div>
      ) : tab === 'shipments' ? (
        <div className="space-y-3">
          {visibleShipments.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center text-sm text-gray-500">
              Nenhuma expedição real encontrada para os filtros atuais.
            </div>
          ) : (
            visibleShipments.map((shipment) => (
              <div key={shipment.id} className="bg-white rounded-2xl border border-gray-200 p-5 grid lg:grid-cols-[1.1fr_1fr_1fr_1fr] gap-4 text-xs">
                <div>
                  <div className="text-gray-500">Expedição</div>
                  <div className="font-black text-gray-900 mt-1">{shipment.shipmentCode}</div>
                  <div className="text-gray-400 mt-1">{date(shipment.createdAt)}</div>
                </div>
                <div>
                  <div className="text-gray-500">Pedido / Packing</div>
                  <div className="font-bold text-gray-900 mt-1">{shipment.order?.orderNumber || '—'}</div>
                  <div className="text-gray-500 mt-1">{shipment.packingOrder?.packingNumber || '—'}</div>
                </div>
                <div>
                  <div className="text-gray-500">Status</div>
                  <div className="font-black text-purple-800 mt-1">{statusLabel(shipment.status)}</div>
                  <div className="text-gray-500 mt-1">
                    {shipment.dispatchedAt ? `Despachado: ${date(shipment.dispatchedAt)}` : 'Ainda não despachado'}
                  </div>
                </div>
                <div>
                  <div className="text-gray-500">Rastreio / Manifesto</div>
                  <div className="font-bold text-gray-900 mt-1">
                    {shipment.packages?.map((pkg) => pkg.trackingCode).filter(Boolean).join(', ') || '—'}
                  </div>
                  <div className="text-gray-500 mt-1">
                    {shipment.manifest?.manifestNumber || 'Sem romaneio'}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {visibleTrackings.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center text-sm text-gray-500">
              Nenhum rastreamento real encontrado para os filtros atuais.
            </div>
          ) : (
            visibleTrackings.map((tracking) => (
              <div key={tracking.id} className="bg-white rounded-2xl border border-gray-200 p-5 grid lg:grid-cols-[1.1fr_1fr_1fr_1.2fr] gap-4 text-xs">
                <div>
                  <div className="text-gray-500">Rastreamento</div>
                  <div className="font-black text-gray-900 mt-1">{tracking.trackingNumber}</div>
                  <div className="text-gray-400 mt-1">{tracking.externalTrackingNumber || 'Sem código externo'}</div>
                </div>
                <div>
                  <div className="text-gray-500">Transportadora</div>
                  <div className="font-bold text-gray-900 mt-1">{tracking.carrier?.name || '—'}</div>
                  <div className="text-gray-500 mt-1">
                    {tracking.isInternational ? 'Internacional' : 'Nacional/local'}
                  </div>
                </div>
                <div>
                  <div className="text-gray-500">Status atual</div>
                  <div className="font-black text-purple-800 mt-1">{statusLabel(tracking.currentStatus)}</div>
                  <div className="text-gray-500 mt-1">Último evento: {date(tracking.lastEventAt)}</div>
                </div>
                <div>
                  <div className="text-gray-500">Pedido / último evento</div>
                  <div className="font-bold text-gray-900 mt-1">{tracking.shipment?.order?.orderNumber || '—'}</div>
                  <div className="text-gray-500 mt-1">
                    {tracking.events?.[0]?.title || 'Nenhum evento registrado'}
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    {tracking.currentStatus === 'DELIVERED' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    ) : tracking.currentStatus === 'EXCEPTION' || tracking.currentStatus === 'LOST' ? (
                      <AlertTriangle className="w-4 h-4 text-red-600" />
                    ) : (
                      <Clock3 className="w-4 h-4 text-amber-600" />
                    )}
                    <span className="text-gray-500">Previsão: {date(tracking.estimatedDeliveryAt)}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-xs text-blue-900 flex gap-2">
        <PackageCheck className="w-5 h-5 shrink-0" />
        <span>
          Este painel é de monitoramento real. Despacho de shipment, romaneios, eventos manuais e overrides de tracking continuam protegidos pelos endpoints operacionais e permissões específicas do backend.
        </span>
      </div>
    </div>
  );
};
