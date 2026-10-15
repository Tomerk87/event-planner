import { spawn, type ChildProcess } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

/** Where the contract suite reaches the API it starts. */
export const API_PORT = 3101
export const BACKEND_DIR = path.resolve(import.meta.dirname, '../../backend')

let server: ChildProcess | undefined

/** The test database of backend/.env, which the suite empties and seeds. */
export function testDatabaseUrl(): string {
  process.loadEnvFile(path.join(BACKEND_DIR, '.env'))
  const url = process.env['TEST_DATABASE_URL']
  if (!url || !new URL(url).pathname.endsWith('_test')) {
    throw new Error(
      'backend/.env must set TEST_DATABASE_URL to a *_test database',
    )
  }
  return url
}

async function waitForHealth(): Promise<void> {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`http://localhost:${API_PORT}/api/health`)
      if (response.ok) {
        return
      }
    } catch {
      // Not listening yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error('the API did not start; run `npm run build` in backend/')
}

/**
 * Starts the built API (backend/dist) on the test database for the run,
 * with limits high enough for one machine signing in for every test.
 */
export async function setup(): Promise<void> {
  server = spawn('node', ['dist/main.js'], {
    cwd: BACKEND_DIR,
    stdio: 'ignore',
    env: {
      ...process.env,
      DATABASE_URL: testDatabaseUrl(),
      PORT: String(API_PORT),
      CORS_ORIGIN: 'http://localhost:5173',
      NODE_ENV: 'test',
      UPLOAD_DIR: mkdtempSync(path.join(tmpdir(), 'event-planner-contract-')),
      AUTH_ATTEMPTS_PER_MINUTE: '100000',
      RSVP_LIMIT_PER_IP: '100000',
      RSVP_LIMIT_PER_PHONE: '100000',
    },
  })
  await waitForHealth()
}

export function teardown(): void {
  server?.kill()
}
