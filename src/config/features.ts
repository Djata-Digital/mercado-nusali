import { API_CONFIG } from './api';

function envFlag(
  name:
    | 'VITE_ENABLE_SELLER_PORTAL'
    | 'VITE_ENABLE_ADMIN_PORTAL'
    | 'VITE_ENABLE_EXPERIMENTAL_BUYER_FEATURES',
  developmentDefault: boolean,
): boolean {
  const raw = import.meta.env[name];

  if (raw === 'true') return true;
  if (raw === 'false') return false;

  // Em produção, funcionalidade não comprovadamente real fica fechada.
  return API_CONFIG.IS_PRODUCTION ? false : developmentDefault;
}

export const FRONTEND_FEATURES = {
  SELLER_PORTAL: envFlag(
    'VITE_ENABLE_SELLER_PORTAL',
    true,
  ),
  ADMIN_PORTAL: envFlag(
    'VITE_ENABLE_ADMIN_PORTAL',
    true,
  ),
  EXPERIMENTAL_BUYER_FEATURES: envFlag(
    'VITE_ENABLE_EXPERIMENTAL_BUYER_FEATURES',
    true,
  ),
} as const;
