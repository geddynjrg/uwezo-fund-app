/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_OTP_API_BASE?: string;
  readonly VITE_SHOW_LOANS_STAGING?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
