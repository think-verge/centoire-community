/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_AI_SEARCH_ENABLED?: string;
  /** Public URL of the Jobs mini app (https://jobs.centoire.com). Unset => Jobs stays "coming soon". */
  readonly VITE_JOBS_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
