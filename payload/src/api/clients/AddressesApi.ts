import { apiClient, ApiResponse } from '../apiClient';

export interface RealCountry {
  id: string;
  code: string;
  name: string;
  flag?: string;
  phonePrefix: string;
  defaultCurrency?: { id: string; code: string; symbol?: string } | null;
}

export interface RealAddress {
  id: string;
  label?: string | null;
  recipientName: string;
  phone: string;
  phoneCode: string;
  countryId: string;
  country: RealCountry;
  region: string;
  city: string;
  district?: string | null;
  neighborhood?: string | null;
  street: string;
  number: string;
  complement?: string | null;
  postalCode?: string | null;
  reference?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  isDefault: boolean;
  isActive: boolean;
  type: 'RESIDENTIAL' | 'COMMERCIAL' | string;
}

export interface CreateRealAddressInput {
  label?: string;
  recipientName: string;
  phone: string;
  phoneCode: string;
  countryId: string;
  region: string;
  city: string;
  district?: string;
  neighborhood?: string;
  street: string;
  number: string;
  complement?: string;
  postalCode?: string;
  reference?: string;
  isDefault?: boolean;
  type?: 'RESIDENTIAL' | 'COMMERCIAL';
}

export class AddressesApi {
  static list(): Promise<ApiResponse<RealAddress[]>> {
    return apiClient.get('/addresses');
  }

  static get(id: string): Promise<ApiResponse<RealAddress>> {
    return apiClient.get(`/addresses/${id}`);
  }

  static create(data: CreateRealAddressInput): Promise<ApiResponse<RealAddress>> {
    return apiClient.post('/addresses', data);
  }

  static update(id: string, data: Partial<CreateRealAddressInput>): Promise<ApiResponse<RealAddress>> {
    return apiClient.patch(`/addresses/${id}`, data);
  }

  static setDefault(id: string): Promise<ApiResponse<RealAddress>> {
    return apiClient.patch(`/addresses/${id}/default`);
  }

  static delete(id: string): Promise<ApiResponse<never>> {
    return apiClient.delete(`/addresses/${id}`);
  }
}
