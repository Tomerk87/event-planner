interface ImportMetaEnv {
  readonly VITE_DEMO_ENABLED?: string
  readonly VITE_ACCOUNTS_ENABLED?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
