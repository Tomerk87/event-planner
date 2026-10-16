import { readSheet } from 'read-excel-file/node'
import type TestAgent from 'supertest/lib/agent.js'
import {
  createEvent,
  createTestApp,
  makePast,
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
beforeEach(async () => {
  await resetDatabase(t.prisma)
})

function code(response: { body: unknown }): string {
  return (response.body as { code: string }).code
}

async function setUp() {
  const owner = t.browser()
  await signUp(owner, 'Owner')
  const event = await createEvent(owner)
  return { owner, event, base: `/api/events/${event.id}` }
}

async function addTable(
  owner: TestAgent,
  base: string,
  number: number,
  capacity: number,
): Promise<string> {
  const response = await owner
    .post(`${base}/tables`)
    .send({ number, capacity, shape: 'CIRCLE' })
    .expect(201)
  return (response.body as { id: string }).id
}

/** A guest with an RSVP, seated when a table is given. */
async function addGuest(
  owner: TestAgent,
  base: string,
  options: {
    firstName: string
    phone: string
    status?: 'APPROVED' | 'DECLINED' | 'NOT_SURE'
    attendees?: number
    tableId?: string
    sent?: number
  },
): Promise<string> {
  const guest = (
    await owner
      .post(`${base}/guests`)
      .send({
        firstName: options.firstName,
        lastName: 'Test',
        phone: options.phone,
        allowedAttendees: 6,
      })
      .expect(201)
  ).body as { id: string }
  if (options.status) {
    await owner
      .put(`${base}/guests/${guest.id}/rsvp`)
      .send({ status: options.status, attendees: options.attendees ?? null })
      .expect(200)
  }
  if (options.tableId) {
    await owner
      .put(`${base}/guests/${guest.id}/table`)
      .send({ tableId: options.tableId })
      .expect(200)
  }
  for (let index = 0; index < (options.sent ?? 0); index += 1) {
    await owner.post(`${base}/messages/sends/${guest.id}`).expect(201)
  }
  return guest.id
}

const HEADINGS = {
  firstName: 'First Name',
  lastName: 'Last Name',
  invitationName: 'Invitation Name',
  phone: 'Phone',
  confirmedAttendees: 'Confirmed',
  tableNumber: 'Table',
}

describe('tables', () => {
  it('adds, lists in number order, edits and refuses a duplicate number or bad values', async () => {
    const { owner, base } = await setUp()
    const second = await addTable(owner, base, 2, 8)
    await addTable(owner, base, 1, 10)

    const list = await owner.get(`${base}/tables`).expect(200)
    expect(
      list.body.map((row: { table: { number: number } }) => row.table.number),
    ).toEqual([1, 2])
    expect(list.body[0]).toMatchObject({ assigned: 0, available: 10 })

    const edited = await owner
      .put(`${base}/tables/${second}`)
      .send({ number: 3, capacity: 12, shape: 'SQUARE' })
      .expect(200)
    expect(edited.body).toMatchObject({
      number: 3,
      capacity: 12,
      shape: 'SQUARE',
    })
    // Its own number again is fine.
    await owner
      .put(`${base}/tables/${second}`)
      .send({ number: 3, capacity: 12, shape: 'SQUARE' })
      .expect(200)

    expect(
      code(
        await owner
          .post(`${base}/tables`)
          .send({ number: 1, capacity: 4, shape: 'CIRCLE' })
          .expect(409),
      ),
    ).toBe('DUPLICATE_TABLE_NUMBER')
    expect(
      code(
        await owner
          .put(`${base}/tables/${second}`)
          .send({ number: 1, capacity: 4, shape: 'CIRCLE' })
          .expect(409),
      ),
    ).toBe('DUPLICATE_TABLE_NUMBER')
    expect(
      code(
        await owner
          .post(`${base}/tables`)
          .send({ number: 5, capacity: 0, shape: 'CIRCLE' })
          .expect(400),
      ),
    ).toBe('VALIDATION')
    expect(
      code(
        await owner
          .post(`${base}/tables`)
          .send({ number: 5, capacity: 4, shape: 'OVAL' })
          .expect(400),
      ),
    ).toBe('VALIDATION')
    expect(
      code(
        await owner
          .put(`${base}/tables/not-a-table`)
          .send({ number: 9, capacity: 4, shape: 'CIRCLE' })
          .expect(404),
      ),
    ).toBe('NOT_FOUND')
  })

  it('accepts a capacity below the guests seated, shown as over capacity', async () => {
    const { owner, base } = await setUp()
    const table = await addTable(owner, base, 1, 6)
    await addGuest(owner, base, {
      firstName: 'Dana',
      phone: '052-000-0001',
      status: 'APPROVED',
      attendees: 5,
      tableId: table,
    })

    await owner
      .put(`${base}/tables/${table}`)
      .send({ number: 1, capacity: 3, shape: 'CIRCLE' })
      .expect(200)

    const list = await owner.get(`${base}/tables`).expect(200)
    expect(list.body[0]).toMatchObject({ assigned: 5, available: -2 })
  })

  it('deletes a table and unassigns its guests without deleting them', async () => {
    const { owner, base } = await setUp()
    const table = await addTable(owner, base, 1, 6)
    const dana = await addGuest(owner, base, {
      firstName: 'Dana',
      phone: '052-000-0001',
      status: 'APPROVED',
      attendees: 2,
      tableId: table,
    })

    await owner.delete(`${base}/tables/${table}`).expect(204)

    expect((await owner.get(`${base}/tables`)).body).toEqual([])
    const guest = await t.prisma.guest.findUniqueOrThrow({
      where: { id: dana },
    })
    expect(guest).toMatchObject({ tableId: null, deleted: false })
    expect(
      code(await owner.delete(`${base}/tables/${table}`).expect(404)),
    ).toBe('NOT_FOUND')
  })

  it('keeps tables of other events apart', async () => {
    const { owner, base } = await setUp()
    const other = await createEvent(owner, { name: 'Other' })
    const foreign = await addTable(owner, `/api/events/${other.id}`, 1, 4)

    expect(
      code(
        await owner
          .put(`${base}/tables/${foreign}`)
          .send({ number: 1, capacity: 4, shape: 'CIRCLE' })
          .expect(404),
      ),
    ).toBe('NOT_FOUND')
    expect(
      code(await owner.delete(`${base}/tables/${foreign}`).expect(404)),
    ).toBe('NOT_FOUND')
    // The same number is free in another event.
    await addTable(owner, base, 1, 4)
  })

  it('is read-only for a Viewer and on a past event, with viewing and export still allowed', async () => {
    const { owner, event, base } = await setUp()
    const table = await addTable(owner, base, 1, 6)
    const viewer = t.browser()
    const { email } = await signUp(viewer, 'Viewer')
    await owner
      .post(`${base}/permissions/invitations`)
      .send({ email, role: 'VIEWER' })
      .expect(201)
    const exportBody = {
      format: 'csv',
      headings: HEADINGS,
      sheetName: 'Seating',
      rightToLeft: false,
    }

    await viewer.get(`${base}/tables`).expect(200)
    await viewer.post(`${base}/tables/export`).send(exportBody).expect(200)
    expect(
      code(
        await viewer
          .post(`${base}/tables`)
          .send({ number: 2, capacity: 4, shape: 'CIRCLE' })
          .expect(403),
      ),
    ).toBe('FORBIDDEN')

    await makePast(t.prisma, event.id)
    expect(
      code(await owner.delete(`${base}/tables/${table}`).expect(403)),
    ).toBe('EVENT_READ_ONLY')
    await owner.get(`${base}/tables`).expect(200)
    await viewer.post(`${base}/tables/export`).send(exportBody).expect(200)
  })
})

describe('seating export', () => {
  it('lists each seated party in table order, as CSV and Excel', async () => {
    const { owner, base } = await setUp()
    const one = await addTable(owner, base, 1, 10)
    const two = await addTable(owner, base, 2, 10)
    await addGuest(owner, base, {
      firstName: 'Zoe',
      phone: '052-000-0001',
      status: 'APPROVED',
      attendees: 2,
      tableId: two,
    })
    await addGuest(owner, base, {
      firstName: '=Amit',
      phone: '052-000-0002',
      status: 'APPROVED',
      attendees: 3,
      tableId: one,
    })
    // Approved without a table, and a guest who never answered: not listed.
    await addGuest(owner, base, {
      firstName: 'Noa',
      phone: '052-000-0003',
      status: 'APPROVED',
      attendees: 1,
    })
    await addGuest(owner, base, { firstName: 'Eli', phone: '052-000-0004' })

    const csv = await owner
      .post(`${base}/tables/export`)
      .send({
        format: 'csv',
        headings: HEADINGS,
        sheetName: 'Seating',
        rightToLeft: false,
      })
      .expect(200)
    expect(csv.headers['content-type']).toMatch(/^text\/csv/)
    expect(csv.headers['content-disposition']).toContain('seating.csv')
    const lines = csv.text.replace(/^﻿/, '').trim().split(/\r?\n/)
    expect(lines).toEqual([
      'First Name,Last Name,Invitation Name,Phone,Confirmed,Table',
      // A leading "=" is made harmless so a spreadsheet does not run it.
      "'=Amit,Test,,052-000-0002,3,1",
      'Zoe,Test,,052-000-0001,2,2',
    ])

    const xlsx = await owner
      .post(`${base}/tables/export`)
      .send({
        format: 'xlsx',
        headings: HEADINGS,
        sheetName: 'Seating',
        rightToLeft: true,
      })
      .buffer(true)
      .parse((response, done) => {
        const chunks: Buffer[] = []
        response.on('data', (chunk: Buffer) => chunks.push(chunk))
        response.on('end', () => done(null, Buffer.concat(chunks)))
      })
      .expect(200)
    const rows = await readSheet(xlsx.body as Buffer)
    expect(rows).toHaveLength(3)
    expect(rows[2]).toEqual(['Zoe', 'Test', null, '052-000-0001', 2, 2])

    // Only the selected tables; an id that is not a table matches none.
    const selected = await owner
      .post(`${base}/tables/export`)
      .send({
        format: 'csv',
        headings: HEADINGS,
        sheetName: 'Seating',
        rightToLeft: false,
        tableIds: [two, 'not-a-table'],
      })
      .expect(200)
    expect(selected.text.replace(/^﻿/, '').trim().split(/\r?\n/)).toEqual([
      'First Name,Last Name,Invitation Name,Phone,Confirmed,Table',
      'Zoe,Test,,052-000-0001,2,2',
    ])
  })

  it('refuses missing headings or an unknown format', async () => {
    const { owner, base } = await setUp()

    expect(
      code(
        await owner
          .post(`${base}/tables/export`)
          .send({
            format: 'pdf',
            headings: HEADINGS,
            sheetName: 'S',
            rightToLeft: false,
          })
          .expect(400),
      ),
    ).toBe('VALIDATION')
    expect(
      code(
        await owner
          .post(`${base}/tables/export`)
          .send({
            format: 'csv',
            headings: {},
            sheetName: 'S',
            rightToLeft: false,
          })
          .expect(400),
      ),
    ).toBe('VALIDATION')
  })
})

describe('dashboard', () => {
  it('derives every figure from the stored records', async () => {
    const { owner, event, base } = await setUp()
    const one = await addTable(owner, base, 1, 4)
    await addTable(owner, base, 2, 6)
    // Approved 3, seated; sent twice (still one invitation sent).
    await addGuest(owner, base, {
      firstName: 'Dana',
      phone: '052-000-0001',
      status: 'APPROVED',
      attendees: 3,
      tableId: one,
      sent: 2,
    })
    // Approved 2, no table; sent once.
    await addGuest(owner, base, {
      firstName: 'Noam',
      phone: '052-000-0002',
      status: 'APPROVED',
      attendees: 2,
      sent: 1,
    })
    // Sent, no answer yet: awaiting response.
    await addGuest(owner, base, {
      firstName: 'Lia',
      phone: '052-000-0003',
      sent: 1,
    })
    // Not sure, and declined; neither counts as attendance.
    await addGuest(owner, base, {
      firstName: 'Omer',
      phone: '052-000-0004',
      status: 'NOT_SURE',
    })
    await addGuest(owner, base, {
      firstName: 'Tal',
      phone: '052-000-0005',
      status: 'DECLINED',
    })
    // A deleted guest counts nowhere.
    const gone = await addGuest(owner, base, {
      firstName: 'Gone',
      phone: '052-000-0006',
      status: 'APPROVED',
      attendees: 5,
      sent: 1,
    })
    await owner.delete(`${base}/guests/${gone}`).expect(204)
    // An unknown response is not a guest.
    await t
      .browser()
      .post(`/api/public/rsvp/${event.rsvpSlug}`)
      .send({
        name: 'Walk In',
        phone: '054-999-0001',
        status: 'APPROVED',
        attendees: 2,
      })
      .expect(200)

    const dashboard = await owner.get(`${base}/dashboard`).expect(200)

    expect(dashboard.body.metrics).toEqual({
      totalGuests: 5,
      invitationsSent: 3,
      invitationsNotSent: 2,
      awaitingResponse: 1,
      rsvpApproved: 2,
      rsvpNotSure: 1,
      rsvpDeclined: 1,
      confirmedAttendees: 5,
      seatingCapacity: 10,
      unassignedConfirmedAttendees: 2,
    })
    expect(dashboard.body.warnings).toEqual({
      attendeesOverMaximum: 0,
      // 10 chairs against a maximum of 120.
      seatingVersusMaximum: -110,
      seatsShort: 0,
      tablesOverCapacity: [],
      attendeesAwaitingTable: 2,
    })
    const activity = dashboard.body.recentActivity as {
      kind: string
      guestName: string
      at: string
    }[]
    // 4 RSVPs of active guests + 4 sends to active guests.
    expect(activity).toHaveLength(8)
    expect(activity.every((entry) => entry.guestName !== 'Gone Test')).toBe(
      true,
    )
    expect(activity.map((entry) => entry.at)).toEqual(
      activity
        .map((entry) => entry.at)
        .sort()
        .reverse(),
    )

    // Same figures as the guest list itself.
    const guests = (await owner.get(`${base}/guests`)).body as {
      rsvpStatus: string
      confirmedAttendees: number | null
    }[]
    expect(guests).toHaveLength(dashboard.body.metrics.totalGuests)
    expect(
      guests
        .filter((guest) => guest.rsvpStatus === 'APPROVED')
        .reduce((sum, guest) => sum + (guest.confirmedAttendees ?? 0), 0),
    ).toBe(dashboard.body.metrics.confirmedAttendees)
  })

  it('warns when confirmed attendees exceed the chairs and the event maximum', async () => {
    const { owner, base } = await setUp()
    await owner
      .put(base)
      .send({
        name: 'Garden Party',
        startsAt: '2031-06-01T17:00:00.000Z',
        timeZone: 'Asia/Jerusalem',
        maxAttendees: 50,
        defaultAllowedAttendees: 6,
        rsvpLanguage: 'en',
      })
      .expect(200)
    await addTable(owner, base, 1, 4)
    for (let index = 0; index < 9; index += 1) {
      await addGuest(owner, base, {
        firstName: `G${index}`,
        phone: `052-000-001${index}`,
        status: 'APPROVED',
        attendees: 6,
      })
    }

    const { warnings } = (await owner.get(`${base}/dashboard`).expect(200)).body

    expect(warnings).toMatchObject({
      attendeesOverMaximum: 4,
      seatsShort: 50,
      seatingVersusMaximum: -46,
      attendeesAwaitingTable: 54,
    })
  })

  it('is visible to every member and hidden from anyone else', async () => {
    const { owner, base } = await setUp()
    const outsider = t.browser()
    await signUp(outsider, 'Outsider')

    await owner.get(`${base}/dashboard`).expect(200)
    expect(code(await outsider.get(`${base}/dashboard`).expect(404))).toBe(
      'NOT_FOUND',
    )
    expect(code(await t.browser().get(`${base}/dashboard`).expect(401))).toBe(
      'UNAUTHENTICATED',
    )
  })
})
