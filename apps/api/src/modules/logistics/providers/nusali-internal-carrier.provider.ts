import { Injectable } from '@nestjs/common';
import {
  ICarrierProvider,
  ShipmentRequest,
  ShipmentResponse,
  PickupScheduleRequest,
  PickupScheduleResponse,
  TrackingDetailsResponse,
} from './carrier-provider.interface';
import * as crypto from 'crypto';

@Injectable()
export class NusaliInternalCarrierProvider implements ICarrierProvider {
  readonly carrierCode = 'NUSALI_EXPRESS';

  async createShipment(request: ShipmentRequest): Promise<ShipmentResponse> {
    const randomCode = crypto.randomBytes(4).toString('hex').toUpperCase();
    const trackingNumber = `NUS-${Date.now()}-${randomCode}`;

    return {
      trackingNumber,
      externalTrackingNumber: `EXT-${trackingNumber}`,
      carrierCode: this.carrierCode,
      labelUrl: `https://storage.nusali.local/labels/${trackingNumber}.pdf`,
      estimatedDeliveryAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      metadataJson: { simulated: true, provider: 'NusaliInternalCarrierProvider' },
    };
  }

  async cancelShipment(trackingNumber: string, reason?: string): Promise<boolean> {
    return true;
  }

  async schedulePickup(request: PickupScheduleRequest): Promise<PickupScheduleResponse> {
    return {
      pickupRequestId: crypto.randomUUID(),
      pickupCode: `PKP-${crypto.randomInt(100000, 999999)}`,
      scheduledDate: request.scheduledDate,
      status: 'SCHEDULED',
    };
  }

  async getTracking(trackingNumber: string): Promise<TrackingDetailsResponse> {
    return {
      trackingNumber,
      status: 'IN_TRANSIT',
      currentLocation: 'Hub Central Nusali',
      estimatedDeliveryAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      events: [
        {
          eventCode: 'LABEL_CREATED',
          status: 'LABEL_CREATED',
          title: 'Etiqueta Criada',
          description: 'Etiqueta de envio gerada no sistema interno',
          eventAt: new Date(Date.now() - 3600000),
        },
        {
          eventCode: 'IN_TRANSIT',
          status: 'IN_TRANSIT',
          title: 'Em Trânsito',
          description: 'Pacote em trânsito entre centros de distribuição',
          eventAt: new Date(),
        },
      ],
    };
  }

  async generateLabel(trackingNumber: string): Promise<{ labelUrl: string; format: string }> {
    return {
      labelUrl: `https://storage.nusali.local/labels/${trackingNumber}.pdf`,
      format: 'PDF',
    };
  }

  validateWebhook(headers: Record<string, any>, payload: any, secret: string): boolean {
    const signature = headers['x-nusali-signature'];
    if (!signature || !secret) return false;
    const computed = crypto.createHmac('sha256', secret).update(JSON.stringify(payload)).digest('hex');
    const sigBuf = Buffer.from(signature);
    const compBuf = Buffer.from(computed);
    if (sigBuf.length !== compBuf.length) return false;
    return crypto.timingSafeEqual(sigBuf, compBuf);
  }

  async processWebhook(payload: any): Promise<Array<{ trackingNumber: string; status: string; eventAt: Date; eventCode: string; title: string; description?: string }>> {
    return [
      {
        trackingNumber: payload.trackingNumber || 'NUS-SIMULATED',
        status: payload.status || 'IN_TRANSIT',
        eventCode: payload.eventCode || 'IN_TRANSIT',
        title: payload.title || 'Atualização simulada de transporte',
        description: payload.description || 'Evento processado via webhook interno',
        eventAt: payload.eventAt ? new Date(payload.eventAt) : new Date(),
      },
    ];
  }

  async requestReturn(trackingNumber: string, reason: string): Promise<{ returnTrackingNumber: string }> {
    return {
      returnTrackingNumber: `RET-${trackingNumber}`,
    };
  }

  async getQuote(originZip: string, destZip: string, weightKg: number): Promise<{ serviceCode: string; name: string; price: number; estimatedDays: number }> {
    return {
      serviceCode: 'NUSALI_EXPRESS',
      name: 'Nusali Express Delivery',
      price: Math.max(10, weightKg * 5),
      estimatedDays: 2,
    };
  }
}
