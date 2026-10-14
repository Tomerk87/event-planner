import { execSync } from 'node:child_process'

/** The tests empty their database, so it must be a dedicated test database. */
export function assertTestDatabase(url: string | undefined): string {
  if (!url) {
    throw new Error('TEST_DATABASE_URL is not set (see .env.example)')
  }
  const name = new URL(url).pathname.slice(1)
  if (!name.endsWith('_test') || url === process.env['DATABASE_URL']) {
    throw new Error(
      `Refusing to use "${name}" for tests: the test database name must end in _test and differ from DATABASE_URL`,
    )
  }
  return url
}

/**
 * Brings the test database up to the current migrations before the
 * integration tests run. `migrate deploy` only adds what is missing; each
 * test then empties the tables it uses (test-app.ts).
 */
export default function setup(): void {
  try {
    process.loadEnvFile()
  } catch {
    // CI provides the variables.
  }
  const url = assertTestDatabase(process.env['TEST_DATABASE_URL'])
  execSync('npx prisma migrate deploy', {
    stdio: 'pipe',
    env: { ...process.env, DATABASE_URL: url },
  })
}
