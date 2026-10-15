/**
 * Loads a demo dataset, as the frontend's generator produces it, into the
 * TEST database, so the frontend's provider contract suite can run on the
 * real API (`npm run test:api` in frontend/). Reads the dataset as JSON on
 * standard input; writes the database id of each dataset id as JSON.
 *
 * Run with Node directly: node test/contract-seed.ts < state.json
 * It empties every table first and refuses any database but the test one.
 */
import { PrismaPg } from '@prisma/adapter-pg'
import argon2 from 'argon2'
import { randomUUID } from 'node:crypto'
import { PrismaClient } from '../src/generated/prisma/client.ts'
import { assertTestDatabase } from './global-setup.ts'

/** The password of every seeded account. */
export const CONTRACT_PASSWORD = 'contract-password'

interface Row {
  [field: string]: unknown
}

interface DemoState {
  users: Row[]
  events: Row[]
  memberships: Row[]
  invitations: Row[]
  guests: Row[]
  unknownRsvps: Row[]
  rsvpSettings: Row[]
  messageTemplates: Row[]
  messageSends: Row[]
  tables: Row[]
}

const TABLES = [
  'EmailToken',
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

async function readInput(): Promise<DemoState> {
  const chunks: Buffer[] = []
  for await (const chunk of process.stdin) {
    chunks.push(chunk as Buffer)
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as DemoState
}

const date = (value: unknown) => (value ? new Date(value as string) : null)

try {
  process.loadEnvFile()
} catch {
  // CI provides the variables.
}
const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: assertTestDatabase(process.env['TEST_DATABASE_URL']),
  }),
})
const state = await readInput()
const ids = new Map<string, string>()
const id = (demoId: unknown): string => {
  const key = demoId as string
  if (!ids.has(key)) {
    ids.set(key, randomUUID())
  }
  return ids.get(key)!
}
const passwordHash = await argon2.hash(CONTRACT_PASSWORD)

await prisma.$executeRawUnsafe(
  `TRUNCATE ${TABLES.map((table) => `"${table}"`).join(', ')} CASCADE`,
)
await prisma.user.createMany({
  data: state.users.map((user) => ({
    id: id(user['id']),
    name: user['name'] as string,
    email: user['email'] as string,
    passwordHash,
    isSuperUser: user['isSuperUser'] as boolean,
  })),
})
await prisma.event.createMany({
  data: state.events.map((event) => ({
    id: id(event['id']),
    name: event['name'] as string,
    startsAt: new Date(event['startsAt'] as string),
    timeZone: event['timeZone'] as string,
    maxAttendees: event['maxAttendees'] as number,
    defaultAllowedAttendees: event['defaultAllowedAttendees'] as number,
    rsvpLanguage: event['rsvpLanguage'] as 'en' | 'he',
    location: (event['location'] as string | null) ?? null,
    rsvpTitle: (event['rsvpTitle'] as string | null) ?? null,
    rsvpSlug: event['rsvpSlug'] as string,
  })),
})
await prisma.eventMembership.createMany({
  data: state.memberships.map((membership) => ({
    eventId: id(membership['eventId']),
    userId: id(membership['userId']),
    role: membership['role'] as 'OWNER' | 'ADMIN' | 'VIEWER',
  })),
})
await prisma.eventInvitation.createMany({
  data: state.invitations.map((invitation) => ({
    id: id(invitation['id']),
    eventId: id(invitation['eventId']),
    email: invitation['email'] as string,
    role: invitation['role'] as 'OWNER' | 'ADMIN' | 'VIEWER',
  })),
})
await prisma.eventTable.createMany({
  data: state.tables.map((table) => ({
    id: id(table['id']),
    eventId: id(table['eventId']),
    number: table['number'] as number,
    capacity: table['capacity'] as number,
    shape: table['shape'] as 'CIRCLE' | 'RECTANGLE' | 'SQUARE',
  })),
})
await prisma.guest.createMany({
  data: state.guests.map((guest) => ({
    id: id(guest['id']),
    eventId: id(guest['eventId']),
    firstName: guest['firstName'] as string,
    lastName: guest['lastName'] as string,
    invitationName: (guest['invitationName'] as string | null) ?? null,
    phone: guest['phone'] as string,
    normalizedPhone: guest['normalizedPhone'] as string,
    allowedAttendees: guest['allowedAttendees'] as number,
    confirmedAttendees: (guest['confirmedAttendees'] as number | null) ?? null,
    rsvpStatus: guest['rsvpStatus'] as
      'NO_RESPONSE' | 'APPROVED' | 'NOT_SURE' | 'DECLINED',
    invitationSentCount: guest['invitationSentCount'] as number,
    lastInvitationSentAt: date(guest['lastInvitationSentAt']),
    lastRsvpResponseAt: date(guest['lastRsvpResponseAt']),
    tableId: guest['tableId'] ? id(guest['tableId']) : null,
    group: (guest['group'] as string | null) ?? null,
    deleted: guest['deleted'] as boolean,
  })),
})
await prisma.unknownRsvp.createMany({
  data: state.unknownRsvps.map((unknown) => ({
    id: id(unknown['id']),
    eventId: id(unknown['eventId']),
    name: unknown['name'] as string,
    phone: unknown['phone'] as string,
    normalizedPhone: unknown['normalizedPhone'] as string,
    rsvpStatus: unknown['rsvpStatus'] as 'APPROVED' | 'NOT_SURE' | 'DECLINED',
    confirmedAttendees:
      (unknown['confirmedAttendees'] as number | null) ?? null,
    submittedAt: new Date(unknown['submittedAt'] as string),
    rejectedAt: date(unknown['rejectedAt']),
  })),
})
await prisma.rsvpSettings.createMany({
  data: state.rsvpSettings.map((settings) => {
    const calendar = settings['calendar'] as Row
    const youtube = settings['youtube'] as Row
    return {
      eventId: id(settings['eventId']),
      welcomeMessage: settings['welcomeMessage'] as string,
      approvedMessage: settings['approvedMessage'] as string,
      declinedMessage: settings['declinedMessage'] as string,
      notSureMessage: settings['notSureMessage'] as string,
      // Demo pictures are not files; the seeded events have none.
      backgroundImageKey: null,
      overlayOpacity: settings['overlayOpacity'] as number,
      calendarEnabled: calendar['enabled'] as boolean,
      calendarTitle: calendar['title'] as string,
      calendarDate: calendar['date'] as string,
      calendarTime: calendar['time'] as string,
      calendarLocation: calendar['location'] as string,
      youtubeEnabled: youtube['enabled'] as boolean,
      youtubeUrl: youtube['url'] as string,
    }
  }),
})
await prisma.messageTemplate.createMany({
  data: state.messageTemplates.map((template) => ({
    eventId: id(template['eventId']),
    body: template['body'] as string,
  })),
})
await prisma.messageSend.createMany({
  data: state.messageSends.map((send) => ({
    id: id(send['id']),
    eventId: id(send['eventId']),
    guestId: id(send['guestId']),
    sentAt: new Date(send['sentAt'] as string),
    message: send['message'] as string,
  })),
})
await prisma.$disconnect()
process.stdout.write(JSON.stringify(Object.fromEntries(ids)))
