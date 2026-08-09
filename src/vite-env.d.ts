/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_UPLOAD_URL?: string;
  readonly VITE_WEBSOCKET_URL?: string;
  readonly VITE_API_TIMEOUT_MS?: string;
  readonly VITE_USE_FAKE_API?: 'true' | 'false';
  readonly VITE_ENABLE_SELLER_PORTAL?: 'true' | 'false';
  readonly VITE_ENABLE_ADMIN_PORTAL?: 'true' | 'false';
  readonly VITE_ENABLE_EXPERIMENTAL_BUYER_FEATURES?: 'true' | 'false';
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
