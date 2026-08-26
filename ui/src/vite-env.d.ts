/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_AI_SEARCH_ENABLED?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
