import { describe, expect, it } from 'vitest'
import {
  findAccountByEmail,
  normalizeEmail,
  PASSWORD_MIN_LENGTH,
  validateSignIn,
  validateSignUp,
} from './accounts.ts'
import { DomainError } from './errors.ts'
import type { User } from './models.ts'

const existing: User[] = [
  { id: 'usr-1', name: 'Dana', email: 'dana@example.com', isSuperUser: false },
]
const valid = {
  name: ' Riley Stone ',
  email: ' Riley@Example.com ',
  password: 'x'.repeat(PASSWORD_MIN_LENGTH),
}

function failure(action: () => unknown): DomainError {
  try {
    action()
  } catch (error) {
    if (error instanceof DomainError) {
      return error
    }
    throw error
  }
  throw new Error('expected a DomainError')
}

describe('sign-up', () => {
  it('returns the tidied name and email, and never the password', () => {
    const account = validateSignUp(valid, existing)

    expect(account).toEqual({ name: 'Riley Stone', email: 'riley@example.com' })
    expect(JSON.stringify(account)).not.toContain(valid.password)
  })

  it.each([
    ['name', { ...valid, name: '  ' }],
    ['email', { ...valid, email: 'not-an-email' }],
    ['email', { ...valid, email: 'a@b' }],
    ['email', { ...valid, email: 'a b@example.com' }],
    ['password', { ...valid, password: 'x'.repeat(PASSWORD_MIN_LENGTH - 1) }],
  ])('rejects an invalid %s', (field, input) => {
    const error = failure(() => validateSignUp(input, existing))

    expect(error.code).toBe('VALIDATION')
    expect(error.details.field).toBe(field)
  })

  it('rejects an email that already has an account, whatever its case', () => {
    expect(
      failure(() =>
        validateSignUp({ ...valid, email: 'DANA@example.com' }, existing),
      ).code,
    ).toBe('EMAIL_TAKEN')
  })
})

describe('sign-in', () => {
  it('returns the email to look up', () => {
    expect(validateSignIn({ email: ' Dana@Example.com', password: 'x' })).toBe(
      'dana@example.com',
    )
  })

  it.each([
    ['email', { email: 'dana', password: 'x' }],
    ['password', { email: 'dana@example.com', password: '' }],
  ])('rejects a missing or invalid %s', (field, input) => {
    expect(failure(() => validateSignIn(input)).details.field).toBe(field)
  })
})

describe('accounts by email', () => {
  it('ignores case and surrounding spaces', () => {
    expect(normalizeEmail('  A@B.Com ')).toBe('a@b.com')
    expect(findAccountByEmail(existing, ' DANA@EXAMPLE.COM ')?.id).toBe('usr-1')
    expect(findAccountByEmail(existing, 'other@example.com')).toBeUndefined()
  })
})
