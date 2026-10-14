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

function code(response: { body: unknown }): string {
  return (response.body as { code: string }).code
}

async function setUp() {
  const owner = t.browser()
  await signUp(owner, 'Owner')
  const event = await createEvent(owner)
  const base = `/api/events/${event.id}/messages`
  const guest = (
    await owner.post(`/api/events/${event.id}/guests`).send(DANA).expect(201)
  ).body as { id: string }
  return { owner, event, base, guest }
}

async function invite(
  owner: TestAgent,
  eventId: string,
  role: 'VIEWER' | 'ADMIN',
): Promise<TestAgent> {
  const browser = t.browser()
  const { email } = await signUp(browser, role)
  await owner
    .post(`/api/events/${eventId}/permissions/invitations`)
    .send({ email, role })
    .expect(201)
  return browser
}

describe('message template', () => {
  it('starts with the default template, saves an edit and refuses an empty or too long one', async () => {
    const { owner, base } = await setUp()

    const initial = await owner.get(`${base}/template`).expect(200)
    const fallback = await owner.get(`${base}/template/default`).expect(200)
    expect(initial.body.body).toBe(fallback.body.body)
    expect(initial.body.body).toContain('{{first_name}}')

    const saved = await owner
      .put(`${base}/template`)
      .send({ body: 'Hi {{first_name}}, see {{rsvp_url}}' })
      .expect(200)
    expect(saved.body.body).toBe('Hi {{first_name}}, see {{rsvp_url}}')
    expect((await owner.get(`${base}/template`)).body.body).toBe(
      'Hi {{first_name}}, see {{rsvp_url}}',
    )

    expect(
      code(
        await owner.put(`${base}/template`).send({ body: '  ' }).expect(400),
      ),
    ).toBe('VALIDATION')
    expect(
      code(
        await owner
          .put(`${base}/template`)
          .send({ body: 'x'.repeat(1001) })
          .expect(400),
      ),
    ).toBe('VALIDATION')
  })

  it('fills in the variables for a guest and for a made-up one', async () => {
    const { owner, event, base, guest } = await setUp()

    const values = await owner
      .get(`${base}/values?guestId=${guest.id}`)
      .expect(200)
    expect(values.body).toEqual({
      first_name: 'Dana',
      last_name: 'Lev',
      event_name: 'Garden Party',
      // 17:00 UTC is 20:00 in Jerusalem in June.
      event_date: 'Jun 1, 2031',
      event_time: '20:00',
      rsvp_url: `http://localhost:5173/rsvp/${event.rsvpSlug}`,
    })
    const sample = await owner.get(`${base}/values`).expect(200)
    expect(sample.body).toMatchObject({ first_name: 'Dana', last_name: 'Levi' })
  })

  it('previews the saved template for a guest with its WhatsApp link', async () => {
    const { owner, base, guest } = await setUp()
    await owner
      .put(`${base}/template`)
      .send({ body: 'Hi {{first_name}}!' })
      .expect(200)

    const preview = await owner.get(`${base}/preview/${guest.id}`).expect(200)

    expect(preview.body).toEqual({
      message: 'Hi Dana!',
      launchUrl: 'https://wa.me/972521234567?text=Hi%20Dana!',
    })
    expect(
      code(await owner.get(`${base}/preview/not-a-guest`).expect(404)),
    ).toBe('NOT_FOUND')
  })
})

