import type TestAgent from 'supertest/lib/agent.js'
import {
  createEvent,
  createTestApp,
  makePast,
  NEW_EVENT,
  resetDatabase,
  signUp,
  type TestApp,
} from './test-app.ts'

let t: TestApp

beforeAll(async () => {
  t = await createTestApp()
})
afterAll(async () => {
  await t.close()
})

type Role = 'VIEWER' | 'ADMIN' | 'OWNER' | 'SUPER_USER' | 'OUTSIDER'
const ROLES: Role[] = ['VIEWER', 'ADMIN', 'OWNER', 'SUPER_USER', 'OUTSIDER']

const OK = 'OK'
const NO = 'FORBIDDEN'
const ENDED = 'EVENT_READ_ONLY'
const HIDDEN = 'NOT_FOUND'

// The outcome of each action for Viewer, Admin, Owner, Super User and someone outside the event.
const EXPECTED = {
  upcoming: {
    'view the event': [OK, OK, OK, OK, HIDDEN],
    'list guests': [OK, OK, OK, OK, HIDDEN],
    'export guests': [OK, OK, OK, OK, HIDDEN],
    'add a guest': [NO, OK, OK, OK, HIDDEN],
    'edit the event': [NO, OK, OK, OK, HIDDEN],
    'see permissions': [NO, OK, OK, OK, HIDDEN],
    'invite a Viewer': [NO, OK, OK, OK, HIDDEN],
    'invite an Owner': [NO, NO, OK, OK, HIDDEN],
    'duplicate the event': [NO, NO, OK, OK, HIDDEN],
    'delete the event': [NO, NO, OK, OK, HIDDEN],
    'view the dashboard': [OK, OK, OK, OK, HIDDEN],
    'list sent messages': [OK, OK, OK, OK, HIDDEN],
    'send a message': [NO, OK, OK, OK, HIDDEN],
    'edit the message template': [NO, OK, OK, OK, HIDDEN],
    'view RSVP settings': [OK, OK, OK, OK, HIDDEN],
    'edit RSVP settings': [NO, OK, OK, OK, HIDDEN],
    'list tables': [OK, OK, OK, OK, HIDDEN],
    'add a table': [NO, OK, OK, OK, HIDDEN],
    'export seating': [OK, OK, OK, OK, HIDDEN],
  },
  past: {
    'view the event': [OK, OK, OK, OK, HIDDEN],
    'list guests': [OK, OK, OK, OK, HIDDEN],
    'export guests': [OK, OK, OK, OK, HIDDEN],
    'add a guest': [NO, ENDED, ENDED, ENDED, HIDDEN],
    'edit the event': [NO, ENDED, ENDED, ENDED, HIDDEN],
    'see permissions': [NO, OK, OK, OK, HIDDEN],
    'invite a Viewer': [NO, ENDED, OK, OK, HIDDEN],
    'invite an Owner': [NO, ENDED, OK, OK, HIDDEN],
    'duplicate the event': [NO, NO, OK, OK, HIDDEN],
    'delete the event': [NO, NO, OK, OK, HIDDEN],
    'view the dashboard': [OK, OK, OK, OK, HIDDEN],
    'list sent messages': [OK, OK, OK, OK, HIDDEN],
    'send a message': [NO, ENDED, ENDED, ENDED, HIDDEN],
    'edit the message template': [NO, ENDED, ENDED, ENDED, HIDDEN],
    'view RSVP settings': [OK, OK, OK, OK, HIDDEN],
    'edit RSVP settings': [NO, ENDED, ENDED, ENDED, HIDDEN],
    'list tables': [OK, OK, OK, OK, HIDDEN],
    'add a table': [NO, ENDED, ENDED, ENDED, HIDDEN],
    'export seating': [OK, OK, OK, OK, HIDDEN],
  },
} as const

type Action = keyof typeof EXPECTED.upcoming

const LABELS = {
  headings: Object.fromEntries(
    [
      'firstName',
      'lastName',
      'invitationName',
      'phone',
      'allowedAttendees',
      'confirmedAttendees',
      'status',
      'invitationSentCount',
      'tableNumber',
      'group',
    ].map((key) => [key, key]),
  ),
  statuses: Object.fromEntries(
    ['NOT_SENT', 'AWAITING_RESPONSE', 'APPROVED', 'NOT_SURE', 'DECLINED'].map(
      (key) => [key, key],
    ),
  ),
}

const SETTINGS = {
  welcomeMessage: 'Welcome',
  approvedMessage: 'Thanks',
  declinedMessage: 'Sorry',
  notSureMessage: 'Maybe',
  backgroundImage: null,
  overlayOpacity: 40,
  calendar: {
    enabled: false,
    title: 'Party',
    date: '2031-06-01',
    time: '20:00',
    location: '',
  },
  youtube: { enabled: false, url: '' },
}

