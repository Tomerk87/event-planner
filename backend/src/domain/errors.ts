/**
 * Stable error codes shared by every data provider. The mock provider throws
 * them now; the API provider will map server responses to the same codes.
 */
export type DomainErrorCode =
  | 'UNAUTHENTICATED'
  | 'INVALID_CREDENTIALS'
  | 'TOO_MANY_REQUESTS'
  | 'FORBIDDEN'
  | 'EVENT_READ_ONLY'
  | 'NOT_FOUND'
  | 'VALIDATION'
  | 'INVALID_PHONE'
  | 'DUPLICATE_PHONE'
  | 'INVALID_ATTENDEE_COUNT'
  | 'GUEST_NOT_APPROVED'
  | 'TABLE_FULL'
  | 'DUPLICATE_TABLE_NUMBER'
  | 'LAST_OWNER'
  | 'SELF_PERMISSION'
  | 'ALREADY_MEMBER'
  | 'ALREADY_INVITED'
  | 'RSVP_CLOSED'
  | 'EMAIL_TAKEN'
  | 'ACCOUNT_NOT_FOUND'
  | 'UNAVAILABLE'

export type ErrorDetails = Readonly<Record<string, string | number>>

export class DomainError extends Error {
  readonly code: DomainErrorCode
  readonly details: ErrorDetails

  constructor(code: DomainErrorCode, details: ErrorDetails = {}) {
    super(code)
    this.name = 'DomainError'
    this.code = code
    this.details = details
  }
}

export function isDomainError(
  error: unknown,
  code?: DomainErrorCode,
): error is DomainError {
  return (
    error instanceof DomainError && (code === undefined || error.code === code)
  )
}

/** Rejects anything that is not a whole number within the given bounds. */
export function assertIntegerInRange(
  value: unknown,
  min: number,
  max: number,
  field: string,
): asserts value is number {
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < min ||
    value > max
  ) {
    throw new DomainError('VALIDATION', { field, min, max })
  }
}

export function assertNonEmpty(value: string, field: string): string {
  const trimmed = value.trim()
  if (trimmed === '') {
    throw new DomainError('VALIDATION', { field })
  }
  return trimmed
}
