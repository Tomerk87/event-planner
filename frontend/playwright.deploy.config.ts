import { defineConfig, devices } from '@playwright/test'

/**
 * Smoke tests of a deployed stack (PLAN.md Phase 18), run against its public
 * address, with nothing started here:
 *   DEPLOY_URL=https://localhost:8443 npx playwright test -c playwright.deploy.config.ts
 * They create a throwaway account and event and delete the event at the end.
 */
const deployUrl = process.env['DEPLOY_URL']
if (!deployUrl) {
  throw new Error('Set DEPLOY_URL to the deployed address')
}
const local = new URL(deployUrl).hostname === 'localhost'

export default defineConfig({
  testDir: './e2e-deploy',
  forbidOnly: !!process.env.CI,
  // Every test signs up from this machine's address, which the server
  // limits (AUTH_ATTEMPTS_PER_MINUTE): one at a time.
  workers: 1,
  use: {
    baseURL: deployUrl,
    // Only the local stack's certificate is self-signed.
    ignoreHTTPSErrors: local,
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
})
