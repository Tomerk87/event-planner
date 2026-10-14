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
}

function required(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name]?.trim()
  if (!value) {
    throw new Error(`Missing environment variable ${name}`)
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
  return {
    databaseUrl: required(env, 'DATABASE_URL'),
    port,
    corsOrigin: required(env, 'CORS_ORIGIN'),
    production: nodeEnv === 'production',
    uploadDir: env['UPLOAD_DIR']?.trim() || './uploads',
    sessionDays: 30,
    authAttemptsPerMinute: 10,
  }
}

export const APP_CONFIG = Symbol('APP_CONFIG')
