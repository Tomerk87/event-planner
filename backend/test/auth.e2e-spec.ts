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

describe('authentication', () => {
  it('signs up into a session kept in an httpOnly cookie, and stores no password', async () => {
    const browser = t.browser()

    const response = await browser
      .post('/api/auth/sign-up')
      .send({
        name: ' Dana Lev ',
        email: ' Dana@Example.com ',
        password: 'correct-horse',
      })
      .expect(201)

    expect(response.body).toMatchObject({
      name: 'Dana Lev',
      email: 'dana@example.com',
      isSuperUser: false,
    })
    const cookie = String(response.headers['set-cookie'])
    expect(cookie).toMatch(/^ep_session=/)
    expect(cookie).toMatch(/HttpOnly/)
    expect(cookie).toMatch(/SameSite=Lax/)
    await browser
      .get('/api/auth/me')
      .expect(200, { ...response.body, emailVerified: true })

    const stored = await t.prisma.user.findUniqueOrThrow({
      where: { email: 'dana@example.com' },
    })
    expect(stored.passwordHash).toMatch(/^\$argon2id\$/)
    expect(stored.passwordHash).not.toContain('correct-horse')
    // Email is off by default (D88): the account counts as verified.
    expect(stored.emailVerifiedAt).not.toBeNull()
    const session = await t.prisma.session.findFirstOrThrow()
    expect(cookie).not.toContain(session.tokenHash)
  })

  it('refuses a taken email, a short password and a malformed request', async () => {
    const browser = t.browser()
    await signUp(browser, 'Dana Lev', 'dana@example.com')

    const taken = await t
      .browser()
      .post('/api/auth/sign-up')
      .send({
        name: 'Other',
        email: 'DANA@example.com',
        password: 'correct-horse',
      })
      .expect(409)
    expect(taken.body).toEqual({ code: 'EMAIL_TAKEN', details: {} })

    const short = await t
      .browser()
      .post('/api/auth/sign-up')
      .send({ name: 'Other', email: 'other@example.com', password: 'short' })
      .expect(400)
    expect(short.body).toMatchObject({
      code: 'VALIDATION',
      details: { field: 'password' },
    })

    await t
      .browser()
      .post('/api/auth/sign-up')
      .send({
        name: 'Other',
        email: 'x@example.com',
        password: 'correct-horse',
        isSuperUser: true,
      })
      .expect(400)
  })

  it('signs in with the right password only, without saying whether the account exists', async () => {
    await signUp(t.browser(), 'Dana Lev', 'dana@example.com')
    const browser = t.browser()

    const wrong = await browser
      .post('/api/auth/sign-in')
      .send({ email: 'dana@example.com', password: 'wrong-password' })
      .expect(401)
    const missing = await browser
      .post('/api/auth/sign-in')
      .send({ email: 'nobody@example.com', password: 'wrong-password' })
      .expect(401)
    expect(wrong.body).toEqual({ code: 'INVALID_CREDENTIALS', details: {} })
    expect(missing.body).toEqual(wrong.body)
    await browser.get('/api/auth/me').expect(401)

    await browser
      .post('/api/auth/sign-in')
      .send({ email: ' DANA@example.com', password: 'correct-horse' })
      .expect(200)
    await browser.get('/api/auth/me').expect(200)
  })

  it('ends the session on sign-out, on the server as well as in the browser', async () => {
    const first = t.browser()
    await signUp(first, 'Dana Lev')
    const second = t.browser()
    await second
      .post('/api/auth/sign-in')
      .send({ email: 'dana.lev@example.com', password: 'correct-horse' })
      .expect(200)

    await first.post('/api/auth/sign-out').expect(204)

    await first.get('/api/auth/me').expect(401)
    expect(await t.prisma.session.count()).toBe(1)
    // The person's other session is unaffected.
    await second.get('/api/auth/me').expect(200)
  })

  it('refuses an expired session and a made-up cookie', async () => {
    const browser = t.browser()
    await signUp(browser, 'Dana Lev')
    await t.prisma.session.updateMany({
      data: { expiresAt: new Date(Date.now() - 1000) },
    })

    const expired = await browser.get('/api/auth/me').expect(401)
    expect(expired.body).toEqual({ code: 'UNAUTHENTICATED', details: {} })
    await t
      .browser()
      .get('/api/events')
      .set('Cookie', 'ep_session=forged')
      .expect(401)
  })

  it('turns the pending invitations of an email into access when it signs up', async () => {
    const owner = t.browser()
    await signUp(owner, 'Owner')
    const first = await createEvent(owner, { name: 'First' })
    const second = await createEvent(owner, { name: 'Second' })
    await owner
      .post(`/api/events/${first.id}/permissions/invitations`)
      .send({ email: 'new@example.com', role: 'ADMIN' })
      .expect(201)
    await owner
      .post(`/api/events/${second.id}/permissions/invitations`)
      .send({ email: 'NEW@example.com', role: 'VIEWER' })
      .expect(201)

    const invited = t.browser()
    await signUp(invited, 'New Person', 'New@Example.com')

    const events = await invited.get('/api/events').expect(200)
    expect(
      (events.body as { event: { name: string }; role: string }[]).map(
        (item) => [item.event.name, item.role],
      ),
    ).toEqual([
      ['First', 'ADMIN'],
      ['Second', 'VIEWER'],
    ])
    expect(await t.prisma.eventInvitation.count()).toBe(0)
  })

  it('limits sign-in attempts from one address', async () => {
    // Its own server, so attempts made by other tests do not count.
    const fresh = await createTestApp({ authAttemptsPerMinute: 10 })
    try {
      const browser = fresh.browser()
      const attempt = () =>
        browser
          .post('/api/auth/sign-in')
          .send({ email: 'a@example.com', password: 'x' })
      for (let index = 0; index < 10; index += 1) {
        await attempt().expect(401)
      }

      const limited = await attempt().expect(429)

      expect(limited.body).toEqual({ code: 'TOO_MANY_REQUESTS', details: {} })
    } finally {
      await fresh.close()
    }
  })

  it('marks every answer as data that is not to be sniffed or framed', async () => {
    const response = await t.browser().get('/api/health').expect(200)

    expect(response.headers).toMatchObject({
      'x-content-type-options': 'nosniff',
      'x-frame-options': 'DENY',
      'referrer-policy': 'no-referrer',
    })
    expect(response.headers).not.toHaveProperty('x-powered-by')
  })

  it('reports the health of the API and its database without a session', async () => {
    await t
      .browser()
      .get('/api/health')
      .expect(200, { status: 'ok', database: 'ok' })
  })
})
