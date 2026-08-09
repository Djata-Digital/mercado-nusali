import React, { useState } from 'react';
import {
  Truck,
  Warehouse,
  Boxes,
  Zap,
  Printer,
  PlusCircle,
  CheckCircle2,
  MapPin,
  Clock,
  Globe,
  ArrowRight,
} from 'lucide-react';
import { CountryCode } from '../../types';
import { countriesConfig } from '../../utils/currencyUtils';

interface SellerLogisticsFulfillmentProps {
  showToast: (msg: string) => void;
}

export const SellerLogisticsFulfillment: React.FC<SellerLogisticsFulfillmentProps> = ({ showToast }) => {
  const hubs = [
    { name: 'HUB Central Bissau', code: 'HUB-GW-01', country: 'GW', units: 380, cap: '68%', speed: 'Entrega Hoje / 24h' },
    { name: 'HUB Lisboa Transit', code: 'HUB-PT-02', country: 'PT', units: 190, cap: '42%', speed: 'Entrega 48h Europa' },
    { name: 'HUB São Paulo Guarulhos', code: 'HUB-BR-03', country: 'BR', units: 160, cap: '35%', speed: 'Entrega 3-5 dias Brasil' },
  ];

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Top Banner Header */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-black text-gray-900">Nusali Fulfillment & Logística</h1>
            <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-black px-2.5 py-0.5 rounded-full flex items-center gap-1">
              <Zap className="w-3.5 h-3.5 text-yellow-600 fill-yellow-500" /> ENTREGAS RÁPIDAS
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Armazene seus produtos nos nossos HUBs logísticos para garantir frete grátis e entrega no mesmo dia.
          </p>
        </div>

        <button
          onClick={() => showToast('Iniciando plano de envio de estoque para o HUB Nusali...')}
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2.5 rounded-xl text-xs transition flex items-center gap-2 shadow-xs shrink-0"
        >
          <PlusCircle className="w-4 h-4" /> Criar Plano de Envio de Estoque
        </button>
      </div>

      {/* HUBs Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {hubs.map((h) => {
          const countryConf = countriesConfig[h.country as CountryCode] || countriesConfig.GW;

          return (
            <div key={h.code} className="bg-white rounded-2xl border border-gray-200 p-6 shadow-2xs space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] font-mono text-gray-400 block">{h.code}</span>
                  <h3 className="font-bold text-sm text-gray-900">{h.name}</h3>
                </div>
                <span className="text-xl">{countryConf.flag}</span>
              </div>

              <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 text-xs font-medium space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-500">Produtos Estocados:</span>
                  <strong className="text-gray-900">{h.units} unidades</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Prazo de Envio:</span>
                  <strong className="text-emerald-700">{h.speed}</strong>
                </div>
              </div>

              <button
                onClick={() => showToast(`Gerando etiquetas de transferência para ${h.name}...`)}
                className="w-full p-2 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold rounded-xl text-xs transition flex items-center justify-center gap-1"
              >
                <Printer className="w-3.5 h-3.5" /> Gerar Etiquetas de Lote
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
