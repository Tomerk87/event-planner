import type { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import request from 'supertest'
import type TestAgent from 'supertest/lib/agent.js'
import { createAppModule } from '../src/app.module.ts'
import type { AppConfig } from '../src/config.ts'
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
  'MessageSend',
  'Guest',
  'EventTable',
  'UnknownRsvp',
  'RsvpSettings',
  'MessageTemplate',
  'EventInvitation',
  'EventMembership',
  'Event',
  'Session',
  'User',
]

export async function createTestApp(
  overrides: Partial<AppConfig> = {},
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
    ...overrides,
  }
  const moduleRef = await Test.createTestingModule({
    imports: [createAppModule(config)],
  }).compile()
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
