import { Injectable, NotImplementedException } from '@nestjs/common';
import {
  ICarrierProvider,
  ShipmentRequest,
  ShipmentResponse,
  PickupScheduleRequest,
  PickupScheduleResponse,
  TrackingDetailsResponse,
} from './carrier-provider.interface';

abstract class BaseExternalUnconfiguredProvider implements ICarrierProvider {
  abstract readonly carrierCode: string;
  abstract readonly carrierName: string;

  private throwUnconfigured(): never {
    throw new NotImplementedException(
      `A integração real com a transportadora ${this.carrierName} (${this.carrierCode}) ainda não está configurada nesta Sprint. Utilize as transportadoras simuladas Nusali Express ou Parceiro Local.`,
    );
  }

  async createShipment(request: ShipmentRequest): Promise<ShipmentResponse> {
    this.throwUnconfigured();
  }

  async cancelShipment(trackingNumber: string, reason?: string): Promise<boolean> {
    this.throwUnconfigured();
  }

  async schedulePickup(request: PickupScheduleRequest): Promise<PickupScheduleResponse> {
    this.throwUnconfigured();
  }

  async getTracking(trackingNumber: string): Promise<TrackingDetailsResponse> {
    this.throwUnconfigured();
  }

  async generateLabel(trackingNumber: string): Promise<{ labelUrl: string; format: string }> {
    this.throwUnconfigured();
  }

  validateWebhook(headers: Record<string, any>, payload: any, secret: string): boolean {
    return false;
  }

  async processWebhook(payload: any): Promise<Array<{ trackingNumber: string; status: string; eventAt: Date; eventCode: string; title: string; description?: string }>> {
    this.throwUnconfigured();
  }

  async requestReturn(trackingNumber: string, reason: string): Promise<{ returnTrackingNumber: string }> {
    this.throwUnconfigured();
  }

  async getQuote(originZip: string, destZip: string, weightKg: number): Promise<{ serviceCode: string; name: string; price: number; estimatedDays: number }> {
    this.throwUnconfigured();
  }
}

@Injectable()
export class DhlCarrierProvider extends BaseExternalUnconfiguredProvider {
  readonly carrierCode = 'DHL_EXPRESS';
  readonly carrierName = 'DHL Express';
}

@Injectable()
export class UpsCarrierProvider extends BaseExternalUnconfiguredProvider {
  readonly carrierCode = 'UPS_GLOBAL';
  readonly carrierName = 'UPS Global Logistics';
}

@Injectable()
export class FedexCarrierProvider extends BaseExternalUnconfiguredProvider {
  readonly carrierCode = 'FEDEX_EXPRESS';
  readonly carrierName = 'FedEx Express';
}

@Injectable()
export class PostalCarrierProvider extends BaseExternalUnconfiguredProvider {
  readonly carrierCode = 'POSTAL_SERVICE';
  readonly carrierName = 'Serviço Postal Nacional';
}
