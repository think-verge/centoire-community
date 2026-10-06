/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Origin of the main Centoire app (login, signup, profile). */
  readonly VITE_CORE_URL?: string;
  /** Prefix for API calls; empty in production (same-origin via nginx). */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
