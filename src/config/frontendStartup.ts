import { API_CONFIG } from './api';
import { FRONTEND_FEATURES } from './features';

export function assertFrontendRuntime(): void {
  if (API_CONFIG.IS_PRODUCTION && API_CONFIG.USE_FAKE_API) {
    throw new Error(
      'Configuração insegura: fake API ativa em produção.',
    );
  }

  if (!API_CONFIG.API_URL) {
    throw new Error('VITE_API_URL/API_URL não configurada.');
  }

  if (!Number.isFinite(API_CONFIG.TIMEOUT) || API_CONFIG.TIMEOUT <= 0) {
    throw new Error(
      'VITE_API_TIMEOUT_MS deve ser um número positivo.',
    );
  }

  if (!API_CONFIG.IS_PRODUCTION && API_CONFIG.USE_FAKE_API) {
    console.warn(
      '[Mercado Nusali] Fake API explicitamente habilitada para desenvolvimento.',
    );
  }

  if (API_CONFIG.IS_PRODUCTION) {
    console.info('[Mercado Nusali] Frontend iniciado em modo comercial.', {
      apiUrl: API_CONFIG.API_URL,
      sellerPortal: FRONTEND_FEATURES.SELLER_PORTAL,
      adminPortal: FRONTEND_FEATURES.ADMIN_PORTAL,
      experimentalBuyerFeatures:
        FRONTEND_FEATURES.EXPERIMENTAL_BUYER_FEATURES,
    });
  }
}
