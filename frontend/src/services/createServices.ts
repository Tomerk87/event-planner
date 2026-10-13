import { DomainError } from '../domain/errors.ts'
import type { Backend } from './contracts/index.ts'
import { createMockBackend } from './mock/mockBackend.ts'
import {
  ACCOUNTS_STORAGE_KEY,
  createBrowserPersistence,
  DEMO_STORAGE_KEY,
  PREFERENCES_STORAGE_KEY,
  SESSION_STORAGE_KEY,
} from './mock/persistence.ts'
import type { DataProvider } from './providerConfig.ts'

const DEFAULT_DELAY_MS = 150
const MAX_DELAY_MS = 10_000

function parseDelay(value: string | null): number {
  const delay = Number(value)
  return value !== null && Number.isFinite(delay) && delay >= 0
    ? Math.min(delay, MAX_DELAY_MS)
    : DEFAULT_DELAY_MS
}

/**
 * Builds the application's data provider. This is the one place that decides
 * between browser-local data and the backend.
 *
 * For reviewing loading and error states, two address parameters are read
 * once at start-up: `demoDelay` (milliseconds) and `demoFail` (a
 * comma-separated list of operations such as `events.get`).
 */
export function createServices(
  provider: DataProvider,
  location: Pick<Location, 'search' | 'origin'>,
  storage: Storage,
): Backend {
  if (provider === 'api') {
    throw new DomainError('UNAVAILABLE', { provider })
  }

  const params = new URLSearchParams(location.search)
  return createMockBackend({
    demoPersistence: createBrowserPersistence(storage, DEMO_STORAGE_KEY),
    accountsPersistence: createBrowserPersistence(
      storage,
      ACCOUNTS_STORAGE_KEY,
    ),
    sessionPersistence: createBrowserPersistence(storage, SESSION_STORAGE_KEY),
    preferencesPersistence: createBrowserPersistence(
      storage,
      PREFERENCES_STORAGE_KEY,
    ),
    delayMs: parseDelay(params.get('demoDelay')),
    failOperations: new Set(
      (params.get('demoFail') ?? '').split(',').filter(Boolean),
    ),
    baseUrl: location.origin,
  })
}
