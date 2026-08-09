export interface ApiResponse<T = any> {
  success: true;
  data: T;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
    fieldErrors?: Record<string, string[]> | null;
    requestId: string;
  };
}

export type UserRoleType =
  | 'BUYER'
  | 'SELLER'
  | 'ADMIN'
  | 'GLOBAL_ADMIN'
  | 'COUNTRY_REPRESENTATIVE'
  | 'REGIONAL_SUPERVISOR'
  | 'SUPPORT'
  | 'FINANCE'
  | 'LOGISTICS'
  | 'KYC_ANALYST'
  | 'RISK_ANALYST';

export interface UserDto {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  phoneCode: string;
  status: 'active' | 'suspended' | 'blocked';
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
  sellerOnboardingStatus?: string | null;
  country?: {
    code: string;
    name: string;
  };
  preferredCurrency?: {
    code: string;
    symbol: string;
  };
  preferredLanguage?: {
    code: string;
    name: string;
  };
  roles: string[];
  permissions: string[];
  createdAt: string;
}

export interface AuthLoginResponseData {
  token: string;
  refreshToken: string;
  user: UserDto;
}

export interface AuthSessionDto {
  id: string;
  deviceId?: string;
  ipAddress?: string;
  userAgent?: string;
  location?: string;
  lastActiveAt: string;
  isCurrent: boolean;
}
