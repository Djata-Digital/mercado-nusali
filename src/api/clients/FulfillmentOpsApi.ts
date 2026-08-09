import { apiClient, ApiResponse } from '../apiClient';

export class FulfillmentOpsApi {
  static listPaidOrders(): Promise<ApiResponse<any>> {
    return apiClient.get('/orders/admin', {
      params: { page: 1, limit: 100, status: 'PAID' },
    });
  }

  static generatePicking(orderId: string): Promise<ApiResponse<any>> {
    return apiClient.post(`/fulfillment/picking/order/${orderId}/generate`);
  }

  static listPicking(params?: any): Promise<ApiResponse<any>> {
    return apiClient.get('/fulfillment/picking', { params });
  }

  static getPicking(id: string): Promise<ApiResponse<any>> {
    return apiClient.get(`/fulfillment/picking/${id}`);
  }

  static startPicking(id: string): Promise<ApiResponse<any>> {
    return apiClient.post(`/fulfillment/picking/${id}/start`);
  }

  static completePicking(id: string, items: Array<{
    pickingItemId: string;
    pickedQuantity: number;
    locationCode?: string;
  }>): Promise<ApiResponse<any>> {
    return apiClient.post(`/fulfillment/picking/${id}/items`, { items });
  }

  static listPacking(params?: any): Promise<ApiResponse<any>> {
    return apiClient.get('/fulfillment/packing', { params });
  }

  static getPacking(id: string): Promise<ApiResponse<any>> {
    return apiClient.get(`/fulfillment/packing/${id}`);
  }

  static startPacking(pickingOrderId: string): Promise<ApiResponse<any>> {
    return apiClient.post('/fulfillment/packing/start', { pickingOrderId });
  }

  static completePacking(
    id: string,
    data: {
      materialId?: string;
      grossWeight: number;
      width: number;
      height: number;
      length: number;
      sealCode?: string;
      notes?: string;
    },
  ): Promise<ApiResponse<any>> {
    return apiClient.post(`/fulfillment/packing/${id}/complete`, data);
  }

  static generateLabel(id: string, carrierName: string): Promise<ApiResponse<any>> {
    return apiClient.post(`/fulfillment/packing/${id}/label`, { carrierName });
  }

  static listShipments(params?: any): Promise<ApiResponse<any>> {
    return apiClient.get('/fulfillment/shipping', { params });
  }

  static createShipment(packingOrderId: string): Promise<ApiResponse<any>> {
    return apiClient.post('/fulfillment/shipping', { packingOrderId });
  }

  static listManifests(params?: any): Promise<ApiResponse<any>> {
    return apiClient.get('/fulfillment/manifests', { params });
  }

  static createManifest(data: {
    warehouseId: string;
    shipmentIds: string[];
    carrierName: string;
    driverName?: string;
    driverDocument?: string;
    vehiclePlate?: string;
    notes?: string;
  }): Promise<ApiResponse<any>> {
    return apiClient.post('/fulfillment/manifests', data);
  }

  static closeManifest(id: string, notes?: string): Promise<ApiResponse<any>> {
    return apiClient.post(`/fulfillment/manifests/${id}/close`, notes ? { notes } : {});
  }

  static dispatchManifest(id: string): Promise<ApiResponse<any>> {
    return apiClient.post(`/fulfillment/manifests/${id}/dispatch`);
  }
}
