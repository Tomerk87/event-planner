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

const DANA = {
  firstName: 'Dana',
  lastName: 'Lev',
  phone: '052-123-4567',
  allowedAttendees: 4,
}

async function setUp() {
  const owner = t.browser()
  await signUp(owner, 'Owner')
  const event = await createEvent(owner)
  const base = `/api/events/${event.id}/guests`
  return { owner, event, base }
}

async function add(
  owner: TestAgent,
  base: string,
  guest: Record<string, unknown> = DANA,
) {
  const response = await owner.post(base).send(guest).expect(201)
  return response.body as { id: string; normalizedPhone: string }
}

function code(response: { body: unknown }): string {
  return (response.body as { code: string }).code
}

describe('guests', () => {
  it('adds a guest with a normalized phone and refuses the same phone written differently', async () => {
    const { owner, base } = await setUp()

    const guest = await add(owner, base)

    expect(guest).toMatchObject({
      normalizedPhone: '+972521234567',
      rsvpStatus: 'NO_RESPONSE',
      invitationSentCount: 0,
    })
    expect(
      code(
        await owner
          .post(base)
          .send({ ...DANA, phone: '+972 52 123 4567' })
          .expect(409),
      ),
    ).toBe('DUPLICATE_PHONE')
    expect(
      code(
        await owner
          .post(base)
          .send({ ...DANA, phone: 'abc' })
          .expect(400),
      ),
    ).toBe('INVALID_PHONE')
    expect(
      code(
        await owner
          .post(base)
          .send({ ...DANA, phone: '053-000-0001', allowedAttendees: 11 })
          .expect(400),
      ),
    ).toBe('VALIDATION')
  })

  it('soft-deletes, and restores the record when the same phone is added again', async () => {
    const { owner, base } = await setUp()
    const guest = await add(owner, base)
    await owner
      .put(`${base}/${guest.id}/rsvp`)
      .send({ status: 'APPROVED', attendees: 2 })
      .expect(200)

    await owner.delete(`${base}/${guest.id}`).expect(204)

    expect((await owner.get(base).expect(200)).body).toEqual([])
    const stored = await t.prisma.guest.findUniqueOrThrow({
      where: { id: guest.id },
    })
    expect(stored.deleted).toBe(true)

    const restored = await add(owner, base, {
      ...DANA,
      firstName: 'Danielle',
      phone: '+972521234567',
    })
    expect(restored).toMatchObject({
      id: guest.id,
      firstName: 'Danielle',
      rsvpStatus: 'NO_RESPONSE',
      deleted: false,
    })
    expect(await t.prisma.guest.count()).toBe(1)
  })

  it('keeps RSVP counts within the allowance and cannot lower it below a confirmed count', async () => {
    const { owner, base } = await setUp()
    const guest = await add(owner, base)

    expect(
      code(
        await owner
          .put(`${base}/${guest.id}/rsvp`)
          .send({ status: 'APPROVED', attendees: 5 })
          .expect(400),
      ),
    ).toBe('INVALID_ATTENDEE_COUNT')
    await owner
      .put(`${base}/${guest.id}/rsvp`)
      .send({ status: 'APPROVED', attendees: 3 })
      .expect(200)
    expect(
      code(
        await owner
          .put(`${base}/${guest.id}`)
          .send({ ...DANA, allowedAttendees: 2 })
          .expect(400),
      ),
    ).toBe('INVALID_ATTENDEE_COUNT')
    const declined = await owner
      .put(`${base}/${guest.id}/rsvp`)
      .send({ status: 'DECLINED', attendees: null })
      .expect(200)
    expect(declined.body).toMatchObject({
      rsvpStatus: 'DECLINED',
      confirmedAttendees: 0,
    })
  })

  it('seats Approved guests only, within capacity, and frees the seat when the RSVP changes', async () => {
    const { owner, event, base } = await setUp()
    const table = await t.prisma.eventTable.create({
      data: { eventId: event.id, number: 1, capacity: 4, shape: 'CIRCLE' },
    })
    const dana = await add(owner, base)
    const noam = await add(owner, base, {
      ...DANA,
      firstName: 'Noam',
      phone: '053-000-0002',
    })

    expect(
      code(
        await owner
          .put(`${base}/${dana.id}/table`)
          .send({ tableId: table.id })
          .expect(409),
      ),
    ).toBe('GUEST_NOT_APPROVED')
    await owner
      .put(`${base}/${dana.id}/rsvp`)
      .send({ status: 'APPROVED', attendees: 3 })
      .expect(200)
    await owner
      .put(`${base}/${noam.id}/rsvp`)
      .send({ status: 'APPROVED', attendees: 2 })
      .expect(200)
    await owner
      .put(`${base}/${dana.id}/table`)
      .send({ tableId: table.id })
      .expect(200)
    const full = await owner
      .put(`${base}/${noam.id}/table`)
      .send({ tableId: table.id })
      .expect(409)
    expect(full.body).toEqual({
      code: 'TABLE_FULL',
      details: { capacity: 4, available: 1, needed: 2 },
    })

    const notSure = await owner
      .put(`${base}/${dana.id}/rsvp`)
      .send({ status: 'NOT_SURE', attendees: null })
      .expect(200)
    expect(notSure.body).toMatchObject({
      tableId: null,
      confirmedAttendees: null,
    })
  })

  it('refuses a table of another event', async () => {
    const { owner, base } = await setUp()
    const other = await createEvent(owner, { name: 'Other' })
    const foreign = await t.prisma.eventTable.create({
      data: { eventId: other.id, number: 1, capacity: 9, shape: 'CIRCLE' },
    })
    const dana = await add(owner, base)
    await owner
      .put(`${base}/${dana.id}/rsvp`)
      .send({ status: 'APPROVED', attendees: 1 })

    expect(
      code(
        await owner
          .put(`${base}/${dana.id}/table`)
          .send({ tableId: foreign.id })
          .expect(404),
      ),
    ).toBe('NOT_FOUND')
  })

  it('sets a group for several guests, joining an existing spelling, and deletes several at once', async () => {
    const { owner, base } = await setUp()
    const dana = await add(owner, base, { ...DANA, group: 'Family' })
    const noam = await add(owner, base, {
      ...DANA,
      firstName: 'Noam',
      phone: '053-000-0002',
    })

    await owner
      .post(`${base}/group`)
      .send({ guestIds: [noam.id], group: ' family ' })
      .expect(204)
    expect(
      (await t.prisma.guest.findUniqueOrThrow({ where: { id: noam.id } }))
        .group,
    ).toBe('Family')

    // One unknown id: nothing is deleted.
    await owner
      .post(`${base}/delete`)
      .send({ guestIds: [dana.id, '00000000-0000-4000-8000-000000000000'] })
      .expect(404)
    expect((await owner.get(base)).body).toHaveLength(2)
    await owner
      .post(`${base}/delete`)
      .send({ guestIds: [dana.id, noam.id] })
      .expect(204)
    expect((await owner.get(base)).body).toHaveLength(0)
  })

  it('searches, filters, sorts and pages on the server', async () => {
    const { owner, base } = await setUp()
    for (let index = 1; index <= 12; index += 1) {
      await add(owner, base, {
        firstName: `Guest${String(index).padStart(2, '0')}`,
        lastName: 'Test',
        phone: `053-000-${String(index).padStart(4, '0')}`,
        allowedAttendees: 2,
        group: index % 2 ? 'Odd' : null,
      })
    }

    const page = await owner
      .get(`${base}/search?group=Odd&sort=-name&size=5&page=1`)
      .expect(200)

    expect(page.body).toMatchObject({
      total: 6,
      pageCount: 2,
      page: 1,
      from: 1,
      to: 5,
    })
    expect((page.body.items as { firstName: string }[])[0]!.firstName).toBe(
      'Guest11',
    )
    const found = await owner.get(`${base}/search?q=guest07`).expect(200)
    expect(found.body.total).toBe(1)
  })

  it('reads an uploaded CSV and imports the chosen rows, all or none', async () => {
    const { owner, base } = await setUp()
    const csv =
      'First Name,Last Name,Phone,Expected Attendees\nDana,Lev,052-123-4567,3\nNoam,Bar,0530000002,2\n'

    const read = await owner
      .post(`${base}/import/read`)
      .attach('file', Buffer.from(csv), 'guests.csv')
      .expect(200)
    expect(read.body.rows).toEqual([
      ['First Name', 'Last Name', 'Phone', 'Expected Attendees'],
      ['Dana', 'Lev', '052-123-4567', '3'],
      ['Noam', 'Bar', '0530000002', '2'],
    ])
    expect(await t.prisma.guest.count()).toBe(0)

    const bad = await owner
      .post(`${base}/import`)
      .send({ guests: [DANA, { ...DANA, firstName: 'Bad', phone: 'nope' }] })
      .expect(400)
    expect(code(bad)).toBe('INVALID_PHONE')
    expect(await t.prisma.guest.count()).toBe(0)

    const done = await owner
      .post(`${base}/import`)
      .send({
        guests: [
          DANA,
          {
            ...DANA,
            firstName: 'Noam',
            phone: '0530000002',
            allowedAttendees: 2,
          },
        ],
      })
      .expect(201)
    expect(done.body).toEqual({ created: 2, restored: 0 })
  })

  it('refuses a file that is not a spreadsheet, or too large', async () => {
    const { owner, base } = await setUp()

    const wrong = await owner
      .post(`${base}/import/read`)
      .attach('file', Buffer.from('x'), 'notes.txt')
      .expect(400)
    expect(wrong.body).toEqual({
      code: 'VALIDATION',
      details: { field: 'fileType' },
    })
    await owner
      .post(`${base}/import/read`)
      .attach('file', Buffer.alloc(5 * 1024 * 1024 + 1), 'big.csv')
      .expect(413)
    const broken = await owner
      .post(`${base}/import/read`)
      .attach('file', Buffer.from('not a zip'), 'broken.xlsx')
      .expect(400)
    expect(broken.body).toEqual({
      code: 'VALIDATION',
      details: { field: 'fileContent' },
    })
  })

  it('exports every field as CSV or Excel, with formulas made harmless, for a Viewer too', async () => {
    const { owner, event, base } = await setUp()
    await add(owner, base, { ...DANA, firstName: '=SUM(A1)' })
    const viewer = t.browser()
    const { email } = await signUp(viewer, 'Viewer')
    await owner
      .post(`/api/events/${event.id}/permissions/invitations`)
      .send({ email, role: 'VIEWER' })
    const labels = {
      headings: {
        firstName: 'First Name',
        lastName: 'Last Name',
        invitationName: 'Invitation Name',
        phone: 'Phone',
        allowedAttendees: 'Expected Attendees',
        confirmedAttendees: 'Confirmed',
        status: 'Status',
        invitationSentCount: 'Invitations Sent',
        tableNumber: 'Table',
        group: 'Group',
      },
      statuses: {
        NOT_SENT: 'Not Sent',
        AWAITING_RESPONSE: 'Awaiting Response',
        APPROVED: 'Approved',
        NOT_SURE: 'Not Sure',
        DECLINED: 'Declined',
      },
    }

    const csv = await viewer
      .post(`${base}/export`)
      .send({ format: 'csv', labels, sheetName: 'Guests', rightToLeft: false })
      .expect(200)
    expect(csv.headers['content-type']).toMatch(/^text\/csv/)
    expect(csv.text.split(/\r?\n/)[0]).toContain('First Name,Last Name')
    expect(csv.text).toContain("'=SUM(A1)")
    expect(csv.text).toContain('Not Sent')

    const xlsx = await viewer
      .post(`${base}/export`)
      .send({ format: 'xlsx', labels, sheetName: 'Guests', rightToLeft: true })
      .buffer(true)
      .parse((response, done) => {
        const chunks: Buffer[] = []
        response.on('data', (chunk: Buffer) => chunks.push(chunk))
        response.on('end', () => done(null, Buffer.concat(chunks)))
      })
      .expect(200)
    const rows = await readSheet(xlsx.body as Buffer)
    expect(rows[1]?.[0]).toBe('=SUM(A1)')
    expect(rows[0]?.[0]).toBe('First Name')
  })

  it('keeps guests read-only for a Viewer and on a past event, with viewing and export still allowed', async () => {
    const { owner, event, base } = await setUp()
    const guest = await add(owner, base)
    const viewer = t.browser()
    const { email } = await signUp(viewer, 'Viewer')
    await owner
      .post(`/api/events/${event.id}/permissions/invitations`)
      .send({ email, role: 'VIEWER' })

    expect(
      code(
        await viewer
          .post(base)
          .send({ ...DANA, phone: '053-000-0009' })
          .expect(403),
      ),
    ).toBe('FORBIDDEN')
    expect(
      code(
        await viewer
          .post(`${base}/import/read`)
          .attach('file', Buffer.from('a'), 'a.csv')
          .expect(403),
      ),
    ).toBe('FORBIDDEN')
    await viewer.get(base).expect(200)

    await makePast(t.prisma, event.id)
    expect(
      code(await owner.put(`${base}/${guest.id}`).send(DANA).expect(403)),
    ).toBe('EVENT_READ_ONLY')
    await owner.get(base).expect(200)
  })
})

