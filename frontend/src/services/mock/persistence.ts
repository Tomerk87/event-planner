import type { StoredDemo } from './state.ts'

/** Where the demo keeps its data between page loads. */
export interface DemoPersistence {
  /** The stored value as found, unvalidated; null when nothing is stored. */
  load(): unknown
  save(value: StoredDemo): void
  clear(): void
}

export const DEMO_STORAGE_KEY = 'event-planner.demo'

/**
 * Stores the demo in the visitor's own browser profile. This is the only
 * place demo data touches browser storage. If storage is unavailable or full
 * the demo keeps working for the current visit and is simply not remembered.
 */
export function createBrowserPersistence(storage: Storage): DemoPersistence {
  return {
    load() {
      try {
        const raw = storage.getItem(DEMO_STORAGE_KEY)
        return raw === null ? null : (JSON.parse(raw) as unknown)
      } catch {
        return undefined
      }
    },
    save(value) {
      try {
        storage.setItem(DEMO_STORAGE_KEY, JSON.stringify(value))
      } catch {
        return
      }
    },
    clear() {
      try {
        storage.removeItem(DEMO_STORAGE_KEY)
      } catch {
        return
      }
    },
  }
}

/**
 * Keeps the demo in memory only; used in tests. With no argument nothing is
 * stored yet; any argument, including `undefined`, is the stored value.
 */
export function createMemoryPersistence(
  ...initial: [stored?: unknown]
): DemoPersistence {
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
