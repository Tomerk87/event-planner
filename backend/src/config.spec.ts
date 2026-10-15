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
  ])('stops start-up for %j', (patch, message) => {
    expect(() => loadConfig({ ...valid, ...patch })).toThrow(message)
  })
})
