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
  ])('stops start-up for %j', (patch, message) => {
    expect(() => loadConfig({ ...valid, ...patch })).toThrow(message)
  })
})
