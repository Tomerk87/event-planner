import { createHash, randomBytes } from 'node:crypto'
import type { CookieOptions } from 'express'

export const SESSION_COOKIE = 'ep_session'

/** A new random session token, as sent to the browser in the cookie. */
export function newSessionToken(): string {
  return randomBytes(32).toString('base64url')
}

/** Only this hash is stored, so a copy of the database holds no usable token. */
export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function sessionCookieOptions(
  production: boolean,
  expires: Date,
): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: production,
    path: '/',
    expires,
  }
}
