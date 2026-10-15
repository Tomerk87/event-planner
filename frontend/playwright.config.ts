import { defineConfig, devices } from '@playwright/test'
import { existsSync, mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { parseEnv } from 'node:util'

// Ports of their own, so a development server already running (with the
// development database behind it) is never reused by the tests.
const port = 5174
const apiPort = 3102
const baseURL = `http://localhost:${port}`

/** The backend's test database; the real-account tests write to it. */
function testDatabaseUrl(): string {
  const envFile = path.resolve(import.meta.dirname, '../backend/.env')
  const values = existsSync(envFile)
    ? parseEnv(readFileSync(envFile, 'utf8'))
    : {}
  const url = process.env['TEST_DATABASE_URL'] ?? values['TEST_DATABASE_URL']
  if (!url || !new URL(url).pathname.endsWith('_test')) {
    throw new Error(
      'backend/.env must set TEST_DATABASE_URL (a *_test database)',
    )
  }
  return url
}

export default defineConfig({
  testDir: './e2e',
  forbidOnly: !!process.env.CI,
  use: { baseURL },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: [
    {
      // The real API on the test database, for sign-up, sign-in and the
      // pages of a real account. The demo never calls it.
      command:
        'npm --prefix ../backend run build && node ../backend/dist/main.js',
      url: `http://localhost:${apiPort}/api/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        DATABASE_URL: testDatabaseUrl(),
        PORT: String(apiPort),
        CORS_ORIGIN: baseURL,
        NODE_ENV: 'test',
        UPLOAD_DIR: mkdtempSync(path.join(tmpdir(), 'event-planner-e2e-')),
        // Every test signs up from the same address.
        AUTH_ATTEMPTS_PER_MINUTE: '100000',
        RSVP_LIMIT_PER_IP: '100000',
        RSVP_LIMIT_PER_PHONE: '100000',
      },
    },
    {
      command: `npm run dev -- --port ${port} --strictPort`,
      url: baseURL,
      reuseExistingServer: !process.env.CI,
      env: { API_URL: `http://localhost:${apiPort}` },
    },
  ],
})
