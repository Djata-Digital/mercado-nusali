import { apiClient, ApiResponse } from '../apiClient';

export interface BuyerOrderItem {
  id: string;
  productId: string;
  variantId: string;
  productTitleSnapshot: string;
  variantNameSnapshot: string;
  skuSnapshot: string;
  imageKeySnapshot?: string | null;
  quantity: number;
  unitPrice: string | number;
  subtotal: string | number;
  discountAmount: string | number;
  total: string | number;
}

export interface BuyerOrder {
  id: string;
  orderNumber: string;
  orderGroupId: string;
  userId: string;
  storeId: string;
  currencyId: string;
  subtotal: string | number;
  discountAmount: string | number;
  shippingAmount: string | number;
  estimatedTaxAmount: string | number;
  total: string | number;
  status: string;
  shippingServiceCode: string;
  shippingServiceName: string;
  estimatedDeliveryMinDays: number;
  estimatedDeliveryMaxDays: number;
  placedAt: string;
  createdAt: string;
  updatedAt: string;
  items: BuyerOrderItem[];
  store?: { id: string; name: string; slug?: string };
  currency?: { id: string; code: string; symbol?: string };
  addressSnapshotRelation?: {
    recipientName: string;
    phone: string;
    street: string;
    number: string;
    complement?: string | null;
    neighborhood?: string | null;
    city: string;
    region: string;
    postalCode?: string | null;
    countryId: string;
  } | null;
  priceSnapshotRelation?: {
    subtotal: string | number;
    discountAmount: string | number;
    shippingAmount: string | number;
    taxAmount: string | number;
    totalAmount: string | number;
  } | null;
  shippingRelation?: {
    serviceCode: string;
    serviceName: string;
    cost: string | number;
    estimatedMinDays: number;
    estimatedMaxDays: number;
    carrier?: { id: string; name: string } | null;
  } | null;
  timeline?: Array<{
    id: string;
    eventCode: string;
    title: string;
    description?: string | null;
    createdAt: string;
  }>;
  statusHistory?: Array<{
    id: string;
    previousStatus?: string | null;
    newStatus: string;
    reason?: string | null;
    createdAt: string;
  }>;
}

export interface BuyerTracking {
  id: string;
  shipmentId: string;
  trackingNumber: string;
  externalTrackingNumber?: string | null;
  currentStatus: string;
  estimatedDeliveryAt?: string | null;
  deliveredAt?: string | null;
  lastEventAt?: string | null;
  isInternational: boolean;
  carrier?: { id: string; name: string } | null;
  events?: Array<{
    id: string;
    eventCode: string;
    status: string;
    title: string;
    description?: string | null;
    city?: string | null;
    region?: string | null;
    eventAt: string;
  }>;
  checkpoints?: Array<{
    id: string;
    sequence: number;
    type: string;
    name: string;
    city?: string | null;
    region?: string | null;
    plannedAt?: string | null;
    arrivedAt?: string | null;
    departedAt?: string | null;
    status: string;
  }>;
}

export class OrdersApi {
  static listMine(): Promise<ApiResponse<BuyerOrder[]>> {
    return apiClient.get('/orders/my-orders');
  }

  static getById(id: string): Promise<ApiResponse<BuyerOrder>> {
    return apiClient.get(`/orders/${id}`);
  }

  static getTracking(orderId: string): Promise<ApiResponse<BuyerTracking>> {
    return apiClient.get(`/orders/${orderId}/tracking`);
  }
  static listSeller(storeId?: string): Promise<ApiResponse<BuyerOrder[]>> {
    return apiClient.get('/orders/seller', {
      params: storeId ? { storeId } : undefined,
    });
  }

  // ============================================================
  // ADMIN
  // ============================================================

  static listAdmin(params?: {
    page?: number;
    limit?: number;
    status?: string;
    search?: string;
    storeId?: string;
  }): Promise<ApiResponse<any>> {
    return apiClient.get('/orders/admin', {
      params,
    });
  }

  static getAdminById(
    id: string,
  ): Promise<ApiResponse<BuyerOrder>> {
    return apiClient.get(`/orders/${id}`);
  }

  static updateStatusAdmin(
    id: string,
    data: {
      status: string;
      reason?: string;
    },
  ): Promise<ApiResponse<any>> {
    return apiClient.patch(
      `/orders/${id}/status`,
      data,
    );
  }


}
