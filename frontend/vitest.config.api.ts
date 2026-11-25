import { defineConfig } from 'vitest/config'
import { readBuildVersion, versionDefines } from './buildVersion.ts'

// The provider contract suite on the real API (npm run test:api). Needs the
// development database running and the backend built.
export default defineConfig({
  define: versionDefines(readBuildVersion()),
  test: {
    environment: 'node',
    include: ['api-test/**/*.test.ts'],
    globalSetup: './api-test/server.ts',
    globals: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
    fileParallelism: false,
  },
})
