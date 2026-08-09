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
export class GenericLocalCarrierProvider implements ICarrierProvider {
  readonly carrierCode = 'LOCAL_PARCEL';

  async createShipment(request: ShipmentRequest): Promise<ShipmentResponse> {
    const randomCode = crypto.randomBytes(4).toString('hex').toUpperCase();
    const trackingNumber = `LOC-${Date.now()}-${randomCode}`;

    return {
      trackingNumber,
      externalTrackingNumber: `EXT-LOC-${trackingNumber}`,
      carrierCode: this.carrierCode,
      labelUrl: `https://storage.nusali.local/labels/${trackingNumber}.pdf`,
      estimatedDeliveryAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      metadataJson: { simulated: true, provider: 'GenericLocalCarrierProvider' },
    };
  }

  async cancelShipment(trackingNumber: string, reason?: string): Promise<boolean> {
    return true;
  }

  async schedulePickup(request: PickupScheduleRequest): Promise<PickupScheduleResponse> {
    return {
      pickupRequestId: crypto.randomUUID(),
      pickupCode: `PKP-LOC-${crypto.randomInt(100000, 999999)}`,
      scheduledDate: request.scheduledDate,
      status: 'SCHEDULED',
    };
  }

  async getTracking(trackingNumber: string): Promise<TrackingDetailsResponse> {
    return {
      trackingNumber,
      status: 'LABEL_CREATED',
      estimatedDeliveryAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      events: [
        {
          eventCode: 'LABEL_CREATED',
          status: 'LABEL_CREATED',
          title: 'Etiqueta Registrada',
          description: 'Aguardando despacho pelo parceiro local',
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
    const signature = headers['x-local-carrier-signature'];
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
        trackingNumber: payload.trackingNumber || 'LOC-SIMULATED',
        status: payload.status || 'IN_TRANSIT',
        eventCode: payload.eventCode || 'IN_TRANSIT',
        title: payload.title || 'Transporte Local em andamento',
        description: payload.description || 'Notificação recebida do parceiro local',
        eventAt: payload.eventAt ? new Date(payload.eventAt) : new Date(),
      },
    ];
  }

  async requestReturn(trackingNumber: string, reason: string): Promise<{ returnTrackingNumber: string }> {
    return {
      returnTrackingNumber: `RET-LOC-${trackingNumber}`,
    };
  }

  async getQuote(originZip: string, destZip: string, weightKg: number): Promise<{ serviceCode: string; name: string; price: number; estimatedDays: number }> {
    return {
      serviceCode: 'LOCAL_STANDARD',
      name: 'Local Partner Standard',
      price: Math.max(8, weightKg * 4),
      estimatedDays: 3,
    };
  }
}
