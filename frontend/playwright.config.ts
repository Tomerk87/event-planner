import { defineConfig, devices } from '@playwright/test'

const port = 5173
const baseURL = `http://localhost:${port}`

export default defineConfig({
  testDir: './e2e',
  forbidOnly: !!process.env.CI,
  use: { baseURL },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npm run dev -- --port ${port} --strictPort`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
  },
})
