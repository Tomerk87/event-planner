import type { StoredDemo } from './state.ts'

/** Where a value is kept between page loads. */
export interface Persistence<Value> {
  /** The stored value as found, unvalidated; null when nothing is stored. */
  load(): unknown
  save(value: Value): void
  clear(): void
  /** Tells when another tab of the same browser changed the stored value. */
  onChange?(listener: () => void): void
}

export type DemoPersistence = Persistence<StoredDemo>

export const DEMO_STORAGE_KEY = 'event-planner.demo'
/**
 * Where the browser-local preview accounts were kept before the backend
 * existed. They are discarded (decision D85); the key is only removed.
 */
export const LEGACY_ACCOUNTS_STORAGE_KEY = 'event-planner.accounts'
export const SESSION_STORAGE_KEY = 'event-planner.session'
/** Display choices of this browser, such as visible table columns. */
export const PREFERENCES_STORAGE_KEY = 'event-planner.preferences'

/**
 * Stores a value in the visitor's own browser profile. This is the only
 * place application data touches browser storage. If storage is unavailable
 * or full the application keeps working for the current visit and the value
 * is simply not remembered.
 */
export function createBrowserPersistence<Value = StoredDemo>(
  storage: Storage,
  key: string = DEMO_STORAGE_KEY,
): Persistence<Value> {
  return {
    load() {
      try {
        const raw = storage.getItem(key)
        return raw === null ? null : (JSON.parse(raw) as unknown)
      } catch {
        return undefined
      }
    },
    save(value) {
      try {
        storage.setItem(key, JSON.stringify(value))
      } catch {
        return
      }
    },
    clear() {
      try {
        storage.removeItem(key)
      } catch {
        return
      }
    },
    onChange(listener) {
      window.addEventListener('storage', (event) => {
        if (event.storageArea === storage && event.key === key) {
          listener()
        }
      })
    },
  }
}

/**
 * Keeps a value in memory only; used in tests. With no argument nothing is
 * stored yet; any argument, including `undefined`, is the stored value.
 */
export function createMemoryPersistence<Value = StoredDemo>(
  ...initial: [stored?: unknown]
): Persistence<Value> {
  let stored: unknown = initial.length === 0 ? null : initial[0]
  return {
    load: () => stored,
    save: (value) => {
      stored = JSON.parse(JSON.stringify(value)) as unknown
    },
    clear: () => {
      stored = null
    },
  }
}
