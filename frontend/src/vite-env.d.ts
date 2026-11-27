interface ImportMetaEnv {
  readonly VITE_DEMO_ENABLED?: string
  readonly VITE_ACCOUNTS_ENABLED?: string
  readonly VITE_VENUES_ENABLED?: string
  readonly VITE_GOOGLE_MAPS_KEY?: string
  /** The demo's limits, VITE_TABLE_MAX_SEATS_DEMO and others (D110). */
  readonly [name: `VITE_${string}_DEMO`]: string | undefined
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

/** This build's version (D107), from VERSION, such as "1.4". */
declare const __APP_VERSION__: string
/** The commit this build is from; null when it could not be told. */
declare const __APP_COMMIT__: string | null
