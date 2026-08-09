const env = import.meta.env;

const isProduction = env.PROD;
const fakeRequested = env.VITE_USE_FAKE_API === 'true';

if (isProduction && fakeRequested) {
  throw new Error(
    'VITE_USE_FAKE_API=true é proibido em produção. O Mercado Nusali não pode iniciar com dados simulados.',
  );
}

const apiUrl =
  env.VITE_API_URL?.trim() ||
  (isProduction ? '/api/v1' : 'http://localhost:3000/api/v1');

const websocketUrl =
  env.VITE_WEBSOCKET_URL?.trim() ||
  (isProduction
    ? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`
    : 'ws://localhost:3000');

export const API_CONFIG = {
  API_URL: apiUrl.replace(/\/+$/, ''),
  UPLOAD_URL:
    env.VITE_UPLOAD_URL?.trim() ||
    `${apiUrl.replace(/\/+$/, '')}/upload`,
  WS_URL: websocketUrl.replace(/\/+$/, ''),
  // Fake API é somente uma ferramenta de desenvolvimento e exige opt-in explícito.
  USE_FAKE_API: !isProduction && fakeRequested,
  TIMEOUT: Number(env.VITE_API_TIMEOUT_MS || 15000),
  IS_PRODUCTION: isProduction,
  MODE: env.MODE,
} as const;
