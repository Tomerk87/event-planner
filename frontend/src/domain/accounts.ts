import { assertNonEmpty, DomainError } from './errors.ts'
import type { User } from './models.ts'

export interface SignUpInput {
  name: string
  email: string
  password: string
}

export interface SignInInput {
  email: string
  password: string
}

export const PASSWORD_MIN_LENGTH = 8

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Emails identify accounts without regard to case or surrounding spaces. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

function assertEmail(email: string): string {
  const normalized = normalizeEmail(email)
  if (!EMAIL_PATTERN.test(normalized)) {
    throw new DomainError('VALIDATION', { field: 'email' })
  }
  return normalized
}

function assertPassword(password: string, min: number): void {
  if (password.length < min) {
    throw new DomainError('VALIDATION', { field: 'password', min })
  }
}

/**
 * Validates a sign-up and returns the account details to keep. The password
 * is checked and deliberately not returned: storing and verifying it is the
 * job of the authentication service, never of this application's own data.
 */
export function validateSignUp(
  input: SignUpInput,
  existing: readonly User[],
): Pick<User, 'name' | 'email'> {
  const name = assertNonEmpty(input.name, 'name')
  const email = assertEmail(input.email)
  assertPassword(input.password, PASSWORD_MIN_LENGTH)
  if (existing.some((user) => normalizeEmail(user.email) === email)) {
    throw new DomainError('EMAIL_TAKEN')
  }
  return { name, email }
}

/** Checks a sign-in is complete and returns the email to look up. */
export function validateSignIn(input: SignInInput): string {
  const email = assertEmail(input.email)
  assertPassword(input.password, 1)
  return email
}

export function findAccountByEmail(
  users: readonly User[],
  email: string,
): User | undefined {
  const normalized = normalizeEmail(email)
  return users.find((user) => normalizeEmail(user.email) === normalized)
}
