/** Settings read from the environment once, at start-up. */
export interface AppConfig {
  databaseUrl: string
  port: number
  /** The frontend's origin, allowed to call the API with credentials. */
  corsOrigin: string
  production: boolean
  /** Directory where the local image storage keeps files. */
  uploadDir: string
  /** How long a session lasts without signing in again. */
  sessionDays: number
  /** Sign-in and sign-up attempts allowed per minute from one address. */
  authAttemptsPerMinute: number
  /** The application's own address, used in the RSVP link sent to guests. */
  publicAppUrl: string
  /** Public RSVP submissions allowed per window (D2). */
  rsvpLimits: { perIp: number; perPhone: number; windowMinutes: number }
  /**
   * Proxies in front of the server whose forwarded client address is
   * trusted (Nginx in production: 1). With 0, the connection's address is
   * used, so behind a proxy every visitor would share one address.
   */
  trustProxyHops: number
}

function required(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name]?.trim()
  if (!value) {
    throw new Error(`Missing environment variable ${name}`)
  }
  return value
}

function positiveInteger(
  env: NodeJS.ProcessEnv,
  name: string,
  fallback: number,
  min = 1,
): number {
  const raw = env[name]?.trim()
  const value = raw ? Number(raw) : fallback
  if (!Number.isInteger(value) || value < min) {
    throw new Error(`${name} must be a whole number of at least ${min}`)
  }
  return value
}

/** Reads and checks the configuration; a missing or bad value stops start-up. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const port = Number(env['PORT'] ?? 3000)
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be a port number')
  }
  const nodeEnv = env['NODE_ENV'] ?? 'development'
  if (!['development', 'production', 'test'].includes(nodeEnv)) {
    throw new Error('NODE_ENV must be development, production or test')
  }
  const corsOrigin = required(env, 'CORS_ORIGIN')
  return {
    databaseUrl: required(env, 'DATABASE_URL'),
    port,
    corsOrigin,
    production: nodeEnv === 'production',
    uploadDir: env['UPLOAD_DIR']?.trim() || './uploads',
    sessionDays: 30,
    authAttemptsPerMinute: positiveInteger(env, 'AUTH_ATTEMPTS_PER_MINUTE', 10),
    publicAppUrl: (env['PUBLIC_APP_URL']?.trim() || corsOrigin).replace(
      /\/+$/,
      '',
    ),
    rsvpLimits: {
      perIp: positiveInteger(env, 'RSVP_LIMIT_PER_IP', 10),
      perPhone: positiveInteger(env, 'RSVP_LIMIT_PER_PHONE', 3),
      windowMinutes: positiveInteger(env, 'RSVP_LIMIT_WINDOW_MINUTES', 10),
    },
    trustProxyHops: positiveInteger(env, 'TRUST_PROXY_HOPS', 0, 0),
  }
}

export const APP_CONFIG = Symbol('APP_CONFIG')
