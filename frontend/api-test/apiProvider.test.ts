import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { vi } from 'vitest'
import { createApiBackend } from '../src/services/api/apiBackend.ts'
import { describeServicesContract } from '../src/services/contracts/servicesContract.ts'
import { generateDemoState } from '../src/services/mock/generator.ts'
import { createPreferencesService } from '../src/services/preferences.ts'
import { createMemoryPersistence } from '../src/services/mock/persistence.ts'
import { API_PORT, BACKEND_DIR, testDatabaseUrl } from './server.ts'

// The suite checks that no data operation opens a window (WhatsApp is opened
// by the page, from the user's click); Node has no window to watch.
vi.stubGlobal('window', { open: () => null })

/** Keeps the session cookie between requests, as a browser does. */
function browserFetch(): typeof fetch {
  let cookie = ''
  return async (input, init) => {
    const headers = new Headers(init?.headers)
    if (cookie) {
      headers.set('Cookie', cookie)
    }
    const response = await fetch(input, { ...init, headers })
    const set = response.headers.getSetCookie()[0]
    if (set) {
      cookie = set.split(';')[0]!
    }
    return response
  }
}

/**
 * The same provider contract the demo passes, run on the real API with the
 * same generated dataset loaded into the test database before each test.
 */
describeServicesContract(
  'API provider',
  async () => {
    const state = generateDemoState(new Date())
    const ids = JSON.parse(
      execFileSync('node', [path.join('test', 'contract-seed.ts')], {
        cwd: BACKEND_DIR,
        input: JSON.stringify(state),
        env: { ...process.env, TEST_DATABASE_URL: testDatabaseUrl() },
      }).toString('utf8'),
    ) as Record<string, string>
    const user = state.users.find((each) => each.id === state.currentUserId)!
    const backend = createApiBackend({
      baseUrl: `http://localhost:${API_PORT}/api`,
      fetch: browserFetch(),
      preferences: createPreferencesService(createMemoryPersistence()),
    })
    const session = await backend.auth.signIn({
      email: user.email,
      password: 'contract-password',
    })
    const event = (demoId: string) => ids[demoId]!
    return {
      services: backend.servicesFor(session),
      events: {
        owner: event('evt-1'),
        admin: event('evt-3'),
        viewer: event('evt-4'),
        past: event('evt-5'),
      },
    }
  },
  { clock: false },
)
