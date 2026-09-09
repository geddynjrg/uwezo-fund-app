/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_OTP_API_BASE?: string;
  readonly VITE_SHOW_LOANS_STAGING?: string;
  readonly VITE_LOANS_STAGING_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