describe('unknown guests', () => {
  async function unknownResponse(
    eventId: string,
    patch: Record<string, unknown> = {},
  ) {
    return t.prisma.unknownRsvp.create({
      data: {
        eventId,
        name: 'Walk In',
        phone: '054-999-0001',
        normalizedPhone: '+972549990001',
        rsvpStatus: 'APPROVED',
        confirmedAttendees: 2,
        submittedAt: new Date('2030-01-01T10:00:00Z'),
        ...patch,
      },
    })
  }

  it('converts a response into a guest with the response applied', async () => {
    const { owner, event } = await setUp()
    const unknown = await unknownResponse(event.id)
    const base = `/api/events/${event.id}/unknown-guests`

    expect((await owner.get(base).expect(200)).body).toHaveLength(1)
    const guest = await owner
      .post(`${base}/${unknown.id}/convert`)
      .send({ firstName: 'Walk', lastName: 'In', allowedAttendees: 3 })
      .expect(201)

    expect(guest.body).toMatchObject({
      phone: '054-999-0001',
      rsvpStatus: 'APPROVED',
      confirmedAttendees: 2,
      invitationName: 'Walk In',
    })
    expect(await t.prisma.unknownRsvp.count()).toBe(0)
  })

  it('refuses to convert a response above the allowance, and merges into an existing guest', async () => {
    const { owner, event } = await setUp()
    const unknown = await unknownResponse(event.id, { confirmedAttendees: 3 })
    const base = `/api/events/${event.id}/unknown-guests`
    const guest = await add(owner, `/api/events/${event.id}/guests`, {
      ...DANA,
      allowedAttendees: 2,
    })

    const tooMany = await owner
      .post(`${base}/${unknown.id}/convert`)
      .send({ firstName: 'Walk', lastName: 'In', allowedAttendees: 2 })
      .expect(400)
    expect(code(tooMany)).toBe('INVALID_ATTENDEE_COUNT')
    expect(
      code(
        await owner
          .post(`${base}/${unknown.id}/merge`)
          .send({ guestId: guest.id })
          .expect(400),
      ),
    ).toBe('INVALID_ATTENDEE_COUNT')
    await owner
      .put(`/api/events/${event.id}/guests/${guest.id}`)
      .send({ ...DANA, allowedAttendees: 3 })
      .expect(200)
    const merged = await owner
      .post(`${base}/${unknown.id}/merge`)
      .send({ guestId: guest.id })
      .expect(201)
    expect(merged.body).toMatchObject({
      id: guest.id,
      confirmedAttendees: 3,
      invitationName: 'Walk In',
    })
  })

  it('rejects a response into a separate list and restores it', async () => {
    const { owner, event } = await setUp()
    const unknown = await unknownResponse(event.id)
    const base = `/api/events/${event.id}/unknown-guests`

    await owner.post(`${base}/${unknown.id}/reject`).expect(204)
    expect((await owner.get(base)).body).toEqual([])
    expect((await owner.get(`${base}/rejected`)).body).toHaveLength(1)
    expect(
      code(await owner.post(`${base}/${unknown.id}/reject`).expect(404)),
    ).toBe('NOT_FOUND')

    await owner.post(`${base}/${unknown.id}/restore`).expect(200)
    expect((await owner.get(base)).body).toHaveLength(1)
  })
})

describe('database checks', () => {
  it('refuses rows that break the RSVP and seating rules, even written directly', async () => {
    const { owner, event, base } = await setUp()
    const guest = await add(owner, base)
    const update = (data: Record<string, unknown>) =>
      t.prisma.guest.update({ where: { id: guest.id }, data })

    await expect(
      update({ rsvpStatus: 'APPROVED', confirmedAttendees: 9 }),
    ).rejects.toThrow()
    await expect(
      update({ rsvpStatus: 'DECLINED', confirmedAttendees: 2 }),
    ).rejects.toThrow()
    await expect(update({ invitationSentCount: -1 })).rejects.toThrow()
    const table = await t.prisma.eventTable.create({
      data: { eventId: event.id, number: 1, capacity: 4, shape: 'CIRCLE' },
    })
    await expect(update({ tableId: table.id })).rejects.toThrow()
    await expect(
      t.prisma.eventTable.create({
        data: { eventId: event.id, number: 1, capacity: 4, shape: 'CIRCLE' },
      }),
    ).rejects.toThrow()
    await expect(
      t.prisma.event.update({
        where: { id: event.id },
        data: { maxAttendees: 10 },
      }),
    ).rejects.toThrow()
  })
})
