import { PrismaPg } from '@prisma/adapter-pg'
import { normalizeEmail } from '../domain/accounts.ts'
import { PrismaClient } from '../generated/prisma/client.ts'

/**
 * Super User is set only in the database (PRD section 3.2). Usage:
 *   npm run super-user -- someone@example.com        grant
 *   npm run super-user -- someone@example.com --off  remove
 */
try {
  process.loadEnvFile()
} catch {
  // The environment provides DATABASE_URL.
}
const [email, flag] = process.argv.slice(2)
if (!email || (flag !== undefined && flag !== '--off')) {
  console.error('Usage: npm run super-user -- <email> [--off]')
  process.exit(1)
}
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env['DATABASE_URL'] }),
})
try {
  const user = await prisma.user.update({
    where: { email: normalizeEmail(email) },
    data: { isSuperUser: flag !== '--off' },
  })
  console.log(
    `${user.email} is ${user.isSuperUser ? 'now' : 'no longer'} a Super User.`,
  )
} catch {
  console.error(`No account with the email ${email}.`)
  process.exitCode = 1
} finally {
  await prisma.$disconnect()
}
