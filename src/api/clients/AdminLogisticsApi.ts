import { apiClient, ApiResponse } from '../apiClient';

export interface AdminShipment {
  id: string;
  shipmentCode: string;
  orderId: string;
  warehouseId: string;
  packingOrderId: string;
  status: string;
  manifestId?: string | null;
  dispatchedAt?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  order?: { id: string; orderNumber: string } | null;
  packingOrder?: {
    id: string;
    packingNumber: string;
    grossWeight?: string | number | null;
  } | null;
  manifest?: {
    id: string;
    manifestNumber: string;
    status: string;
  } | null;
  packages?: Array<{
    id: string;
    trackingCode: string;
    weight: string | number;
  }>;
}

export interface AdminTracking {
  id: string;
  shipmentId: string;
  carrierId: string;
  trackingNumber: string;
  externalTrackingNumber?: string | null;
  currentStatus: string;
  estimatedDeliveryAt?: string | null;
  deliveredAt?: string | null;
  lastEventAt?: string | null;
  isInternational: boolean;
  createdAt: string;
  updatedAt: string;
  carrier?: { id: string; name: string } | null;
  shipment?: {
    id: string;
    shipmentCode: string;
    order?: { id: string; orderNumber: string } | null;
  } | null;
  events?: Array<{
    id: string;
    eventCode: string;
    status: string;
    title: string;
    description?: string | null;
    eventAt?: string | null;
    receivedAt?: string | null;
  }>;
}

export class AdminLogisticsApi {
  static listShipments(params?: {
    page?: number;
    limit?: number;
    warehouseId?: string;
    status?: string;
  }): Promise<ApiResponse<any>> {
    return apiClient.get('/fulfillment/shipping', { params });
  }

  static getShipment(id: string): Promise<ApiResponse<AdminShipment>> {
    return apiClient.get(`/fulfillment/shipping/${id}`);
  }

  static listTrackings(params?: {
    status?: string;
    carrierId?: string;
  }): Promise<ApiResponse<AdminTracking[]>> {
    return apiClient.get('/admin/tracking', { params });
  }

  static getTracking(id: string): Promise<ApiResponse<AdminTracking>> {
    return apiClient.get(`/admin/tracking/${id}`);
  }
}
