import type { PreferencesService } from './contracts/index.ts'
import type { Persistence } from './mock/persistence.ts'

/** Display choices as stored in the browser. */
export interface StoredPreferences {
  guestColumns?: string[]
  sidebarCollapsed?: boolean
}

function readPreferences(stored: unknown): StoredPreferences {
  if (typeof stored !== 'object' || stored === null) {
    return {}
  }
  const { guestColumns, sidebarCollapsed } = stored as {
    guestColumns?: unknown
    sidebarCollapsed?: unknown
  }
  const preferences: StoredPreferences = {}
  if (
    Array.isArray(guestColumns) &&
    guestColumns.every((column) => typeof column === 'string')
  ) {
    preferences.guestColumns = guestColumns
  }
  if (typeof sidebarCollapsed === 'boolean') {
    preferences.sidebarCollapsed = sidebarCollapsed
  }
  return preferences
}

/**
 * Display choices are this browser's own in the demo and in the real
 * application alike (decision D86), so they are read and saved at once,
 * with nothing sent anywhere.
 */
export function createPreferencesService(
  persistence: Persistence<StoredPreferences>,
): PreferencesService {
  const update = (change: StoredPreferences) =>
    persistence.save({ ...readPreferences(persistence.load()), ...change })
  return {
    getGuestColumns: async () =>
      readPreferences(persistence.load()).guestColumns ?? null,
    setGuestColumns: async (columns) => update({ guestColumns: [...columns] }),
    getSidebarCollapsed: async () =>
      readPreferences(persistence.load()).sidebarCollapsed ?? false,
    setSidebarCollapsed: async (collapsed) =>
      update({ sidebarCollapsed: collapsed }),
  }
}
