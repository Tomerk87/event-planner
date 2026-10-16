import type { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import request from 'supertest'
import type TestAgent from 'supertest/lib/agent.js'
import { createAppModule } from '../src/app.module.ts'
import type { AppConfig } from '../src/config.ts'
import { MAILER, type EmailMessage, type Mailer } from '../src/email/mailer.ts'
import { PrismaService } from '../src/prisma/prisma.service.ts'
import { setupApp } from '../src/setup-app.ts'
import { assertTestDatabase } from './global-setup.ts'

export interface TestApp {
  app: INestApplication
  prisma: PrismaService
  /** A browser of its own, keeping its session cookie between requests. */
  browser: () => TestAgent
  close: () => Promise<void>
}

const TABLES = [
  'EmailToken',
  'Notification',
  'MessageSend',
  'Guest',
  'EventTable',
  'VenueObject',
  'UnknownRsvp',
  'RsvpSettings',
  'MessageTemplate',
  'EventInvitation',
  'EventMembership',
  'Event',
  'Session',
  'User',
]

/** Keeps every email the application sends, instead of delivering it. */
export class CapturingMailer implements Mailer {
  readonly sent: EmailMessage[] = []
  failNext = false

  send(message: EmailMessage): Promise<void> {
    if (this.failNext) {
      this.failNext = false
      return Promise.reject(
        Object.assign(new Error(`rejected ${message.to}`), {
          code: 'EENVELOPE',
        }),
      )
    }
    this.sent.push(message)
    return Promise.resolve()
  }

  /** The emails sent to an address, oldest first. */
  to(address: string): EmailMessage[] {
    return this.sent.filter((message) => message.to === address)
  }

  /** The token of the last link of a kind sent to an address. */
  tokenFor(address: string, kind: string): string {
    const message = this.to(address)
      .filter((email) => email.kind === kind)
      .at(-1)
    const token = message?.text.match(/token=([\w-]+)/)?.[1]
    if (!token) {
      throw new Error(`No ${kind} link sent to ${address}`)
    }
    return token
  }
}

/** Email settings with sending on, for the tests of the email features. */
export const EMAIL_ON: AppConfig['email'] = {
  mode: 'smtp',
  smtp: {
    host: 'localhost',
    port: 1025,
    secure: false,
    user: null,
    password: null,
  },
  from: 'Event Planner <noreply@example.com>',
  verifyHours: 24,
  resetMinutes: 60,
  perAddressPerHour: 3,
}

export async function createTestApp(
  overrides: Partial<AppConfig> = {},
  options: { mailer?: Mailer } = {},
): Promise<TestApp> {
  try {
    process.loadEnvFile()
  } catch {
    // CI provides the variables.
  }
  const config: AppConfig = {
    databaseUrl: assertTestDatabase(process.env['TEST_DATABASE_URL']),
    port: 0,
    corsOrigin: 'http://localhost:5173',
    production: false,
    uploadDir: mkdtempSync(path.join(tmpdir(), 'event-planner-uploads-')),
    sessionDays: 30,
    // Tests sign up many people from one address.
    authAttemptsPerMinute: 1000,
    publicAppUrl: 'http://localhost:5173',
    // Tests answer many RSVPs from one address; the limits have their own tests.
    rsvpLimits: { perIp: 1000, perPhone: 1000, windowMinutes: 10 },
    trustProxyHops: 0,
    email: {
      mode: 'off',
      smtp: null,
      from: '',
      verifyHours: 24,
      resetMinutes: 60,
      perAddressPerHour: 3,
    },
    ...overrides,
  }
  const moduleRef = await Test.createTestingModule({
    imports: [createAppModule(config)],
  })
    .overrideProvider(MAILER)
    .useValue(options.mailer ?? new CapturingMailer())
    .compile()
  const app = moduleRef.createNestApplication({ logger: false })
  setupApp(app, config)
  await app.init()
  return {
    app,
    prisma: app.get(PrismaService),
    browser: () => request.agent(app.getHttpServer()),
    close: () => app.close(),
  }
}

/** Empties every table, so each test starts from nothing. */
export async function resetDatabase(prisma: PrismaService): Promise<void> {
  await prisma.$executeRawUnsafe(
    `TRUNCATE ${TABLES.map((table) => `"${table}"`).join(', ')} CASCADE`,
  )
}

export async function signUp(
  browser: TestAgent,
  name: string,
  email = `${name.toLowerCase().replace(/\s+/g, '.')}@example.com`,
): Promise<{ id: string; email: string }> {
  const response = await browser
    .post('/api/auth/sign-up')
    .send({ name, email, password: 'correct-horse' })
    .expect(201)
  return response.body as { id: string; email: string }
}

export const NEW_EVENT = {
  name: 'Garden Party',
  startsAt: '2031-06-01T17:00:00.000Z',
  timeZone: 'Asia/Jerusalem',
  maxAttendees: 120,
  defaultAllowedAttendees: 4,
  rsvpLanguage: 'en',
} as const

export async function createEvent(
  browser: TestAgent,
  overrides: Record<string, unknown> = {},
): Promise<{ id: string; rsvpSlug: string; coverImage: string | null }> {
  const response = await browser
    .post('/api/events')
    .send({ ...NEW_EVENT, ...overrides })
    .expect(201)
  return response.body as {
    id: string
    rsvpSlug: string
    coverImage: string | null
  }
}

/** Moves an event's start into the past, as time passing would. */
export async function makePast(
  prisma: PrismaService,
  eventId: string,
): Promise<void> {
  await prisma.event.update({
    where: { id: eventId },
    data: { startsAt: new Date(Date.now() - 60_000) },
  })
}
