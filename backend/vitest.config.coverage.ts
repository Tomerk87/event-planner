import { defineConfig } from 'vitest/config'

// Coverage of the whole backend: the unit tests and the integration tests
// (against the PostgreSQL test database) run together, so code tested by
// either one counts. Run with `npm run test:coverage`.
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    projects: [
      {
        extends: './vitest.config.ts',
        test: { name: 'unit' },
      },
      {
        extends: './vitest.config.e2e.ts',
        test: { name: 'integration' },
      },
    ],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/generated/**', 'src/**/*.spec.ts', 'src/**/*.test.ts'],
      // Today's level (2026-11-27: 95.98 / 88.74 / 97.58 / 96.13). Raise these
      // when coverage rises; never lower them. New V2.2 code needs at least
      // 80% on its own (AGENTS.md, D116).
      thresholds: { statements: 95, branches: 88, functions: 97, lines: 96 },
    },
  },
})