describe('sending', () => {
  it('records each send and adds exactly one to the counter', async () => {
    const { owner, event, base, guest } = await setUp()

    const first = await owner.post(`${base}/sends/${guest.id}`).expect(201)
    expect(first.body.guest).toMatchObject({ invitationSentCount: 1 })
    expect(first.body.launchUrl).toMatch(
      /^https:\/\/wa\.me\/972521234567\?text=/,
    )
    expect(first.body.send).toMatchObject({
      eventId: event.id,
      guestId: guest.id,
    })
    expect(first.body.send.message).toBe(first.body.message)
    const second = await owner.post(`${base}/sends/${guest.id}`).expect(201)
    expect(second.body.guest).toMatchObject({ invitationSentCount: 2 })

    const stored = await t.prisma.guest.findUniqueOrThrow({
      where: { id: guest.id },
    })
    expect(stored.invitationSentCount).toBe(2)
    expect(stored.lastInvitationSentAt?.toISOString()).toBe(
      second.body.send.sentAt,
    )
    expect(await t.prisma.messageSend.count()).toBe(2)
  })

  it('counts concurrent sends one each, without losing any', async () => {
    const { owner, base, guest } = await setUp()

    await Promise.all(
      Array.from({ length: 5 }, () =>
        owner.post(`${base}/sends/${guest.id}`).expect(201),
      ),
    )

    const stored = await t.prisma.guest.findUniqueOrThrow({
      where: { id: guest.id },
    })
    expect(stored.invitationSentCount).toBe(5)
  })

  it('lists sends newest first, keeping sends to a guest deleted since', async () => {
    const { owner, event, base, guest } = await setUp()
    await owner.post(`${base}/sends/${guest.id}`).expect(201)
    await owner.post(`${base}/sends/${guest.id}`).expect(201)
    await owner.delete(`/api/events/${event.id}/guests/${guest.id}`).expect(204)

    const sends = await owner.get(`${base}/sends`).expect(200)

    expect(sends.body).toHaveLength(2)
    expect(sends.body[0].sentAt >= sends.body[1].sentAt).toBe(true)
    expect(sends.body[0]).toMatchObject({
      guestName: 'Dana Lev',
      phone: '052-123-4567',
      guestActive: false,
    })
    expect(
      code(await owner.post(`${base}/sends/${guest.id}`).expect(404)),
    ).toBe('NOT_FOUND')
  })

  it('refuses a send that would be empty', async () => {
    const { owner, base, guest } = await setUp()
    // Saved before the empty-template check existed, or written directly.
    await t.prisma.messageTemplate.updateMany({ data: { body: ' ' } })

    expect(
      code(await owner.post(`${base}/sends/${guest.id}`).expect(400)),
    ).toBe('VALIDATION')
    expect(await t.prisma.messageSend.count()).toBe(0)
  })

  it('lets an Admin send, a Viewer only read, and nobody send on a past event', async () => {
    const { owner, event, base, guest } = await setUp()
    const admin = await invite(owner, event.id, 'ADMIN')
    const viewer = await invite(owner, event.id, 'VIEWER')

    await admin.post(`${base}/sends/${guest.id}`).expect(201)
    expect(
      code(await viewer.post(`${base}/sends/${guest.id}`).expect(403)),
    ).toBe('FORBIDDEN')
    expect(
      code(
        await viewer.put(`${base}/template`).send({ body: 'x' }).expect(403),
      ),
    ).toBe('FORBIDDEN')
    await viewer.get(`${base}/template`).expect(200)
    await viewer.get(`${base}/sends`).expect(200)
    await viewer.get(`${base}/preview/${guest.id}`).expect(200)

    await makePast(t.prisma, event.id)
    expect(
      code(await owner.post(`${base}/sends/${guest.id}`).expect(403)),
    ).toBe('EVENT_READ_ONLY')
    expect(
      code(await owner.put(`${base}/template`).send({ body: 'x' }).expect(403)),
    ).toBe('EVENT_READ_ONLY')
    await owner.get(`${base}/sends`).expect(200)
  })

  it('hides the messages of an event from someone outside it', async () => {
    const { base, guest } = await setUp()
    const outsider = t.browser()
    await signUp(outsider, 'Outsider')

    expect(code(await outsider.get(`${base}/template`).expect(404))).toBe(
      'NOT_FOUND',
    )
    expect(
      code(await outsider.post(`${base}/sends/${guest.id}`).expect(404)),
    ).toBe('NOT_FOUND')
  })
})
