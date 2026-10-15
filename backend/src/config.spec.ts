import { loadConfig } from './config.ts'

const valid = {
  DATABASE_URL: 'postgresql://user:secret@localhost:5432/app',
  CORS_ORIGIN: 'http://localhost:5173',
}

describe('configuration', () => {
  it('reads the settings, with defaults for the optional ones', () => {
    expect(loadConfig(valid)).toEqual({
      databaseUrl: valid.DATABASE_URL,
      port: 3000,
      corsOrigin: valid.CORS_ORIGIN,
      production: false,
      uploadDir: './uploads',
      sessionDays: 30,
      authAttemptsPerMinute: 10,
      publicAppUrl: valid.CORS_ORIGIN,
      rsvpLimits: { perIp: 10, perPhone: 3, windowMinutes: 10 },
      trustProxyHops: 0,
      email: {
        mode: 'off',
        smtp: null,
        from: '',
        verifyHours: 24,
        resetMinutes: 60,
        perAddressPerHour: 3,
      },
    })
  })

  it('reads the email provider when email is on', () => {
    expect(
      loadConfig({
        ...valid,
        EMAIL_MODE: 'smtp',
        SMTP_HOST: 'email-smtp.eu-west-1.amazonaws.com',
        SMTP_PORT: '465',
        SMTP_USER: 'user',
        SMTP_PASSWORD: 'secret',
        EMAIL_FROM: 'Event Planner <noreply@example.com>',
        EMAIL_LIMIT_PER_HOUR: '5',
      }).email,
    ).toEqual({
      mode: 'smtp',
      smtp: {
        host: 'email-smtp.eu-west-1.amazonaws.com',
        port: 465,
        secure: true,
        user: 'user',
        password: 'secret',
      },
      from: 'Event Planner <noreply@example.com>',
      verifyHours: 24,
      resetMinutes: 60,
      perAddressPerHour: 5,
    })
  })

  it('needs no login for a local test mail server', () => {
    expect(
      loadConfig({
        ...valid,
        EMAIL_MODE: 'smtp',
        SMTP_HOST: 'localhost',
        SMTP_PORT: '1025',
        EMAIL_FROM: 'noreply@localhost',
      }).email.smtp,
    ).toEqual({
      host: 'localhost',
      port: 1025,
      secure: false,
      user: null,
      password: null,
    })
  })

  it('reads the public address, RSVP limits and proxy hops', () => {
    expect(
      loadConfig({
        ...valid,
        PUBLIC_APP_URL: 'https://events.example.com/',
        RSVP_LIMIT_PER_IP: '20',
        RSVP_LIMIT_PER_PHONE: '5',
        RSVP_LIMIT_WINDOW_MINUTES: '15',
        TRUST_PROXY_HOPS: '1',
        AUTH_ATTEMPTS_PER_MINUTE: '50',
      }),
    ).toMatchObject({
      authAttemptsPerMinute: 50,
      publicAppUrl: 'https://events.example.com',
      rsvpLimits: { perIp: 20, perPhone: 5, windowMinutes: 15 },
      trustProxyHops: 1,
    })
  })

  it('marks production, so the session cookie is sent over HTTPS only', () => {
    expect(
      loadConfig({
        ...valid,
        CORS_ORIGIN: 'https://events.example.com',
        NODE_ENV: 'production',
        PORT: '8080',
        UPLOAD_DIR: '/data',
      }),
    ).toMatchObject({ production: true, port: 8080, uploadDir: '/data' })
  })

  it.each([
    [{ DATABASE_URL: '' }, /DATABASE_URL/],
    [{ CORS_ORIGIN: undefined }, /CORS_ORIGIN/],
    [{ PORT: 'eighty' }, /PORT/],
    [{ NODE_ENV: 'staging' }, /NODE_ENV/],
    [{ RSVP_LIMIT_PER_IP: '0' }, /RSVP_LIMIT_PER_IP/],
    [{ RSVP_LIMIT_PER_PHONE: 'three' }, /RSVP_LIMIT_PER_PHONE/],
    [{ TRUST_PROXY_HOPS: '-1' }, /TRUST_PROXY_HOPS/],
    [{ EMAIL_MODE: 'ses' }, /EMAIL_MODE/],
    [{ NODE_ENV: 'production' }, /https/],
    [
      {
        NODE_ENV: 'production',
        CORS_ORIGIN: 'https://events.example.com',
        PUBLIC_APP_URL: 'http://events.example.com',
      },
      /https/,
    ],
    [{ EMAIL_MODE: 'smtp', EMAIL_FROM: 'a@b.co' }, /SMTP_HOST/],
    [{ EMAIL_MODE: 'smtp', SMTP_HOST: 'localhost' }, /EMAIL_FROM/],
  ])('stops start-up for %j', (patch, message) => {
    expect(() => loadConfig({ ...valid, ...patch })).toThrow(message)
  })
})
