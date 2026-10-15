import type TestAgent from 'supertest/lib/agent.js'
import {
  createEvent,
  createTestApp,
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

interface Listed {
  items: {
    id: string
    kind: string
    eventId: string | null
    eventName: string
    actorName: string | null
    role: string | null
    read: boolean
  }[]
  unread: number
}

async function notices(browser: TestAgent): Promise<Listed> {
  return (await browser.get('/api/notifications').expect(200)).body as Listed
}

const invite = (
  browser: TestAgent,
  eventId: string,
  email: string,
  role: string,
) =>
  browser
    .post(`/api/events/${eventId}/permissions/invitations`)
    .send({ email, role })
    .expect(201)

describe('notifications (D95)', () => {
  it('tells an account it was given access, its role changed and it was removed', async () => {
    const owner = t.browser()
    await signUp(owner, 'Olive Owner')
    const event = await createEvent(owner, { name: 'Garden Party' })
    const member = t.browser()
    const dana = await signUp(member, 'Dana Lev')
    expect(await notices(member)).toEqual({ items: [], unread: 0 })

    await invite(owner, event.id, dana.email, 'VIEWER')
    await owner
      .put(`/api/events/${event.id}/permissions/members/${dana.id}`)
      .send({ role: 'ADMIN' })
      .expect(200)
    await owner
      .delete(`/api/events/${event.id}/permissions/members/${dana.id}`)
      .expect(204)

    const listed = await notices(member)
    expect(listed.unread).toBe(3)
    // Newest first.
    expect(listed.items).toMatchObject([
      {
        kind: 'ACCESS_REMOVED',
        eventId: event.id,
        eventName: 'Garden Party',
        actorName: 'Olive Owner',
        read: false,
      },
      { kind: 'ROLE_CHANGED', role: 'ADMIN', actorName: 'Olive Owner' },
      { kind: 'ACCESS_GRANTED', role: 'VIEWER', actorName: 'Olive Owner' },
    ])
    // Nobody else hears of it, and the person acting gets nothing.
    expect((await notices(owner)).items).toEqual([])
  })

  it('tells an account when an invitation becomes access at sign-up', async () => {
    const owner = t.browser()
    await signUp(owner, 'Olive Owner')
    const event = await createEvent(owner, { name: 'Board Meeting' })
    await invite(owner, event.id, 'new@example.com', 'ADMIN')

    const newcomer = t.browser()
    await signUp(newcomer, 'New Person', 'new@example.com')

    expect((await notices(newcomer)).items).toMatchObject([
      {
        kind: 'ACCESS_GRANTED',
        eventId: event.id,
        eventName: 'Board Meeting',
        actorName: null,
        role: 'ADMIN',
      },
    ])
  })

  it('tells Owners and Admins, once until read, that unknown answers wait for review', async () => {
    const owner = t.browser()
    await signUp(owner, 'Olive Owner')
    const event = await createEvent(owner)
    const admin = t.browser()
    const ada = await signUp(admin, 'Ada Admin')
    const viewer = t.browser()
    const vera = await signUp(viewer, 'Vera Viewer')
    await invite(owner, event.id, ada.email, 'ADMIN')
    await invite(owner, event.id, vera.email, 'VIEWER')
    await admin.post('/api/notifications/read').send({}).expect(204)
    await viewer.post('/api/notifications/read').send({}).expect(204)

    const answer = (phone: string) =>
      t
        .browser()
        .post(`/api/public/rsvp/${event.rsvpSlug}`)
        .send({ name: 'Stranger', phone, status: 'APPROVED', attendees: 2 })
        .expect(200)
    await answer('0541111111')
    await answer('0542222222')

    for (const manager of [owner, admin]) {
      const listed = await notices(manager)
      expect(
        listed.items.filter((n) => n.kind === 'UNKNOWN_RSVP'),
      ).toHaveLength(1)
      expect(listed.items[0]).toMatchObject({
        kind: 'UNKNOWN_RSVP',
        eventId: event.id,
        read: false,
      })
    }
    expect((await notices(viewer)).unread).toBe(0)

    // Once read, a later answer is news again.
    await owner.post('/api/notifications/read').send({}).expect(204)
    await answer('0543333333')
    const later = await notices(owner)
    expect(later.unread).toBe(1)
    expect(later.items.filter((n) => n.kind === 'UNKNOWN_RSVP')).toHaveLength(2)
  })

  it('marks one notice or all of them read, only the account’s own', async () => {
    const owner = t.browser()
    await signUp(owner, 'Olive Owner')
    const first = await createEvent(owner, { name: 'First' })
    const second = await createEvent(owner, { name: 'Second' })
    const member = t.browser()
    const dana = await signUp(member, 'Dana Lev')
    await invite(owner, first.id, dana.email, 'VIEWER')
    await invite(owner, second.id, dana.email, 'VIEWER')

    const [newest] = (await notices(member)).items
    await member
      .post('/api/notifications/read')
      .send({ id: newest!.id })
      .expect(204)
    expect((await notices(member)).unread).toBe(1)
    // Another account's notice is not found.
    await owner
      .post('/api/notifications/read')
      .send({ id: newest!.id })
      .expect(404)
    await owner
      .post('/api/notifications/read')
      .send({ id: 'not-an-id' })
      .expect(404)

    await member.post('/api/notifications/read').send({}).expect(204)
    expect((await notices(member)).unread).toBe(0)
    await t.browser().get('/api/notifications').expect(401)
  })

  it('keeps a notice readable after its event is deleted, and drops it after 90 days', async () => {
    const owner = t.browser()
    await signUp(owner, 'Olive Owner')
    const event = await createEvent(owner, { name: 'Gone Soon' })
    const member = t.browser()
    const dana = await signUp(member, 'Dana Lev')
    await invite(owner, event.id, dana.email, 'VIEWER')

    await owner.delete(`/api/events/${event.id}`).expect(204)
    expect((await notices(member)).items).toMatchObject([
      { kind: 'ACCESS_GRANTED', eventId: null, eventName: 'Gone Soon' },
    ])

    await t.prisma.notification.updateMany({
      data: { createdAt: new Date(Date.now() - 91 * 24 * 60 * 60 * 1000) },
    })
    expect(await notices(member)).toEqual({ items: [], unread: 0 })
  })
})
