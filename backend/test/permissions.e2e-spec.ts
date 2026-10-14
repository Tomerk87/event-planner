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

/** An event with an Owner, an Admin and a Viewer, each in their own browser. */
async function team() {
  const owner = t.browser()
  const ownerUser = await signUp(owner, 'Olive Owner')
  const event = await createEvent(owner)
  const admin = t.browser()
  const adminUser = await signUp(admin, 'Adam Admin')
  const viewer = t.browser()
  const viewerUser = await signUp(viewer, 'Vera Viewer')
  const base = `/api/events/${event.id}/permissions`
  await owner
    .post(`${base}/invitations`)
    .send({ email: adminUser.email, role: 'ADMIN' })
    .expect(201)
  await owner
    .post(`${base}/invitations`)
    .send({ email: viewerUser.email, role: 'VIEWER' })
    .expect(201)
  return { event, base, owner, admin, viewer, ownerUser, adminUser, viewerUser }
}

function code(response: { body: unknown }): string {
  return (response.body as { code: string }).code
}

describe('permissions', () => {
  it('lists members Owners first, marks the current user, and lists invitations', async () => {
    const { base, owner, admin } = await team()
    await owner
      .post(`${base}/invitations`)
      .send({ email: 'later@example.com', role: 'VIEWER' })

    const list = await admin.get(base).expect(200)

    expect(
      (
        list.body.members as {
          user: { name: string }
          role: string
          isCurrentUser: boolean
        }[]
      ).map((member) => [member.user.name, member.role, member.isCurrentUser]),
    ).toEqual([
      ['Olive Owner', 'OWNER', false],
      ['Adam Admin', 'ADMIN', true],
      ['Vera Viewer', 'VIEWER', false],
    ])
    expect(list.body.invitations).toMatchObject([
      { email: 'later@example.com', role: 'VIEWER' },
    ])
  })

  it('hides permissions from a Viewer, and from someone outside the event', async () => {
    const { base, viewer } = await team()
    const stranger = t.browser()
    await signUp(stranger, 'Stranger')

    expect(code(await viewer.get(base).expect(403))).toBe('FORBIDDEN')
    expect(
      code(
        await viewer
          .post(`${base}/invitations`)
          .send({ email: 'x@example.com', role: 'VIEWER' })
          .expect(403),
      ),
    ).toBe('FORBIDDEN')
    expect(code(await stranger.get(base).expect(404))).toBe('NOT_FOUND')
  })

  it('keeps an Admin to Admins and Viewers, and everyone off their own permission', async () => {
    const { base, owner, admin, ownerUser, adminUser, viewerUser } =
      await team()

    expect(
      code(
        await admin
          .put(`${base}/members/${ownerUser.id}`)
          .send({ role: 'VIEWER' })
          .expect(403),
      ),
    ).toBe('FORBIDDEN')
    expect(
      code(await admin.delete(`${base}/members/${ownerUser.id}`).expect(403)),
    ).toBe('FORBIDDEN')
    expect(
      code(
        await admin
          .post(`${base}/invitations`)
          .send({ email: 'boss@example.com', role: 'OWNER' })
          .expect(403),
      ),
    ).toBe('FORBIDDEN')
    expect(
      code(
        await admin
          .put(`${base}/members/${adminUser.id}`)
          .send({ role: 'VIEWER' })
          .expect(409),
      ),
    ).toBe('SELF_PERMISSION')
    expect(
      code(await owner.delete(`${base}/members/${ownerUser.id}`).expect(409)),
    ).toBe('SELF_PERMISSION')

    await admin
      .put(`${base}/members/${viewerUser.id}`)
      .send({ role: 'ADMIN' })
      .expect(200)
    await admin.delete(`${base}/members/${viewerUser.id}`).expect(204)
  })

  it('keeps at least one Owner; a pending Owner invitation does not count', async () => {
    const { base, owner, ownerUser, adminUser } = await team()
    await owner
      .post(`${base}/invitations`)
      .send({ email: 'future@example.com', role: 'OWNER' })
      .expect(201)
    const superUser = t.browser()
    const { id } = await signUp(superUser, 'Super')
    await t.prisma.user.update({ where: { id }, data: { isSuperUser: true } })

    expect(
      code(
        await superUser.delete(`${base}/members/${ownerUser.id}`).expect(409),
      ),
    ).toBe('LAST_OWNER')

    await owner
      .put(`${base}/members/${adminUser.id}`)
      .send({ role: 'OWNER' })
      .expect(200)
    await superUser.delete(`${base}/members/${ownerUser.id}`).expect(204)
  })

  it('makes an existing account a member at once, and refuses duplicates', async () => {
    const { base, owner } = await team()
    const jamie = t.browser()
    await signUp(jamie, 'Jamie Rhodes')

    const invited = await owner
      .post(`${base}/invitations`)
      .send({ email: ' JAMIE.RHODES@example.com ', role: 'VIEWER' })
      .expect(201)

    expect(invited.body).toMatchObject({
      kind: 'member',
      member: { role: 'VIEWER', user: { name: 'Jamie Rhodes' } },
    })
    expect(
      code(
        await owner
          .post(`${base}/invitations`)
          .send({ email: 'jamie.rhodes@example.com', role: 'ADMIN' })
          .expect(409),
      ),
    ).toBe('ALREADY_MEMBER')
    await owner
      .post(`${base}/invitations`)
      .send({ email: 'new@example.com', role: 'ADMIN' })
      .expect(201)
    expect(
      code(
        await owner
          .post(`${base}/invitations`)
          .send({ email: 'NEW@example.com', role: 'VIEWER' })
          .expect(409),
      ),
    ).toBe('ALREADY_INVITED')
    expect(
      code(
        await owner
          .post(`${base}/invitations`)
          .send({ email: 'not an email', role: 'VIEWER' })
          .expect(400),
      ),
    ).toBe('VALIDATION')
    expect(
      code(
        await owner
          .post(`${base}/invitations`)
          .send({ email: 'x@example.com', role: 'KING' })
          .expect(400),
      ),
    ).toBe('VALIDATION')
  })

  it('changes and cancels a pending invitation under the same rules', async () => {
    const { base, owner, admin } = await team()
    const pending = await owner
      .post(`${base}/invitations`)
      .send({ email: 'boss@example.com', role: 'OWNER' })
      .expect(201)
    const id = pending.body.invitation.id as string

    expect(
      code(
        await admin
          .put(`${base}/invitations/${id}`)
          .send({ role: 'VIEWER' })
          .expect(403),
      ),
    ).toBe('FORBIDDEN')
    expect(
      code(await admin.delete(`${base}/invitations/${id}`).expect(403)),
    ).toBe('FORBIDDEN')
    await owner
      .put(`${base}/invitations/${id}`)
      .send({ role: 'ADMIN' })
      .expect(200)
    await admin.delete(`${base}/invitations/${id}`).expect(204)
    expect(
      code(await admin.delete(`${base}/invitations/${id}`).expect(404)),
    ).toBe('NOT_FOUND')
  })

  it('lets only an Owner change the permissions of a past event', async () => {
    const { event, base, owner, admin, viewerUser } = await team()
    await makePast(t.prisma, event.id)

    await admin.get(base).expect(200)
    const refused = await admin
      .put(`${base}/members/${viewerUser.id}`)
      .send({ role: 'ADMIN' })
      .expect(403)
    expect(code(refused)).toBe('EVENT_READ_ONLY')
    await owner
      .put(`${base}/members/${viewerUser.id}`)
      .send({ role: 'ADMIN' })
      .expect(200)
  })

  it('gives one person different roles in different events', async () => {
    const { owner, admin, adminUser } = await team()
    const second = await createEvent(admin as TestAgent, {
      name: 'Admin’s own',
    })

    const roles = (await admin.get('/api/events').expect(200)).body as {
      event: { name: string }
      role: string
    }[]

    expect(roles.map((item) => [item.event.name, item.role])).toEqual([
      ['Garden Party', 'ADMIN'],
      ['Admin’s own', 'OWNER'],
    ])
    await owner.get(`/api/events/${second.id}`).expect(404)
    expect(adminUser.email).toBe('adam.admin@example.com')
  })
})
