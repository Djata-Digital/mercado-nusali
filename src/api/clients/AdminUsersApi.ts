import {
  apiClient,
  ApiResponse,
} from '../apiClient';

export interface AdminUserReal {
  id: string;
  firstName: string;
  lastName: string;
  name: string;
  email: string;
  phone: string;
  phoneCode: string;
  status: string;
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
  role: string;
  roles: string[];
  permissions: string[];
  createdAt: string;
  updatedAt?: string;

  country?: {
    code: string;
    name: string;
  };
}

export interface AdminRoleReal {
  id: string;
  name: string;
  description?: string | null;

  _count?: {
    users?: number;
  };

  permissions?: Array<{
    permission: {
      id: string;
      slug: string;
      name: string;
      description?: string | null;
    };
  }>;
}

export interface AdminPermissionReal {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
}

export class AdminUsersApi {
  static listUsers(params?: {
    page?: number;
    limit?: number;
    search?: string;
    role?: string;
    status?: string;
    countryCode?: string;
  }): Promise<ApiResponse<any>> {
    return apiClient.get(
      '/users',
      {
        params,
      },
    );
  }

  static getUser(
    id: string,
  ): Promise<
    ApiResponse<AdminUserReal>
  > {
    return apiClient.get(
      `/users/${id}`,
    );
  }

  static createUser(data: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    phoneCode: string;
    countryCode: string;
    roles: string[];
  }): Promise<
    ApiResponse<AdminUserReal>
  > {
    return apiClient.post(
      '/users',
      data,
    );
  }

  static updateStatus(
    id: string,
    data: {
      status:
        | 'active'
        | 'blocked'
        | 'suspended'
        | 'inactive';
      reason?: string;
    },
  ): Promise<
    ApiResponse<AdminUserReal>
  > {
    return apiClient.patch(
      `/users/${id}/status`,
      data,
    );
  }

  static updateRoles(
    id: string,
    roles: string[],
  ): Promise<
    ApiResponse<AdminUserReal>
  > {
    return apiClient.patch(
      `/users/${id}/roles`,
      {
        roles,
      },
    );
  }

  static sendPasswordReset(
    id: string,
  ): Promise<
    ApiResponse<{
      message: string;
    }>
  > {
    return apiClient.post(
      `/users/${id}/password-reset`,
      {},
    );
  }

  static listRoles(): Promise<
    ApiResponse<AdminRoleReal[]>
  > {
    return apiClient.get(
      '/roles',
    );
  }

  static createRole(data: {
    name: string;
    description?: string;
    permissions: string[];
  }): Promise<
    ApiResponse<AdminRoleReal>
  > {
    return apiClient.post(
      '/roles',
      data,
    );
  }

  static updateRole(
    id: string,
    data: {
      name?: string;
      description?: string;
      permissions?: string[];
    },
  ): Promise<
    ApiResponse<AdminRoleReal>
  > {
    return apiClient.patch(
      `/roles/${id}`,
      data,
    );
  }

  static deleteRole(
    id: string,
  ): Promise<
    ApiResponse<any>
  > {
    return apiClient.delete(
      `/roles/${id}`,
    );
  }

  static listPermissions(): Promise<
    ApiResponse<
      AdminPermissionReal[]
    >
  > {
    return apiClient.get(
      '/permissions',
    );
  }
}