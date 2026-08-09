import { ApiResponse } from '../api/apiClient';
import { BuyerOrder, BuyerTracking, OrdersApi } from '../api/clients/OrdersApi';

export const OrderService = {
  getOrders(): Promise<ApiResponse<BuyerOrder[]>> {
    return OrdersApi.listMine();
  },

  getOrderById(id: string): Promise<ApiResponse<BuyerOrder>> {
    return OrdersApi.getById(id);
  },

  getOrderTracking(orderId: string): Promise<ApiResponse<BuyerTracking>> {
    return OrdersApi.getTracking(orderId);
  },
};
