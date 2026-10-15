import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

/**
 * The API, reached through this server so the session cookie stays on the
 * same origin, as Nginx does in production (PLAN.md Phase 18).
 */
const api = {
  '/api': {
    target: process.env['API_URL'] ?? 'http://localhost:3000',
    changeOrigin: true,
  },
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: api,
  },
  preview: { proxy: api },
  // Loaded only when a file is imported or exported, so the development
  // server would otherwise discover them late and reload the page mid-action.
  optimizeDeps: {
    include: ['read-excel-file/browser', 'write-excel-file/browser'],
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/**/*.d.ts',
        'src/test/**',
        'src/main.tsx',
      ],
      thresholds: { statements: 80, branches: 80, functions: 80, lines: 80 },
    },
  },
})
