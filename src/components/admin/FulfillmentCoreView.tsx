import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2,
  ClipboardCheck,
  Loader2,
  PackageCheck,
  RefreshCw,
  Send,
  Truck,
} from 'lucide-react';
import { FulfillmentOpsApi } from '../../api/clients/FulfillmentOpsApi';

interface Props {
  showToast: (message: string) => void;
}

type Tab = 'orders' | 'picking' | 'packing' | 'shipping' | 'manifests';

const date = (value?: string | null) =>
  value ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : '—';

const unwrap = (response: any) => {
  const body = response?.data;
  if (Array.isArray(body)) return { items: body, total: body.length };
  if (Array.isArray(body?.data)) return { items: body.data, total: Number(body?.meta?.total || body.data.length) };
  if (Array.isArray(body?.items)) return { items: body.items, total: Number(body?.total || body.items.length) };
  return { items: [], total: 0 };
};

const statusText = (status?: string) => (status || '—').replaceAll('_', ' ');

export const FulfillmentCoreView: React.FC<Props> = ({ showToast }) => {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('orders');
  const [busy, setBusy] = useState<string | null>(null);

  const paidOrders = useQuery({
    queryKey: ['fulfillment-paid-orders'],
    queryFn: async () => unwrap(await FulfillmentOpsApi.listPaidOrders()),
    retry: false,
  });
  const picking = useQuery({
    queryKey: ['fulfillment-picking'],
    queryFn: async () => unwrap(await FulfillmentOpsApi.listPicking({ page: 1, limit: 100 })),
    retry: false,
  });
  const packing = useQuery({
    queryKey: ['fulfillment-packing'],
    queryFn: async () => unwrap(await FulfillmentOpsApi.listPacking({ page: 1, limit: 100 })),
    retry: false,
  });
  const shipping = useQuery({
    queryKey: ['fulfillment-shipping'],
    queryFn: async () => unwrap(await FulfillmentOpsApi.listShipments({ page: 1, limit: 100 })),
    retry: false,
  });
  const manifests = useQuery({
    queryKey: ['fulfillment-manifests'],
    queryFn: async () => unwrap(await FulfillmentOpsApi.listManifests({ page: 1, limit: 100 })),
    retry: false,
  });

  const invalidate = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['fulfillment-paid-orders'] }),
      qc.invalidateQueries({ queryKey: ['fulfillment-picking'] }),
      qc.invalidateQueries({ queryKey: ['fulfillment-packing'] }),
      qc.invalidateQueries({ queryKey: ['fulfillment-shipping'] }),
      qc.invalidateQueries({ queryKey: ['fulfillment-manifests'] }),
      qc.invalidateQueries({ queryKey: ['admin-core-audit'] }),
    ]);
  };

  const run = async (key: string, fn: () => Promise<any>, success: string) => {
    setBusy(key);
    try {
      await fn();
      await invalidate();
      showToast(success);
    } catch (error: any) {
      showToast(error?.response?.data?.message || error?.message || 'Operação não concluída.');
    } finally {
      setBusy(null);
    }
  };

  const generatePicking = (order: any) =>
    run(`order-${order.id}`, () => FulfillmentOpsApi.generatePicking(order.id), 'Picking gerado pelo backend.');

  const startPicking = (item: any) =>
    run(`pick-start-${item.id}`, () => FulfillmentOpsApi.startPicking(item.id), 'Separação iniciada.');

  const completePicking = async (item: any) => {
    setBusy(`pick-complete-${item.id}`);
    try {
      const detail = (await FulfillmentOpsApi.getPicking(item.id)).data;
      const items = Array.isArray(detail?.items) ? detail.items : [];
      if (!items.length) throw new Error('Picking sem itens para confirmar.');

      const confirmed = window.confirm(
        `Confirmar separação física COMPLETA de ${items.length} item(ns) usando as quantidades esperadas?`,
      );
      if (!confirmed) return;

      await FulfillmentOpsApi.completePicking(
        item.id,
        items.map((line: any) => ({
          pickingItemId: line.id,
          pickedQuantity: Number(line.expectedQuantity || 0),
          ...(line.location?.code ? { locationCode: line.location.code } : {}),
        })),
      );
      await invalidate();
      showToast('Picking concluído com as quantidades confirmadas.');
    } catch (error: any) {
      showToast(error?.response?.data?.message || error?.message || 'Não foi possível concluir o picking.');
    } finally {
      setBusy(null);
    }
  };

  const startPacking = (item: any) =>
    run(`pack-start-${item.id}`, () => FulfillmentOpsApi.startPacking(item.id), 'Packing iniciado.');

  const completePacking = async (item: any) => {
    const grossWeight = Number(window.prompt('Peso bruto REAL do pacote em kg:') || '');
    const width = Number(window.prompt('Largura REAL em cm:') || '');
    const height = Number(window.prompt('Altura REAL em cm:') || '');
    const length = Number(window.prompt('Comprimento REAL em cm:') || '');
    if (!(grossWeight > 0) || !(width > 0) || !(height > 0) || !(length > 0)) {
      showToast('Peso e dimensões reais são obrigatórios.');
      return;
    }
    const sealCode = window.prompt('Código do lacre (opcional):')?.trim() || undefined;
    await run(
      `pack-complete-${item.id}`,
      () => FulfillmentOpsApi.completePacking(item.id, { grossWeight, width, height, length, sealCode }),
      'Packing concluído com peso e dimensões persistidos.',
    );
  };

  const generateLabel = async (item: any) => {
    const carrierName = window.prompt('Nome REAL da transportadora responsável:')?.trim();
    if (!carrierName) {
      showToast('A transportadora é obrigatória para gerar a etiqueta.');
      return;
    }
    await run(
      `label-${item.id}`,
      () => FulfillmentOpsApi.generateLabel(item.id, carrierName),
      'Etiqueta real gerada no backend.',
    );
  };

  const createShipment = (item: any) =>
    run(`shipment-${item.id}`, () => FulfillmentOpsApi.createShipment(item.id), 'Shipment criado a partir da etiqueta real.');

  const createManifest = async (shipment: any) => {
    const carrierName = window.prompt('Transportadora REAL do romaneio:')?.trim();
    if (!carrierName) {
      showToast('A transportadora do romaneio é obrigatória.');
      return;
    }
    const driverName = window.prompt('Nome do motorista (opcional):')?.trim() || undefined;
    const driverDocument = driverName ? window.prompt('Documento do motorista (opcional):')?.trim() || undefined : undefined;
    const vehiclePlate = window.prompt('Placa do veículo (opcional):')?.trim() || undefined;

    await run(
      `manifest-${shipment.id}`,
      () =>
        FulfillmentOpsApi.createManifest({
          warehouseId: shipment.warehouseId,
          shipmentIds: [shipment.id],
          carrierName,
          driverName,
          driverDocument,
          vehiclePlate,
        }),
      'Romaneio criado com dados operacionais reais.',
    );
  };

  const closeManifest = (manifest: any) =>
    run(`manifest-close-${manifest.id}`, () => FulfillmentOpsApi.closeManifest(manifest.id), 'Romaneio fechado.');

  const dispatchManifest = async (manifest: any) => {
    const confirmed = window.confirm(
      `CONFIRMAR saída física do romaneio ${manifest.manifestNumber}? Esta ação marca os shipments como DISPATCHED e os pedidos como SHIPPED.`,
    );
    if (!confirmed) return;
    await run(
      `manifest-dispatch-${manifest.id}`,
      () => FulfillmentOpsApi.dispatchManifest(manifest.id),
      'Romaneio despachado e pedidos marcados como enviados.',
    );
  };

  const tabs: Array<[Tab, string]> = [
    ['orders', 'Pedidos pagos'],
    ['picking', 'Picking'],
    ['packing', 'Packing'],
    ['shipping', 'Shipments'],
    ['manifests', 'Romaneios'],
  ];

  const loading = paidOrders.isLoading || picking.isLoading || packing.isLoading || shipping.isLoading || manifests.isLoading;

  if (loading) {
    return <div className="py-14 flex justify-center text-emerald-700"><Loader2 className="w-7 h-7 animate-spin" /></div>;
  }

  return (
    <div className="space-y-5">
      <div className="bg-white border rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-gray-900">Fulfillment Core Real</h2>
          <p className="text-xs text-gray-500 mt-1">
            Operação física: pedido pago → picking → packing → etiqueta → shipment → romaneio → despacho.
          </p>
        </div>
        <button onClick={() => void invalidate()} className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold flex items-center gap-2">
          <RefreshCw className="w-4 h-4" /> Atualizar
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto">
        {tabs.map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} className={`px-4 py-2 rounded-xl text-xs font-black whitespace-nowrap ${tab === id ? 'bg-purple-600 text-white' : 'bg-white border text-gray-600'}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'orders' && (
        <Queue
          empty="Nenhum pedido PAID aguardando fulfillment."
          items={paidOrders.data?.items || []}
          render={(order: any) => (
            <Row key={order.id}
              title={order.orderNumber}
              subtitle={`Status: ${statusText(order.status)} • ${date(order.createdAt)}`}
              action={<Action busy={busy === `order-${order.id}`} onClick={() => generatePicking(order)} label="Gerar Picking" />}
            />
          )}
        />
      )}

      {tab === 'picking' && (
        <Queue
          empty="Nenhuma ordem de picking."
          items={picking.data?.items || []}
          render={(item: any) => (
            <Row key={item.id}
              title={item.pickingNumber || item.id}
              subtitle={`Pedido ${item.order?.orderNumber || item.orderId} • ${statusText(item.status)} • ${item._count?.items || 0} itens`}
              action={
                item.status === 'CREATED' || item.status === 'ASSIGNED'
                  ? <Action busy={busy === `pick-start-${item.id}`} onClick={() => startPicking(item)} label="Iniciar" />
                  : item.status === 'IN_PROGRESS'
                    ? <Action busy={busy === `pick-complete-${item.id}`} onClick={() => void completePicking(item)} label="Confirmar separação" />
                    : item.status === 'PICKED'
                      ? <Action busy={busy === `pack-start-${item.id}`} onClick={() => startPacking(item)} label="Iniciar Packing" />
                      : <Badge text={statusText(item.status)} />
              }
            />
          )}
        />
      )}

      {tab === 'packing' && (
        <Queue
          empty="Nenhuma ordem de packing."
          items={packing.data?.items || []}
          render={(item: any) => (
            <Row key={item.id}
              title={item.packingNumber || item.id}
              subtitle={`Pedido ${item.order?.orderNumber || item.orderId} • ${statusText(item.status)} • ${date(item.createdAt)}`}
              action={
                item.status === 'IN_PROGRESS'
                  ? <Action busy={busy === `pack-complete-${item.id}`} onClick={() => void completePacking(item)} label="Concluir embalagem" />
                  : item.status === 'PACKED'
                    ? <div className="flex gap-2 flex-wrap">
                        <Action busy={busy === `label-${item.id}`} onClick={() => void generateLabel(item)} label="Gerar/validar etiqueta" />
                        <Action busy={busy === `shipment-${item.id}`} onClick={() => createShipment(item)} label="Criar Shipment" />
                      </div>
                    : <Badge text={statusText(item.status)} />
              }
            />
          )}
        />
      )}

      {tab === 'shipping' && (
        <Queue
          empty="Nenhum shipment."
          items={shipping.data?.items || []}
          render={(item: any) => (
            <Row key={item.id}
              title={item.shipmentCode}
              subtitle={`Pedido ${item.order?.orderNumber || item.orderId} • ${statusText(item.status)} • ${item.packages?.[0]?.trackingCode || 'sem tracking'}`}
              action={
                !item.manifestId && (item.status === 'CREATED' || item.status === 'READY_TO_SHIP')
                  ? <Action busy={busy === `manifest-${item.id}`} onClick={() => void createManifest(item)} label="Criar Romaneio" />
                  : <Badge text={item.manifest?.manifestNumber || statusText(item.status)} />
              }
            />
          )}
        />
      )}

      {tab === 'manifests' && (
        <Queue
          empty="Nenhum romaneio."
          items={manifests.data?.items || []}
          render={(item: any) => (
            <Row key={item.id}
              title={item.manifestNumber}
              subtitle={`${statusText(item.status)} • ${item._count?.items ?? item.totalPackages ?? 0} pacote(s) • ${date(item.createdAt)}`}
              action={
                item.status === 'CREATED'
                  ? <Action busy={busy === `manifest-close-${item.id}`} onClick={() => closeManifest(item)} label="Fechar Romaneio" />
                  : item.status === 'CLOSED'
                    ? <Action busy={busy === `manifest-dispatch-${item.id}`} onClick={() => void dispatchManifest(item)} label="Confirmar Despacho" />
                    : <Badge text={statusText(item.status)} />
              }
            />
          )}
        />
      )}

      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs text-amber-900">
        As ações de conclusão representam confirmação física da operação. Não use “Confirmar separação”, “Concluir embalagem” ou “Confirmar Despacho” antes da execução real no HUB.
      </div>
    </div>
  );
};

const Queue: React.FC<{ items: any[]; empty: string; render: (item: any) => React.ReactNode }> = ({ items, empty, render }) =>
  items.length ? <div className="space-y-3">{items.map(render)}</div> : <div className="bg-white border rounded-2xl p-10 text-center text-sm text-gray-500">{empty}</div>;

const Row: React.FC<{ title: string; subtitle: string; action: React.ReactNode }> = ({ title, subtitle, action }) => (
  <div className="bg-white border border-gray-200 rounded-2xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
    <div>
      <div className="font-black text-gray-900">{title}</div>
      <div className="text-xs text-gray-500 mt-1">{subtitle}</div>
    </div>
    <div>{action}</div>
  </div>
);

const Action: React.FC<{ busy: boolean; onClick: () => void; label: string }> = ({ busy, onClick, label }) => (
  <button disabled={busy} onClick={onClick} className="px-3 py-2 bg-purple-600 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-2">
    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
    {label}
  </button>
);

const Badge: React.FC<{ text: string }> = ({ text }) => <span className="px-3 py-2 bg-gray-100 text-gray-700 rounded-xl text-xs font-bold">{text}</span>;
