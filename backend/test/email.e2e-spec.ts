import {
  CapturingMailer,
  createEvent,
  createTestApp,
  EMAIL_ON,
  resetDatabase,
  signUp,
  type TestApp,
} from './test-app.ts'

/** Email on (D88): verification, password reset and invitation emails. */

let t: TestApp
let mailer: CapturingMailer

/** Waits for an email sent after the response, as a reset email is. */
async function eventually<T>(read: () => T | undefined): Promise<T> {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const value = read()
    if (value !== undefined) {
      return value
    }
    await new Promise((resolve) => setTimeout(resolve, 20))
  }
  throw new Error('Timed out waiting')
}

beforeAll(async () => {
  mailer = new CapturingMailer()
  // A high limit per address, except in the tests of the limit.
  t = await createTestApp(
    { email: { ...EMAIL_ON, perAddressPerHour: 1000 } },
    { mailer },
  )
})
afterAll(async () => {
  await t.close()
})
beforeEach(async () => {
  await resetDatabase(t.prisma)
  mailer.sent.length = 0
})

describe('email verification', () => {
  it('signs up unverified, emails a link in the chosen language, and verifies with it once', async () => {
    const browser = t.browser()
    await browser
      .post('/api/auth/sign-up')
      .send({
        name: 'Dana <b>Lev</b>',
        email: 'dana@example.com',
        password: 'correct-horse',
        language: 'he',
      })
      .expect(201)

    const me = await browser.get('/api/auth/me').expect(200)
    expect(me.body).toMatchObject({ emailVerified: false })
    const [email] = mailer.to('dana@example.com')
    expect(email).toMatchObject({ kind: 'verify-email' })
    expect(email!.subject).toContain('אימות')
    expect(email!.html).toContain('dir="rtl"')
    // What a person typed is escaped in the HTML.
    expect(email!.html).toContain('Dana &lt;b&gt;Lev&lt;/b&gt;')
    expect(email!.text).toMatch(
      /http:\/\/localhost:5173\/verify-email\?token=[\w-]{20,}/,
    )

    const token = mailer.tokenFor('dana@example.com', 'verify-email')
    // The link works without being signed in, as from another device.
    await t.browser().post('/api/auth/verify-email').send({ token }).expect(204)
    await browser
      .get('/api/auth/me')
      .expect(200)
      .expect((response) =>
        expect(response.body).toMatchObject({ emailVerified: true }),
      )

    const reused = await t
      .browser()
      .post('/api/auth/verify-email')
      .send({ token })
      .expect(410)
    expect(reused.body).toEqual({ code: 'LINK_EXPIRED', details: {} })
    // The database keeps only a hash of the link.
    const stored = await t.prisma.emailToken.findFirstOrThrow()
    expect(stored.tokenHash).not.toBe(token)
  })

  it('refuses a made-up or expired link', async () => {
    const browser = t.browser()
    await signUp(browser, 'Dana Lev')
    await t.prisma.emailToken.updateMany({
      data: { expiresAt: new Date(Date.now() - 1000) },
    })

    for (const token of [
      mailer.tokenFor('dana.lev@example.com', 'verify-email'),
      'made-up',
    ]) {
      await t
        .browser()
        .post('/api/auth/verify-email')
        .send({ token })
        .expect(410)
    }
    expect((await t.prisma.user.findFirstOrThrow()).emailVerifiedAt).toBeNull()
  })

  it('sends the email again on request, and not once verified', async () => {
    const browser = t.browser()
    await signUp(browser, 'Dana Lev')

    await browser
      .post('/api/auth/resend-verification')
      .send({ language: 'en' })
      .expect(204)
    expect(mailer.to('dana.lev@example.com')).toHaveLength(2)

    await browser
      .post('/api/auth/verify-email')
      .send({ token: mailer.tokenFor('dana.lev@example.com', 'verify-email') })
      .expect(204)
    await browser.post('/api/auth/resend-verification').send({}).expect(204)
    expect(mailer.to('dana.lev@example.com')).toHaveLength(2)
    await t.browser().post('/api/auth/resend-verification').expect(401)
  })

  it('keeps invitations pending until the email is verified (D89)', async () => {
    const owner = t.browser()
    await signUp(owner, 'Owner')
    const event = await createEvent(owner, { name: 'Garden Party' })
    await owner
      .post(`/api/events/${event.id}/permissions/invitations`)
      .send({ email: 'new@example.com', role: 'ADMIN' })
      .expect(201)

    const invited = t.browser()
    await signUp(invited, 'New Person', 'new@example.com')
    expect((await invited.get('/api/events').expect(200)).body).toEqual([])

    await invited
      .post('/api/auth/verify-email')
      .send({ token: mailer.tokenFor('new@example.com', 'verify-email') })
      .expect(204)
    const events = await invited.get('/api/events').expect(200)
    expect(
      (events.body as { event: { name: string }; role: string }[]).map(
        (item) => [item.event.name, item.role],
      ),
    ).toEqual([['Garden Party', 'ADMIN']])
    expect(await t.prisma.eventInvitation.count()).toBe(0)
  })

  it('gives an unverified account a pending invitation, not access', async () => {
    const owner = t.browser()
    await signUp(owner, 'Owner')
    const event = await createEvent(owner)
    // Someone signs up with an address that is not theirs.
    await signUp(t.browser(), 'Squatter', 'colleague@example.com')

    const invited = await owner
      .post(`/api/events/${event.id}/permissions/invitations`)
      .send({ email: 'colleague@example.com', role: 'ADMIN' })
      .expect(201)

    expect(invited.body).toMatchObject({ kind: 'invitation' })
    expect(await t.prisma.eventMembership.count()).toBe(1)
  })
})

