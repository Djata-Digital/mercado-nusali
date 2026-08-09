import { ApiResponse } from '../api/apiClient';
import { AdminApi } from '../api/clients/AdminApi';
import { API_CONFIG } from '../config/api';
import { mockAdminUsersList } from '../data/mockAdminUsers';
import { mockAdminSellersList } from '../data/mockAdminSellers';
import { mockAdminKycList } from '../data/mockAdminKyc';
import { mockAdminEscrowList } from '../data/mockAdminEscrow';
import { mockAdminDisputesList } from '../data/mockAdminDisputes';
import { mockAdminLogisticsList } from '../data/mockAdminLogistics';
import { mockWarehousesList } from '../data/mockAdminWarehouses';
import { mockRiskAlertsList } from '../data/mockAdminRisk';
import { mockSupportTicketsList } from '../data/mockAdminSupport';
import { mockAuditLogsList } from '../data/mockAdminAudit';

export const AdminService = {
  async getUsers(): Promise<ApiResponse<any[]>> {
    if (API_CONFIG.USE_FAKE_API) {
      return { success: true, data: mockAdminUsersList };
    }
    return AdminApi.pagination();
  },

  async getSellers(): Promise<ApiResponse<any[]>> {
    if (API_CONFIG.USE_FAKE_API) {
      return { success: true, data: mockAdminSellersList };
    }
    return AdminApi.list();
  },

  async getKycList(): Promise<ApiResponse<any[]>> {
    if (API_CONFIG.USE_FAKE_API) {
      return { success: true, data: mockAdminKycList };
    }
    return AdminApi.filters();
  },

  async getEscrowList(): Promise<ApiResponse<any[]>> {
    if (API_CONFIG.USE_FAKE_API) {
      return { success: true, data: mockAdminEscrowList };
    }
    return AdminApi.search('escrow');
  },

  async getDisputesList(): Promise<ApiResponse<any[]>> {
    if (API_CONFIG.USE_FAKE_API) {
      return { success: true, data: mockAdminDisputesList };
    }
    return AdminApi.search('disputes');
  },

  async getLogisticsList(): Promise<ApiResponse<any[]>> {
    if (API_CONFIG.USE_FAKE_API) {
      return { success: true, data: mockAdminLogisticsList };
    }
    return AdminApi.search('logistics');
  },

  async getWarehousesList(): Promise<ApiResponse<any[]>> {
    if (API_CONFIG.USE_FAKE_API) {
      return { success: true, data: mockWarehousesList };
    }
    return AdminApi.search('warehouses');
  },

  async getRiskAlerts(): Promise<ApiResponse<any[]>> {
    if (API_CONFIG.USE_FAKE_API) {
      return { success: true, data: mockRiskAlertsList };
    }
    return AdminApi.search('risk');
  },

  async getSupportTickets(): Promise<ApiResponse<any[]>> {
    if (API_CONFIG.USE_FAKE_API) {
      return { success: true, data: mockSupportTicketsList };
    }
    return AdminApi.search('support');
  },

  async getAuditLogs(): Promise<ApiResponse<any[]>> {
    if (API_CONFIG.USE_FAKE_API) {
      return { success: true, data: mockAuditLogsList };
    }
    return AdminApi.search('audit');
  }
};

