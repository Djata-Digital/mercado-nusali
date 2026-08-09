const fs = require('fs');
const path = require('path');
const ROOT = process.cwd();

function replaceRequired(rel, before, after) {
  const file = path.join(ROOT, rel);
  let s = fs.readFileSync(file, 'utf8');
  if (s.includes(after)) {
    console.log('OK', rel, '(já aplicado)');
    return;
  }
  if (!s.includes(before)) throw new Error(`Trecho esperado não encontrado em ${rel}`);
  s = s.replace(before, after);
  fs.writeFileSync(file, s, 'utf8');
  console.log('OK', rel);
}

function insertBeforeClassEnd(rel, marker, block) {
  const file = path.join(ROOT, rel);
  let s = fs.readFileSync(file, 'utf8');
  if (s.includes(block.trim())) {
    console.log('OK', rel, '(já aplicado)');
    return;
  }
  const idx = s.lastIndexOf(marker);
  if (idx < 0) throw new Error(`Fim da classe não encontrado em ${rel}`);
  s = s.slice(0, idx) + block + '\n' + s.slice(idx);
  fs.writeFileSync(file, s, 'utf8');
  console.log('OK', rel);
}

console.log('=== Sprint 8.4.2 — Seller Order Processing Real ===');

insertBeforeClassEnd(
  'src/api/clients/OrdersApi.ts',
  '\n}',
  "\n  static updateSellerStatus(\n    id: string,\n    status: 'PREPARING' | 'READY_FOR_SHIPMENT',\n    reason?: string,\n  ): Promise<ApiResponse<BuyerOrder>> {\n    return apiClient.patch(`/orders/${id}/status`, {\n      status,\n      ...(reason ? { reason } : {}),\n    });\n  }\n"
);

replaceRequired(
  'src/components/SellerHubView.tsx',
  "  PROCESSING: 'Em preparação',\n  READY_TO_SHIP: 'Pronto para envio',",
  "  PREPARING: 'Em preparação',\n  READY_FOR_SHIPMENT: 'Pronto para expedição',"
);

replaceRequired(
  'src/components/SellerHubView.tsx',
  "  const productAction = async (id: string, action: 'submit' | 'pause' | 'activate' | 'delete') => {",
  `  const orderStatusAction = async (
    id: string,
    status: 'PREPARING' | 'READY_FOR_SHIPMENT',
  ) => {
    setActionMessage(null);
    try {
      await OrdersApi.updateSellerStatus(id, status);
      await queryClient.invalidateQueries({ queryKey: ['seller-orders-real'] });
      setActionMessage(
        status === 'PREPARING'
          ? 'Pedido marcado como em preparação no backend.'
          : 'Pedido marcado como pronto para expedição no backend.',
      );
    } catch (error: any) {
      setActionMessage(
        error?.response?.data?.message ||
          error?.message ||
          'Não foi possível atualizar o pedido.',
      );
    }
  };

  const productAction = async (id: string, action: 'submit' | 'pause' | 'activate' | 'delete') => {`
);

const oldRow = `                  <div key={order.id} className="p-5 grid lg:grid-cols-4 gap-4 text-xs">
                    <div>
                      <div className="text-gray-500">Pedido</div>
                      <div className="font-black text-gray-900 mt-1">{order.orderNumber}</div>
                      <div className="text-gray-400 mt-1">{date(order.createdAt)}</div>
                    </div>
                    <div>
                      <div className="text-gray-500">Cliente</div>
                      <div className="font-bold text-gray-900 mt-1">{order.user?.name || order.user?.email || 'Cliente'}</div>
                    </div>
                    <div>
                      <div className="text-gray-500">Status</div>
                      <div className="font-black text-emerald-800 mt-1">{statusLabel[order.status] || order.status}</div>
                    </div>
                    <div>
                      <div className="text-gray-500">Total persistido</div>
                      <div className="font-black text-gray-900 mt-1">
                        {money(order.total, order.priceSnapshotRelation?.currencyCode || 'XOF')}
                      </div>
                    </div>
                  </div>`;

const newRow = `                  <div key={order.id} className="p-5 grid lg:grid-cols-[1fr_1fr_1fr_1fr_auto] gap-4 text-xs lg:items-center">
                    <div>
                      <div className="text-gray-500">Pedido</div>
                      <div className="font-black text-gray-900 mt-1">{order.orderNumber}</div>
                      <div className="text-gray-400 mt-1">{date(order.createdAt)}</div>
                    </div>
                    <div>
                      <div className="text-gray-500">Cliente</div>
                      <div className="font-bold text-gray-900 mt-1">{order.user?.name || order.user?.email || 'Cliente'}</div>
                    </div>
                    <div>
                      <div className="text-gray-500">Status</div>
                      <div className="font-black text-emerald-800 mt-1">{statusLabel[order.status] || order.status}</div>
                    </div>
                    <div>
                      <div className="text-gray-500">Total persistido</div>
                      <div className="font-black text-gray-900 mt-1">
                        {money(order.total, order.priceSnapshotRelation?.currencyCode || 'XOF')}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 lg:justify-end">
                      {order.status === 'PAID' && (
                        <button
                          onClick={() => void orderStatusAction(order.id, 'PREPARING')}
                          className="px-3 py-2 bg-blue-600 text-white rounded-lg font-bold"
                        >
                          Iniciar preparação
                        </button>
                      )}
                      {order.status === 'PREPARING' && (
                        <button
                          onClick={() => void orderStatusAction(order.id, 'READY_FOR_SHIPMENT')}
                          className="px-3 py-2 bg-emerald-600 text-white rounded-lg font-bold"
                        >
                          Pronto para expedição
                        </button>
                      )}
                      {order.status === 'PENDING_PAYMENT' && (
                        <span className="px-3 py-2 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg font-bold">
                          Aguardando pagamento
                        </span>
                      )}
                      {order.status === 'READY_FOR_SHIPMENT' && (
                        <span className="px-3 py-2 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg font-bold">
                          Aguardando logística
                        </span>
                      )}
                    </div>
                  </div>`;

replaceRequired('src/components/SellerHubView.tsx', oldRow, newRow);

replaceRequired(
  'src/components/SellerHubView.tsx',
  '              <p className="text-xs text-gray-500 mt-1">Dados de GET /orders/seller com filtro opcional da loja selecionada.</p>',
  '              <p className="text-xs text-gray-500 mt-1">Pedidos reais da loja. O Seller só avança PAID → PREPARING → READY_FOR_SHIPMENT; expedição/rastreamento pertencem à logística.</p>'
);

console.log('Sprint 8.4.2 aplicada. Execute checker, lint, builds e testes.');
