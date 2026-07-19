/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Comma-separated list of allowed parent portal origins for
   * postMessage validation (e.g. "https://ledger.falcon.example,http://localhost:3000").
   */
  readonly VITE_PARENT_ORIGINS?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
