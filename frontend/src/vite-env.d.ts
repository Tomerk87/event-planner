interface ImportMetaEnv {
  readonly VITE_DEMO_ENABLED?: string
  readonly VITE_ACCOUNTS_ENABLED?: string
  readonly VITE_GOOGLE_MAPS_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
