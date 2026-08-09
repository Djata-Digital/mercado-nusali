import { apiClient, ApiResponse } from '../apiClient';

export interface MergeCartPayload {
  items: Array<{ variantId: string; quantity: number }>;
}

export class CartApi {
  static async get(): Promise<ApiResponse<any>> {
    return apiClient.get('/cart');
  }

  static async addItem(variantId: string, quantity: number): Promise<ApiResponse<any>> {
    return apiClient.post('/cart/items', { variantId, quantity });
  }

  static async updateItem(itemId: string, quantity: number): Promise<ApiResponse<any>> {
    return apiClient.patch(`/cart/items/${itemId}`, { quantity });
  }

  static async removeItem(itemId: string): Promise<ApiResponse<any>> {
    return apiClient.delete(`/cart/items/${itemId}`);
  }

  static async clear(): Promise<ApiResponse<any>> {
    return apiClient.delete('/cart');
  }

  static async merge(payload: MergeCartPayload): Promise<ApiResponse<any>> {
    return apiClient.post('/cart/merge', payload);
  }

  static async applyCoupon(code: string): Promise<ApiResponse<any>> {
    return apiClient.post('/cart/coupon', { code });
  }

  static async removeCoupon(): Promise<ApiResponse<any>> {
    return apiClient.delete('/cart/coupon');
  }
}