describe('password reset', () => {
  it('emails a one-time link, sets the password and signs out everywhere', async () => {
    const first = t.browser()
    const second = t.browser()
    await signUp(first, 'Dana Lev')
    await second
      .post('/api/auth/sign-in')
      .send({ email: 'dana.lev@example.com', password: 'correct-horse' })
      .expect(200)

    await t
      .browser()
      .post('/api/auth/forgot-password')
      .send({ email: ' Dana.Lev@Example.com ', language: 'en' })
      .expect(204)
    const email = await eventually(() =>
      mailer
        .to('dana.lev@example.com')
        .find((message) => message.kind === 'reset-password'),
    )
    expect(email.subject).toBe('Reset your Event Planner password')
    const token = mailer.tokenFor('dana.lev@example.com', 'reset-password')

    const short = await t
      .browser()
      .post('/api/auth/reset-password')
      .send({ token, password: 'short' })
      .expect(400)
    expect(short.body).toEqual({
      code: 'VALIDATION',
      details: { field: 'password', min: 8 },
    })
    await t
      .browser()
      .post('/api/auth/reset-password')
      .send({ token, password: 'battery-staple' })
      .expect(204)

    await first.get('/api/auth/me').expect(401)
    await second.get('/api/auth/me').expect(401)
    await t
      .browser()
      .post('/api/auth/sign-in')
      .send({ email: 'dana.lev@example.com', password: 'correct-horse' })
      .expect(401)
    await t
      .browser()
      .post('/api/auth/sign-in')
      .send({ email: 'dana.lev@example.com', password: 'battery-staple' })
      .expect(200)
    await t
      .browser()
      .post('/api/auth/reset-password')
      .send({ token, password: 'another-password' })
      .expect(410)
    // Receiving the link proves the email as well.
    expect(
      (await t.prisma.user.findFirstOrThrow()).emailVerifiedAt,
    ).not.toBeNull()
  })

  it('answers the same for an email with no account, and sends nothing', async () => {
    const response = await t
      .browser()
      .post('/api/auth/forgot-password')
      .send({ email: 'nobody@example.com' })
      .expect(204)

    expect(response.body).toEqual({})
    await new Promise((resolve) => setTimeout(resolve, 100))
    expect(mailer.sent).toEqual([])
  })

  it('refuses a malformed email', async () => {
    const response = await t
      .browser()
      .post('/api/auth/forgot-password')
      .send({ email: 'not-an-email' })
      .expect(400)
    expect(response.body).toEqual({
      code: 'VALIDATION',
      details: { field: 'email' },
    })
  })
})

describe('invitation emails (D90)', () => {
  it('invites by email in the inviter language, and emails again on request', async () => {
    const owner = t.browser()
    await signUp(owner, 'Riley Stone')
    const event = await createEvent(owner, { name: 'Garden Party' })

    const invited = await owner
      .post(`/api/events/${event.id}/permissions/invitations`)
      .send({ email: 'new@example.com', role: 'VIEWER', language: 'en' })
      .expect(201)
    const [email] = mailer.to('new@example.com')
    expect(email).toMatchObject({
      kind: 'invitation',
      subject: 'You\'re invited to "Garden Party" on Event Planner',
    })
    expect(email!.text).toContain(
      'Riley Stone invited you to the event "Garden Party" as Viewer.',
    )
    expect(email!.text).toContain('http://localhost:5173/signup')

    const { invitation } = invited.body as { invitation: { id: string } }
    await owner
      .post(
        `/api/events/${event.id}/permissions/invitations/${invitation.id}/resend`,
      )
      .send({ language: 'he' })
      .expect(204)
    expect(mailer.to('new@example.com').at(-1)!.subject).toContain('הוזמנת')
  })

  it('tells an existing account it now has access', async () => {
    const owner = t.browser()
    await signUp(owner, 'Riley Stone')
    const member = t.browser()
    await signUp(member, 'Dana Lev')
    await member
      .post('/api/auth/verify-email')
      .send({ token: mailer.tokenFor('dana.lev@example.com', 'verify-email') })
      .expect(204)
    const event = await createEvent(owner, { name: 'Garden Party' })

    await owner
      .post(`/api/events/${event.id}/permissions/invitations`)
      .send({ email: 'dana.lev@example.com', role: 'ADMIN' })
      .expect(201)

    const email = mailer.to('dana.lev@example.com').at(-1)!
    expect(email).toMatchObject({ kind: 'access-granted' })
    expect(email.text).toContain(
      `http://localhost:5173/events/${event.id}/dashboard`,
    )
  })

  it('keeps the invitation when the email cannot be sent', async () => {
    const owner = t.browser()
    await signUp(owner, 'Riley Stone')
    const event = await createEvent(owner)
    mailer.failNext = true

    await owner
      .post(`/api/events/${event.id}/permissions/invitations`)
      .send({ email: 'new@example.com', role: 'VIEWER' })
      .expect(201)

    expect(await t.prisma.eventInvitation.count()).toBe(1)
  })

  it('lets only those who manage the invitation send it again', async () => {
    const owner = t.browser()
    await signUp(owner, 'Owner')
    const viewer = t.browser()
    const viewerAccount = await signUp(viewer, 'Viewer')
    const event = await createEvent(owner)
    await t.prisma.user.update({
      where: { id: viewerAccount.id },
      data: { emailVerifiedAt: new Date() },
    })
    await owner
      .post(`/api/events/${event.id}/permissions/invitations`)
      .send({ email: viewerAccount.email, role: 'VIEWER' })
      .expect(201)
    const invited = await owner
      .post(`/api/events/${event.id}/permissions/invitations`)
      .send({ email: 'new@example.com', role: 'OWNER' })
      .expect(201)
    const { invitation } = invited.body as { invitation: { id: string } }

    await viewer
      .post(
        `/api/events/${event.id}/permissions/invitations/${invitation.id}/resend`,
      )
      .expect(403)
    await owner
      .post(`/api/events/${event.id}/permissions/invitations/unknown/resend`)
      .expect(404)
  })
})

