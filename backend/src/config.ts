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
  email: EmailConfig
}

/**
 * Email (D88). Off by default: nothing is sent, accounts count as verified at
 * sign-up and invitations activate then. With `smtp` the server sends
 * verification, password-reset and invitation emails through the provider.
 */
export interface EmailConfig {
  mode: 'off' | 'smtp'
  smtp: {
    host: string
    port: number
    /** TLS from the first byte (port 465); otherwise STARTTLS when offered. */
    secure: boolean
    user: string | null
    password: string | null
  } | null
  /** The sender, such as "Event Planner <noreply@example.com>". */
  from: string
  verifyHours: number
  resetMinutes: number
  /** Emails allowed per address per hour, for each kind of email. */
  perAddressPerHour: number
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

function loadEmail(env: NodeJS.ProcessEnv): EmailConfig {
  const mode = env['EMAIL_MODE']?.trim() || 'off'
  if (mode !== 'off' && mode !== 'smtp') {
    throw new Error('EMAIL_MODE must be off or smtp')
  }
  const common = {
    verifyHours: positiveInteger(env, 'EMAIL_VERIFY_HOURS', 24),
    resetMinutes: positiveInteger(env, 'PASSWORD_RESET_MINUTES', 60),
    perAddressPerHour: positiveInteger(env, 'EMAIL_LIMIT_PER_HOUR', 3),
  }
  if (mode === 'off') {
    return { mode, smtp: null, from: '', ...common }
  }
  const port = positiveInteger(env, 'SMTP_PORT', 587)
  return {
    mode,
    smtp: {
      host: required(env, 'SMTP_HOST'),
      port,
      secure: port === 465,
      user: env['SMTP_USER']?.trim() || null,
      password: env['SMTP_PASSWORD'] || null,
    },
    from: required(env, 'EMAIL_FROM'),
    ...common,
  }
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
  const production = nodeEnv === 'production'
  const publicAppUrl = (env['PUBLIC_APP_URL']?.trim() || corsOrigin).replace(
    /\/+$/,
    '',
  )
  // The session cookie is sent over HTTPS only in production, so a plain
  // HTTP address there would leave nobody able to stay signed in.
  if (
    production &&
    ![corsOrigin, publicAppUrl].every((url) => url.startsWith('https://'))
  ) {
    throw new Error(
      'In production, CORS_ORIGIN and PUBLIC_APP_URL must be https:// addresses',
    )
  }
  return {
    databaseUrl: required(env, 'DATABASE_URL'),
    port,
    corsOrigin,
    production,
    uploadDir: env['UPLOAD_DIR']?.trim() || './uploads',
    sessionDays: 30,
    authAttemptsPerMinute: positiveInteger(env, 'AUTH_ATTEMPTS_PER_MINUTE', 10),
    publicAppUrl,
    rsvpLimits: {
      perIp: positiveInteger(env, 'RSVP_LIMIT_PER_IP', 10),
      perPhone: positiveInteger(env, 'RSVP_LIMIT_PER_PHONE', 3),
      windowMinutes: positiveInteger(env, 'RSVP_LIMIT_WINDOW_MINUTES', 10),
    },
    trustProxyHops: positiveInteger(env, 'TRUST_PROXY_HOPS', 0, 0),
    email: loadEmail(env),
  }
}

export const APP_CONFIG = Symbol('APP_CONFIG')
