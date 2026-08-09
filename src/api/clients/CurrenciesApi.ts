import { apiClient, ApiResponse } from '../apiClient';

export class CurrenciesApi {
  static list(): Promise<ApiResponse<any[]>> {
    return apiClient.get('/currencies');
  }
}
