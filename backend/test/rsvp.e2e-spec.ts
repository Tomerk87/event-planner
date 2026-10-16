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

/** A one-pixel PNG. */
const PICTURE =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

const DANA = {
  firstName: 'Dana',
  lastName: 'Lev',
  phone: '052-123-4567',
  allowedAttendees: 4,
}

function code(response: { body: unknown }): string {
  return (response.body as { code: string }).code
}

async function setUp(app: TestApp = t) {
  const owner = app.browser()
  await signUp(owner, 'Owner')
  const event = await createEvent(owner)
  const guest = (
    await owner.post(`/api/events/${event.id}/guests`).send(DANA).expect(201)
  ).body as { id: string }
  return {
    owner,
    event,
    guest,
    settings: `/api/events/${event.id}/rsvp-settings`,
    publicUrl: `/api/public/rsvp/${event.rsvpSlug}`,
  }
}

function answer(
  browser: TestAgent,
  url: string,
  body: Partial<{
    name: string
    phone: string
    status: string
    attendees: number
  }> = {},
) {
  return browser.post(url).send({
    name: 'Dana L.',
    phone: '+972 52-123-4567',
    status: 'APPROVED',
    attendees: 2,
    ...body,
  })
}

describe('RSVP settings', () => {
  it('starts with the defaults and saves the organizer’s texts and actions', async () => {
    const { owner, settings } = await setUp()

    const initial = await owner.get(settings).expect(200)
    expect(initial.body).toMatchObject({
      backgroundImage: null,
      overlayOpacity: 40,
      imageZoom: 100,
      imagePositionX: 50,
      imagePositionY: 50,
      calendar: { enabled: false, title: 'Garden Party', date: '2031-06-01' },
      youtube: { enabled: false, url: '' },
    })

    const changed = {
      ...initial.body,
      eventId: undefined,
      welcomeMessage: 'Join us!',
      calendar: { ...initial.body.calendar, enabled: true, time: '19:30' },
      youtube: { enabled: true, url: 'https://youtu.be/abc' },
    }
    delete changed.eventId
    const saved = await owner.put(settings).send(changed).expect(200)
    expect(saved.body).toMatchObject({
      welcomeMessage: 'Join us!',
      calendar: { enabled: true, time: '19:30' },
      youtube: { enabled: true, url: 'https://youtu.be/abc' },
    })
    expect((await owner.get(settings)).body.welcomeMessage).toBe('Join us!')

    expect(
      code(
        await owner
          .put(settings)
          .send({
            ...changed,
            youtube: { enabled: true, url: 'https://example.com/v' },
          })
          .expect(400),
      ),
    ).toBe('VALIDATION')
    expect(
      code(
        await owner
          .put(settings)
          .send({ ...changed, welcomeMessage: 'x'.repeat(501) })
          .expect(400),
      ),
    ).toBe('VALIDATION')
  })

  it('stores a background picture as a file, keeps it, replaces it and removes it', async () => {
    const { owner, settings } = await setUp()
    const { eventId: _eventId, ...base } = (await owner.get(settings)).body

    const first = await owner
      .put(settings)
      .send({ ...base, backgroundImage: PICTURE })
      .expect(200)
    const firstUrl = first.body.backgroundImage as string
    expect(firstUrl).toMatch(/^\/api\/files\/[0-9a-f-]+\.png$/)
    const served = await t.browser().get(firstUrl).expect(200)
    expect(served.headers['content-type']).toBe('image/png')

    // Kept, with its zoom and position, when its own address comes back.
    const framing = { imageZoom: 180, imagePositionX: 20, imagePositionY: 75 }
    const kept = await owner
      .put(settings)
      .send({
        ...base,
        backgroundImage: firstUrl,
        overlayOpacity: 10,
        ...framing,
      })
      .expect(200)
    expect(kept.body).toMatchObject({ backgroundImage: firstUrl, ...framing })
    expect((await owner.get(settings)).body).toMatchObject(framing)
    expect(
      code(
        await owner
          .put(settings)
          .send({ ...base, backgroundImage: firstUrl, imageZoom: 301 })
          .expect(400),
      ),
    ).toBe('VALIDATION')

    const replaced = await owner
      .put(settings)
      .send({ ...base, backgroundImage: PICTURE })
      .expect(200)
    expect(replaced.body.backgroundImage).not.toBe(firstUrl)
    await t.browser().get(firstUrl).expect(404)

    const removed = await owner
      .put(settings)
      .send({ ...base, backgroundImage: null })
      .expect(200)
    expect(removed.body.backgroundImage).toBeNull()
    await t.browser().get(replaced.body.backgroundImage).expect(404)

    expect(
      code(
        await owner
          .put(settings)
          .send({ ...base, backgroundImage: '/api/files/someone-else.png' })
          .expect(400),
      ),
    ).toBe('VALIDATION')
  })

  it('accepts a picture of realistic size and refuses an oversized request', async () => {
    const { owner, settings } = await setUp()
    const { eventId: _eventId, ...base } = (await owner.get(settings)).body
    // About 500 KB of picture, as the browser sends after shrinking it.
    const large = `data:image/jpeg;base64,${'A'.repeat(690_000)}`

    const saved = await owner
      .put(settings)
      .send({ ...base, backgroundImage: large })
      .expect(200)
    expect(saved.body.backgroundImage).toMatch(/^\/api\/files\//)

    const tooLarge = await owner
      .put(settings)
      .send({ ...base, welcomeMessage: 'x'.repeat(6 * 1024 * 1024) })
      .expect(413)
    expect(tooLarge.body).toEqual({ code: 'VALIDATION', details: {} })
  })

  it('is read-only for a Viewer and on a past event', async () => {
    const { owner, event, settings } = await setUp()
    const viewer = t.browser()
    const { email } = await signUp(viewer, 'Viewer')
    await owner
      .post(`/api/events/${event.id}/permissions/invitations`)
      .send({ email, role: 'VIEWER' })
      .expect(201)
    const { eventId: _eventId, ...body } = (await owner.get(settings)).body

    await viewer.get(settings).expect(200)
    expect(code(await viewer.put(settings).send(body).expect(403))).toBe(
      'FORBIDDEN',
    )
    await makePast(t.prisma, event.id)
    expect(code(await owner.put(settings).send(body).expect(403))).toBe(
      'EVENT_READ_ONLY',
    )
  })
})

describe('public RSVP page', () => {
  it('shows the event and its texts without any guest data, to anyone', async () => {
    const { owner, event, settings, publicUrl } = await setUp()
    await owner
      .put(`/api/events/${event.id}`)
      .send({
        name: 'Garden Party',
        startsAt: '2031-06-01T17:00:00.000Z',
        timeZone: 'Asia/Jerusalem',
        maxAttendees: 120,
        defaultAllowedAttendees: 4,
        rsvpLanguage: 'he',
        country: 'IL',
        rsvpTitle: 'Our Garden Party',
        location: 'Tel Aviv',
      })
      .expect(200)

    const view = await t.browser().get(publicUrl).expect(200)

    expect(view.body).toEqual({
      title: 'Our Garden Party',
      startsAt: '2031-06-01T17:00:00.000Z',
      timeZone: 'Asia/Jerusalem',
      location: 'Tel Aviv',
      language: 'he',
      country: 'IL',
      isClosed: false,
      maxSelectableAttendees: 10,
      settings: expect.any(Object),
    })
    const { eventId: _eventId, ...organizerSettings } = (
      await owner.get(settings)
    ).body
    expect(view.body.settings).toEqual(organizerSettings)
    expect(JSON.stringify(view.body)).not.toContain('Dana')
    expect(JSON.stringify(view.body)).not.toContain('4567')
  })

  it('answers not found for an unknown link', async () => {
    expect(
      code(await t.browser().get('/api/public/rsvp/no-such-link').expect(404)),
    ).toBe('NOT_FOUND')
    expect(
      code(
        await answer(t.browser(), '/api/public/rsvp/no-such-link').expect(404),
      ),
    ).toBe('NOT_FOUND')
  })

  it('updates a known guest matched by phone, keeping the organizer’s names', async () => {
    const { guest, publicUrl } = await setUp()

    const result = await answer(t.browser(), publicUrl).expect(200)

    expect(result.body).toEqual({ status: 'APPROVED', confirmedAttendees: 2 })
    const stored = await t.prisma.guest.findUniqueOrThrow({
      where: { id: guest.id },
    })
    expect(stored).toMatchObject({
      firstName: 'Dana',
      lastName: 'Lev',
      invitationName: 'Dana L.',
      rsvpStatus: 'APPROVED',
      confirmedAttendees: 2,
    })
    expect(stored.lastRsvpResponseAt).not.toBeNull()
    expect(await t.prisma.unknownRsvp.count()).toBe(0)
  })

  it('keeps an unmatched phone as one unknown response, updated by a later answer', async () => {
    const { event, publicUrl } = await setUp()
    const other = { name: 'Walk In', phone: '054 999 0001' }

    await answer(t.browser(), publicUrl, { ...other, attendees: 3 }).expect(200)
    const [first] = await t.prisma.unknownRsvp.findMany()
    await t.prisma.unknownRsvp.update({
      where: { id: first!.id },
      data: { rejectedAt: new Date() },
    })
    await answer(t.browser(), publicUrl, {
      ...other,
      status: 'NOT_SURE',
    }).expect(200)

    const stored = await t.prisma.unknownRsvp.findMany()
    expect(stored).toHaveLength(1)
    expect(stored[0]).toMatchObject({
      id: first!.id,
      eventId: event.id,
      name: 'Walk In',
      phone: '054-999-0001',
      normalizedPhone: '+972549990001',
      rsvpStatus: 'NOT_SURE',
      confirmedAttendees: null,
      // A new answer from a rejected phone is back for review.
      rejectedAt: null,
    })
  })

  it('answers a known and an unknown phone in exactly the same way', async () => {
    const { publicUrl } = await setUp()

    for (const status of ['APPROVED', 'DECLINED', 'NOT_SURE']) {
      const known = await answer(t.browser(), publicUrl, { status })
      const unknown = await answer(t.browser(), publicUrl, {
        status,
        phone: '054-999-0001',
      })
      expect([unknown.status, unknown.body]).toEqual([known.status, known.body])
    }
  })

  it('checks the attendee count: the guest’s allowance, or the event default for an unknown phone', async () => {
    const { owner, event, guest, publicUrl } = await setUp()
    await owner
      .put(`/api/events/${event.id}/guests/${guest.id}`)
      .send({ ...DANA, allowedAttendees: 2 })
      .expect(200)

    const tooMany = await answer(t.browser(), publicUrl, {
      attendees: 3,
    }).expect(400)
    expect(tooMany.body).toEqual({
      code: 'INVALID_ATTENDEE_COUNT',
      details: { min: 1, max: 2 },
    })
    // The event default is 4.
    await answer(t.browser(), publicUrl, {
      phone: '054-999-0001',
      attendees: 4,
    }).expect(200)
    expect(
      code(
        await answer(t.browser(), publicUrl, {
          phone: '054-999-0001',
          attendees: 5,
        }).expect(400),
      ),
    ).toBe('INVALID_ATTENDEE_COUNT')
    expect(
      code(await answer(t.browser(), publicUrl, { attendees: 0 }).expect(400)),
    ).toBe('INVALID_ATTENDEE_COUNT')
    // Required even for Declined, then discarded.
    const declined = await answer(t.browser(), publicUrl, {
      status: 'DECLINED',
      attendees: 2,
    }).expect(200)
    expect(declined.body).toEqual({ status: 'DECLINED', confirmedAttendees: 0 })
  })

  it('refuses a missing name, a bad phone or an unknown response', async () => {
    const { publicUrl } = await setUp()

    expect(
      code(await answer(t.browser(), publicUrl, { name: '  ' }).expect(400)),
    ).toBe('VALIDATION')
    expect(
      code(await answer(t.browser(), publicUrl, { phone: 'abc' }).expect(400)),
    ).toBe('INVALID_PHONE')
    expect(
      code(
        await answer(t.browser(), publicUrl, { status: 'NO_RESPONSE' }).expect(
          400,
        ),
      ),
    ).toBe('VALIDATION')
    expect(
      code(await t.browser().post(publicUrl).send({ name: 'x' }).expect(400)),
    ).toBe('VALIDATION')
  })

  it('frees the seat when a seated guest declines, and keeps a larger party seated as a conflict', async () => {
    const { owner, event, guest, publicUrl } = await setUp()
    const base = `/api/events/${event.id}`
    const table = (
      await owner
        .post(`${base}/tables`)
        .send({ number: 1, capacity: 2, shape: 'CIRCLE' })
        .expect(201)
    ).body as { id: string }
    await owner
      .put(`${base}/guests/${guest.id}/rsvp`)
      .send({ status: 'APPROVED', attendees: 2 })
      .expect(200)
    await owner
      .put(`${base}/guests/${guest.id}/table`)
      .send({ tableId: table.id })
      .expect(200)

    await answer(t.browser(), publicUrl, { attendees: 4 }).expect(200)
    const over = await owner.get(`${base}/dashboard`).expect(200)
    expect(over.body.warnings.tablesOverCapacity).toEqual([
      { tableId: table.id, tableNumber: 1, over: 2 },
    ])
    const tables = await owner.get(`${base}/tables`).expect(200)
    expect(tables.body[0]).toMatchObject({ assigned: 4, available: -2 })

    await answer(t.browser(), publicUrl, { status: 'DECLINED' }).expect(200)
    const stored = await t.prisma.guest.findUniqueOrThrow({
      where: { id: guest.id },
    })
    expect(stored).toMatchObject({
      rsvpStatus: 'DECLINED',
      confirmedAttendees: 0,
      tableId: null,
    })
  })

  it('treats a deleted guest’s phone as unknown', async () => {
    const { owner, event, guest, publicUrl } = await setUp()
    await owner.delete(`/api/events/${event.id}/guests/${guest.id}`).expect(204)

    await answer(t.browser(), publicUrl).expect(200)

    expect(await t.prisma.unknownRsvp.count()).toBe(1)
    const stored = await t.prisma.guest.findUniqueOrThrow({
      where: { id: guest.id },
    })
    expect(stored.rsvpStatus).toBe('NO_RESPONSE')
  })

  it('closes once the event has started', async () => {
    const { event, guest, publicUrl } = await setUp()
    await makePast(t.prisma, event.id)

    const view = await t.browser().get(publicUrl).expect(200)
    expect(view.body.isClosed).toBe(true)
    expect(code(await answer(t.browser(), publicUrl).expect(409))).toBe(
      'RSVP_CLOSED',
    )
    const stored = await t.prisma.guest.findUniqueOrThrow({
      where: { id: guest.id },
    })
    expect(stored.rsvpStatus).toBe('NO_RESPONSE')
  })
})

describe('public RSVP limits (D2)', () => {
  it('refuses more answers from one address than the limit, for any phone', async () => {
    const limited = await createTestApp({
      rsvpLimits: { perIp: 3, perPhone: 100, windowMinutes: 10 },
    })
    try {
      await resetDatabase(limited.prisma)
      const { publicUrl } = await setUp(limited)
      const guestBrowser = limited.browser()

      for (let index = 0; index < 3; index += 1) {
        await answer(guestBrowser, publicUrl, {
          phone: `054-999-000${index}`,
        }).expect(200)
      }
      const refused = await answer(guestBrowser, publicUrl, {
        phone: '054-999-0009',
      }).expect(429)

      expect(refused.body).toEqual({ code: 'TOO_MANY_REQUESTS', details: {} })
      expect(await limited.prisma.unknownRsvp.count()).toBe(3)
      // Reading the page is not limited.
      await guestBrowser.get(publicUrl).expect(200)
    } finally {
      await limited.close()
    }
  })

  it('counts addresses separately behind a trusted proxy', async () => {
    const limited = await createTestApp({
      rsvpLimits: { perIp: 1, perPhone: 100, windowMinutes: 10 },
      trustProxyHops: 1,
    })
    try {
      await resetDatabase(limited.prisma)
      const { publicUrl } = await setUp(limited)
      const from = (ip: string, phone: string) =>
        answer(limited.browser(), publicUrl, { phone }).set(
          'X-Forwarded-For',
          ip,
        )

      await from('203.0.113.1', '054-999-0001').expect(200)
      await from('203.0.113.2', '054-999-0002').expect(200)
      await from('203.0.113.1', '054-999-0003').expect(429)
    } finally {
      await limited.close()
    }
  })

  it('refuses more accepted answers for one phone than the limit, but not failed ones', async () => {
    const limited = await createTestApp({
      rsvpLimits: { perIp: 100, perPhone: 3, windowMinutes: 10 },
    })
    try {
      await resetDatabase(limited.prisma)
      const { publicUrl } = await setUp(limited)
      const guestBrowser = limited.browser()

      // A mistake does not use up the guest's answers.
      await answer(guestBrowser, publicUrl, { attendees: 9 }).expect(400)
      for (const attendees of [1, 2, 3]) {
        await answer(guestBrowser, publicUrl, { attendees }).expect(200)
      }
      // The same phone written differently is the same phone.
      const refused = await answer(guestBrowser, publicUrl, {
        phone: '0521234567',
        attendees: 4,
      }).expect(429)
      expect(code(refused)).toBe('TOO_MANY_REQUESTS')
      const stored = await limited.prisma.guest.findFirstOrThrow()
      expect(stored.confirmedAttendees).toBe(3)

      // Another phone is not affected.
      await answer(guestBrowser, publicUrl, { phone: '054-999-0001' }).expect(
        200,
      )
    } finally {
      await limited.close()
    }
  })
})
