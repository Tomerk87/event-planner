import { DomainError, isDomainError } from '../domain/errors.ts'
import type { Language } from '../i18n/languages.ts'
import { createApiBackend, type ApiBackend } from './api/apiBackend.ts'
import { noAccountsBackend } from './api/noAccountsBackend.ts'
import type { Backend, Session } from './contracts/index.ts'
import type { StoredDemoClock } from './mock/demoClock.ts'
import { demoMarketFor } from './mock/generator.ts'
import { createDemoBackend, type DemoBackend } from './mock/mockBackend.ts'
import {
  createBrowserPersistence,
  DEMO_CLOCK_STORAGE_KEY,
  DEMO_STORAGE_KEY,
  LEGACY_ACCOUNTS_STORAGE_KEY,
  PREFERENCES_STORAGE_KEY,
  SESSION_STORAGE_KEY,
} from './mock/persistence.ts'
import {
  createPreferencesService,
  type StoredPreferences,
} from './preferences.ts'

const DEFAULT_DELAY_MS = 150
const MAX_DELAY_MS = 10_000

function parseDelay(value: string | null): number {
  const delay = Number(value)
  return value !== null && Number.isFinite(delay) && delay >= 0
    ? Math.min(delay, MAX_DELAY_MS)
    : DEFAULT_DELAY_MS
}

/**
 * One backend for the application, from its two sources: the public demo,
 * kept in this browser, and the real accounts on the server. A session
 * belongs to exactly one of them, so their data never meets. Either may be
 * switched off (null): a demo-only site has no accounts (D102).
 */
export function combineBackends(
  demo: DemoBackend | null,
  accounts: ApiBackend | null,
): Backend {
  const api = accounts ?? noAccountsBackend

  async function demoSession() {
    return demo ? demo.auth.getSession() : null
  }

  return {
    demoAvailable: demo !== null,
    accountsAvailable: accounts !== null,
    auth: {
      getSession: async () => (await demoSession()) ?? api.auth.getSession(),

      signUp: async (input) => {
        const session = await api.auth.signUp(input)
        await demo?.auth.signOut()
        return session
      },

      signIn: async (input) => {
        const session = await api.auth.signIn(input)
        await demo?.auth.signOut()
        return session
      },

      enterDemo: () => {
        if (!demo) {
          return Promise.reject(new DomainError('UNAVAILABLE'))
        }
        return demo.auth.enterDemo()
      },

      signOut: async () => {
        if (demo && (await demoSession())) {
          await demo.auth.signOut()
        } else {
          await api.auth.signOut()
        }
      },
    },

    // Email belongs to real accounts; the demo never sends any.
    accountEmail: api.accountEmail,

    servicesFor: (session) =>
      session.workspace === 'demo' && demo
        ? demo.servicesFor(session)
        : api.servicesFor(session),

    // A link of a demo event is answered from this browser; any other link
    // belongs to the server.
    publicRsvp: {
      getPublicEvent: async (slug) => {
        if (demo) {
          try {
            return await demo.publicRsvp.getPublicEvent(slug)
          } catch (error) {
            if (!isDomainError(error, 'NOT_FOUND')) {
              throw error
            }
          }
        }
        return api.publicRsvp.getPublicEvent(slug)
      },
      submit: async (slug, input) => {
        if (demo) {
          try {
            return await demo.publicRsvp.submit(slug, input)
          } catch (error) {
            if (!isDomainError(error, 'NOT_FOUND')) {
              throw error
            }
          }
        }
        return api.publicRsvp.submit(slug, input)
      },
    },

    onExternalChange: (listener) =>
      demo ? demo.onExternalChange(listener) : () => undefined,

    onSessionEnded: (listener) => api.onSessionEnded(listener),

    demoTime: demo?.time ?? null,
  }
}

/**
 * Builds the application's backend. This is the one place that decides
 * where data comes from.
 *
 * For reviewing loading and error states in the demo, two address
 * parameters are read once at start-up: `demoDelay` (milliseconds) and
 * `demoFail` (a comma-separated list of operations such as `events.get`).
 */
export function createServices(options: {
  demoEnabled: boolean
  /** False for a demo-only site, which makes no request to the API (D102). */
  accountsEnabled?: boolean
  location: Pick<Location, 'search' | 'origin'>
  storage: Storage
  apiUrl?: string
  /** The interface language, for the emails a request sends (D88). */
  language?: () => Language
}): Backend {
  const {
    demoEnabled,
    accountsEnabled = true,
    location,
    storage,
    apiUrl = '/api',
    language,
  } = options
  if (!demoEnabled && !accountsEnabled) {
    throw new Error(
      'VITE_DEMO_ENABLED and VITE_ACCOUNTS_ENABLED cannot both be false.',
    )
  }
  // Preview accounts from before the backend are discarded (D85).
  createBrowserPersistence(storage, LEGACY_ACCOUNTS_STORAGE_KEY).clear()

  const params = new URLSearchParams(location.search)
  const preferencesPersistence = createBrowserPersistence<StoredPreferences>(
    storage,
    PREFERENCES_STORAGE_KEY,
  )
  const demo = demoEnabled
    ? createDemoBackend({
        demoPersistence: createBrowserPersistence(storage, DEMO_STORAGE_KEY),
        sessionPersistence: createBrowserPersistence<Session>(
          storage,
          SESSION_STORAGE_KEY,
        ),
        clockPersistence: createBrowserPersistence<StoredDemoClock>(
          storage,
          DEMO_CLOCK_STORAGE_KEY,
        ),
        preferencesPersistence,
        delayMs: parseDelay(params.get('demoDelay')),
        failOperations: new Set(
          (params.get('demoFail') ?? '').split(',').filter(Boolean),
        ),
        baseUrl: location.origin,
        // Brazil's sample events for a visitor using Portuguese (D103).
        market: () => demoMarketFor(language?.() ?? 'en'),
      })
    : null
  const api = accountsEnabled
    ? createApiBackend({
        baseUrl: apiUrl,
        preferences: createPreferencesService(preferencesPersistence),
        language,
      })
    : null
  return combineBackends(demo, api)
}