describe('limits per address', () => {
  it('sends at most the configured number of emails of a kind an hour', async () => {
    const limited = new CapturingMailer()
    const app = await createTestApp(
      { email: { ...EMAIL_ON, perAddressPerHour: 2 } },
      { mailer: limited },
    )
    try {
      const browser = app.browser()
      await signUp(browser, 'Dana Lev')
      await browser.post('/api/auth/resend-verification').expect(204)

      const refused = await browser
        .post('/api/auth/resend-verification')
        .expect(429)

      expect(refused.body).toEqual({ code: 'TOO_MANY_REQUESTS', details: {} })
      expect(limited.sent).toHaveLength(2)
    } finally {
      await app.close()
    }
  })
})

describe('system settings (D91)', () => {
  it('tells everyone whether email is on, and only a Super User the details', async () => {
    await t.browser().get('/api/system/features').expect(200, { email: true })

    const user = t.browser()
    const account = await signUp(user, 'Dana Lev')
    await user.get('/api/system/email').expect(403)
    await user.post('/api/system/email/test').expect(403)

    await t.prisma.user.update({
      where: { id: account.id },
      data: { isSuperUser: true },
    })
    await user.get('/api/system/email').expect(200, {
      mode: 'smtp',
      host: 'localhost',
      port: 1025,
      from: 'Event Planner <noreply@example.com>',
      authenticated: false,
    })
    await user
      .post('/api/system/email/test')
      .send({ language: 'en' })
      .expect(200, { sent: true })
    expect(mailer.to('dana.lev@example.com').at(-1)).toMatchObject({
      kind: 'test',
    })
    mailer.failNext = true
    const failed = await user.post('/api/system/email/test').expect(503)
    expect(failed.body).toEqual({ code: 'UNAVAILABLE', details: {} })
  })
})

describe('email off (the default, D88)', () => {
  it('sends nothing, offers no email routes and reports itself off', async () => {
    const quiet = new CapturingMailer()
    const app = await createTestApp({}, { mailer: quiet })
    try {
      const browser = app.browser()
      const account = await signUp(browser, 'Dana Lev')
      await browser
        .get('/api/auth/me')
        .expect(200)
        .expect((response) =>
          expect(response.body).toMatchObject({ emailVerified: true }),
        )
      await app.browser().get('/api/system/features').expect(200, {
        email: false,
      })
      await app
        .browser()
        .post('/api/auth/forgot-password')
        .send({ email: account.email })
        .expect(404)
      await browser.post('/api/auth/resend-verification').expect(404)
      const event = await createEvent(browser)
      const invited = await browser
        .post(`/api/events/${event.id}/permissions/invitations`)
        .send({ email: 'new@example.com', role: 'VIEWER' })
        .expect(201)
      const { invitation } = invited.body as { invitation: { id: string } }
      await browser
        .post(
          `/api/events/${event.id}/permissions/invitations/${invitation.id}/resend`,
        )
        .expect(404)
      await app.prisma.user.update({
        where: { id: account.id },
        data: { isSuperUser: true },
      })
      await browser.get('/api/system/email').expect(200, {
        mode: 'off',
        host: null,
        port: null,
        from: '',
        authenticated: false,
      })
      await browser.post('/api/system/email/test').expect(200, { sent: false })

      expect(quiet.sent).toEqual([])
    } finally {
      await app.close()
    }
  })
})