function attempt(
  browser: TestAgent,
  eventId: string,
  guestId: string,
  action: Action,
) {
  const event = `/api/events/${eventId}`
  switch (action) {
    case 'view the event':
      return browser.get(event)
    case 'list guests':
      return browser.get(`${event}/guests`)
    case 'export guests':
      return browser.post(`${event}/guests/export`).send({
        format: 'csv',
        labels: LABELS,
        sheetName: 'Guests',
        rightToLeft: false,
      })
    case 'add a guest':
      return browser.post(`${event}/guests`).send({
        firstName: 'New',
        lastName: 'Guest',
        phone: '053-555-0001',
        allowedAttendees: 2,
      })
    case 'edit the event':
      return browser.put(event).send({ ...NEW_EVENT, name: 'Edited' })
    case 'see permissions':
      return browser.get(`${event}/permissions`)
    case 'invite a Viewer':
      return browser
        .post(`${event}/permissions/invitations`)
        .send({ email: 'v@example.org', role: 'VIEWER' })
    case 'invite an Owner':
      return browser
        .post(`${event}/permissions/invitations`)
        .send({ email: 'o@example.org', role: 'OWNER' })
    case 'duplicate the event':
      return browser
        .post(`${event}/duplicate`)
        .send({ name: 'Copy', startsAt: '2033-01-01T18:00:00.000Z' })
    case 'delete the event':
      return browser.delete(event)
    case 'view the dashboard':
      return browser.get(`${event}/dashboard`)
    case 'list sent messages':
      return browser.get(`${event}/messages/sends`)
    case 'send a message':
      return browser.post(`${event}/messages/sends/${guestId}`)
    case 'edit the message template':
      return browser
        .put(`${event}/messages/template`)
        .send({ body: 'Hi {{first_name}}' })
    case 'view RSVP settings':
      return browser.get(`${event}/rsvp-settings`)
    case 'edit RSVP settings':
      return browser.put(`${event}/rsvp-settings`).send(SETTINGS)
    case 'list tables':
      return browser.get(`${event}/tables`)
    case 'add a table':
      return browser
        .post(`${event}/tables`)
        .send({ number: 7, capacity: 8, shape: 'CIRCLE' })
    case 'export seating':
      return browser.post(`${event}/tables/export`).send({
        format: 'csv',
        headings: {
          firstName: 'a',
          lastName: 'b',
          invitationName: 'c',
          phone: 'd',
          confirmedAttendees: 'e',
          tableNumber: 'f',
        },
        sheetName: 'Seating',
        rightToLeft: false,
      })
  }
}

/** A fresh event and one browser per role; the Super User has no membership. */
async function world(past: boolean) {
  await resetDatabase(t.prisma)
  const owner = t.browser()
  await signUp(owner, 'Owner')
  const event = await createEvent(owner)
  const guest = await owner
    .post(`/api/events/${event.id}/guests`)
    .send({
      firstName: 'Dana',
      lastName: 'Lev',
      phone: '052-123-4567',
      allowedAttendees: 2,
    })
    .expect(201)
  const browsers: Record<Role, TestAgent> = { OWNER: owner } as Record<
    Role,
    TestAgent
  >
  for (const role of ['VIEWER', 'ADMIN'] as const) {
    browsers[role] = t.browser()
    const { email } = await signUp(browsers[role], role)
    await owner
      .post(`/api/events/${event.id}/permissions/invitations`)
      .send({ email, role })
      .expect(201)
  }
  browsers.SUPER_USER = t.browser()
  const superUser = await signUp(browsers.SUPER_USER, 'Super')
  await t.prisma.user.update({
    where: { id: superUser.id },
    data: { isSuperUser: true },
  })
  browsers.OUTSIDER = t.browser()
  await signUp(browsers.OUTSIDER, 'Outsider')
  if (past) {
    await makePast(t.prisma, event.id)
  }
  return {
    eventId: event.id,
    guestId: (guest.body as { id: string }).id,
    browsers,
  }
}

describe.each(['upcoming', 'past'] as const)('on an %s event', (when) => {
  describe.each(ROLES.map((role, index) => [role, index] as const))(
    'as %s',
    (role, index) => {
      it.each(Object.keys(EXPECTED[when]) as Action[])('%s', async (action) => {
        const { eventId, guestId, browsers } = await world(when === 'past')

        const response = await attempt(browsers[role], eventId, guestId, action)

        const outcome =
          response.status < 300 ? OK : (response.body as { code: string }).code
        expect(outcome).toBe(EXPECTED[when][action][index])
      })
    },
  )
})

it('refuses every event route without a session', async () => {
  const { eventId, guestId } = await world(false)
  const anonymous = t.browser()

  for (const action of Object.keys(EXPECTED.upcoming) as Action[]) {
    const response = await attempt(anonymous, eventId, guestId, action)
    expect([action, response.status]).toEqual([action, 401])
  }
})
