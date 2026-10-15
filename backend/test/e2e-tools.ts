/**
 * Changes the TEST database for the browser tests (frontend/e2e), for what
 * the API rightly refuses, such as an event that has already started.
 *
 *   node test/e2e-tools.ts make-past <eventId>
 *   node test/e2e-tools.ts super-user <email>
 *
 * Refuses any database but the test one.
 */
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../src/generated/prisma/client.ts'
import { assertTestDatabase } from './global-setup.ts'

try {
  process.loadEnvFile()
} catch {
  // CI provides the variables.
}
const [command, target] = process.argv.slice(2)
const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: assertTestDatabase(process.env['TEST_DATABASE_URL']),
  }),
})
try {
  if (command === 'make-past' && target) {
    await prisma.event.update({
      where: { id: target },
      data: { startsAt: new Date(Date.now() - 60_000) },
    })
  } else if (command === 'super-user' && target) {
    await prisma.user.update({
      where: { email: target },
      data: { isSuperUser: true },
    })
  } else {
    throw new Error(
      'Usage: e2e-tools.ts make-past <eventId> | super-user <email>',
    )
  }
} finally {
  await prisma.$disconnect()
}
