import { DomainError } from './errors.ts'

const ISRAEL_COUNTRY_CODE = '972'
const MIN_INTERNATIONAL_DIGITS = 8
const MAX_INTERNATIONAL_DIGITS = 15

/**
 * Converts a phone number as typed into one canonical form, used for
 * uniqueness within an event and for matching RSVP submissions.
 *
 * Accepted: Israeli local numbers ("050-123-4567"), Israeli numbers with the
 * country code ("+972 50 123 4567", "972501234567", "+972 050 1234567"), and
 * any other number written internationally with "+" or "00". Only the shape is
 * checked (digits and length), not whether an operator has assigned the range.
 */
export function normalizePhone(input: string): string {
  const compact = input.replace(/[\s\-().]/g, '')
  const hasPlus = compact.startsWith('+')
  const digits = hasPlus ? compact.slice(1) : compact

  if (!/^\d+$/.test(digits)) {
    throw new DomainError('INVALID_PHONE')
  }

  let international: string
  if (hasPlus) {
    international = digits
  } else if (digits.startsWith('00') && digits.length > 10) {
    international = digits.slice(2)
  } else if (
    digits.startsWith(ISRAEL_COUNTRY_CODE) &&
    digits.length >= 11 &&
    digits.length <= 13
  ) {
    international = digits
  } else if (
    digits.startsWith('0') &&
    (digits.length === 9 || digits.length === 10)
  ) {
    international = ISRAEL_COUNTRY_CODE + digits.slice(1)
  } else {
    throw new DomainError('INVALID_PHONE')
  }

  if (international.startsWith(ISRAEL_COUNTRY_CODE)) {
    const national = international.slice(ISRAEL_COUNTRY_CODE.length)
    // "+972 050 ..." keeps the local leading zero; drop it.
    const significant =
      national.length === 10 && national.startsWith('0')
        ? national.slice(1)
        : national
    if (significant.length < 8 || significant.length > 9) {
      throw new DomainError('INVALID_PHONE')
    }
    return `+${ISRAEL_COUNTRY_CODE}${significant}`
  }

  if (
    international.length < MIN_INTERNATIONAL_DIGITS ||
    international.length > MAX_INTERNATIONAL_DIGITS
  ) {
    throw new DomainError('INVALID_PHONE')
  }
  return `+${international}`
}
