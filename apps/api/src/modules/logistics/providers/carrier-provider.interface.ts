export interface ShipmentRequest {
  shipmentId: string;
  shipmentCode: string;
  orderId: string;
  warehouseId: string;
  originAddress: Record<string, any>;
  destinationAddress: Record<string, any>;
  packages: Array<{
    packageCode: string;
    weight: number;
    length?: number;
    width?: number;
    height?: number;
  }>;
  serviceCode?: string;
  isInternational?: boolean;
}

export interface ShipmentResponse {
  trackingNumber: string;
  externalTrackingNumber?: string;
  carrierCode: string;
  labelUrl?: string;
  estimatedDeliveryAt?: Date;
  metadataJson?: Record<string, any>;
}

export interface PickupScheduleRequest {
  shipmentId: string;
  warehouseId: string;
  scheduledDate: Date;
  timeWindowStart?: string;
  timeWindowEnd?: string;
  notes?: string;
}

export interface PickupScheduleResponse {
  pickupRequestId: string;
  pickupCode: string;
  scheduledDate: Date;
  status: string;
}

export interface TrackingDetailsResponse {
  trackingNumber: string;
  status: string;
  currentLocation?: string;
  estimatedDeliveryAt?: Date;
  deliveredAt?: Date;
  events: Array<{
    eventCode: string;
    status: string;
    title: string;
    description?: string;
    countryCode?: string;
    city?: string;
    eventAt: Date;
    carrierEventId?: string;
  }>;
}

export interface ICarrierProvider {
  readonly carrierCode: string;

  createShipment(request: ShipmentRequest): Promise<ShipmentResponse>;
  cancelShipment(trackingNumber: string, reason?: string): Promise<boolean>;
  schedulePickup(request: PickupScheduleRequest): Promise<PickupScheduleResponse>;
  getTracking(trackingNumber: string): Promise<TrackingDetailsResponse>;
  generateLabel(trackingNumber: string): Promise<{ labelUrl: string; format: string }>;
  validateWebhook(headers: Record<string, any>, payload: any, secret: string): boolean;
  processWebhook(payload: any): Promise<Array<{ trackingNumber: string; status: string; eventAt: Date; eventCode: string; title: string; description?: string }>>;
  requestReturn(trackingNumber: string, reason: string): Promise<{ returnTrackingNumber: string }>;
  getQuote(originZip: string, destZip: string, weightKg: number): Promise<{ serviceCode: string; name: string; price: number; estimatedDays: number }>;
}
