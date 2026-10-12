import { DomainError } from '../domain/errors.ts'
import type { Services } from './contracts/index.ts'
import { createMockServices } from './mock/mockServices.ts'
import { createBrowserPersistence } from './mock/persistence.ts'
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
 * between demo data and the backend.
 *
 * For reviewing loading and error states of the demo, two address parameters
 * are read once at start-up: `demoDelay` (milliseconds) and `demoFail` (a
 * comma-separated list of operations such as `events.get`).
 */
export function createServices(
  provider: DataProvider,
  location: Pick<Location, 'search' | 'origin'>,
  storage: Storage,
): Services {
  if (provider === 'api') {
    throw new DomainError('UNAVAILABLE', { provider })
  }

  const params = new URLSearchParams(location.search)
  return createMockServices({
    persistence: createBrowserPersistence(storage),
    delayMs: parseDelay(params.get('demoDelay')),
    failOperations: new Set(
      (params.get('demoFail') ?? '').split(',').filter(Boolean),
    ),
    baseUrl: location.origin,
  })
}
