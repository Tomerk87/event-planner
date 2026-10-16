import { DomainError } from './errors.ts'

/**
 * The countries whose local numbers are understood (D103). Each event has
 * one: a number typed without a country code is read as that country's.
 */
export const COUNTRIES = ['IL', 'BR'] as const

export type Country = (typeof COUNTRIES)[number]

export const DEFAULT_COUNTRY: Country = 'IL'

export function isCountry(value: unknown): value is Country {
  return (COUNTRIES as readonly unknown[]).includes(value)
}

const ISRAEL_COUNTRY_CODE = '972'
const BRAZIL_COUNTRY_CODE = '55'
const MIN_INTERNATIONAL_DIGITS = 8
const MAX_INTERNATIONAL_DIGITS = 15

/**
 * Israeli numbers never start with these digits after the leading zero. A
 * number typed without "+" that does is local to another country (a French
 * "06…", for example) and must not be taken for an Israeli one. The digit 0
 * is deliberately absent: no real number starts with it either, and that is
 * exactly why the demo data uses it — its numbers cannot be dialled.
 */
const UNUSED_ISRAELI_FIRST_DIGITS = '16'

/**
 * Converts a phone number as typed into one canonical form, used for
 * uniqueness within an event and for matching RSVP submissions.
 *
 * Accepted: any number written internationally with "+" or "00", and local
 * numbers of the event's country:
 * - Israel: "050-123-4567", or with the country code and no "+"
 *   ("972501234567", "+972 050 1234567").
 * - Brazil: area code and number, "(11) 91234-5678" or "11 3123-4567", with
 *   or without the trunk "0" ("011 91234-5678"), or with the country code
 *   and no "+" ("5511912345678").
 *
 * A number from elsewhere needs its code. Only the shape is checked, not
 * whether an operator has assigned the range.
 */
export function normalizePhone(
  input: string,
  country: Country = DEFAULT_COUNTRY,
): string {
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
  } else if (country === 'BR') {
    international = BRAZIL_COUNTRY_CODE + brazilianNational(digits)
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
    if (
      significant.length < 8 ||
      significant.length > 9 ||
      UNUSED_ISRAELI_FIRST_DIGITS.includes(significant[0] ?? '')
    ) {
      throw new DomainError('INVALID_PHONE')
    }
    return `+${ISRAEL_COUNTRY_CODE}${significant}`
  }

  if (international.startsWith(BRAZIL_COUNTRY_CODE)) {
    const national = international.slice(BRAZIL_COUNTRY_CODE.length)
    if (national.length < 10 || national.length > 11) {
      throw new DomainError('INVALID_PHONE')
    }
    return `+${international}`
  }

  if (
    international.length < MIN_INTERNATIONAL_DIGITS ||
    international.length > MAX_INTERNATIONAL_DIGITS
  ) {
    throw new DomainError('INVALID_PHONE')
  }
  return `+${international}`
}

/**
 * The national part of a Brazilian number typed without "+": a two-digit
 * area code and an eight-digit landline or nine-digit mobile number. A
 * national number has at most 11 digits, so 12 or 13 starting with 55 carry
 * the country code. The demo's numbers use the area code "00", which does
 * not exist, so they cannot be dialled; they are always written with "+55".
 */
function brazilianNational(digits: string): string {
  // A leading zero is the trunk prefix; no area code starts with it.
  if (digits.startsWith('0')) {
    if (digits.length === 11 || digits.length === 12) {
      return digits.slice(1)
    }
  } else if (digits.length === 10 || digits.length === 11) {
    return digits
  } else if (
    digits.startsWith(BRAZIL_COUNTRY_CODE) &&
    (digits.length === 12 || digits.length === 13)
  ) {
    return digits.slice(BRAZIL_COUNTRY_CODE.length)
  }
  throw new DomainError('INVALID_PHONE')
}

// International calling codes. No code is the start of another, so the code
// of a number is the first one, two or three digits found here.
const CALLING_CODES = new Set(
  (
    '1 7 20 27 30 31 32 33 34 36 39 40 41 43 44 45 46 47 48 49 51 52 53 54 55 ' +
    '56 57 58 60 61 62 63 64 65 66 81 82 84 86 90 91 92 93 94 95 98 211 212 213 ' +
    '216 218 220 221 222 223 224 225 226 227 228 229 230 231 232 233 234 235 ' +
    '236 237 238 239 240 241 242 243 244 245 246 247 248 249 250 251 252 253 ' +
    '254 255 256 257 258 260 261 262 263 264 265 266 267 268 269 290 291 297 ' +
    '298 299 350 351 352 353 354 355 356 357 358 359 370 371 372 373 374 375 ' +
    '376 377 378 380 381 382 383 385 386 387 389 420 421 423 500 501 502 503 ' +
    '504 505 506 507 508 509 590 591 592 593 594 595 596 597 598 599 670 672 ' +
    '673 674 675 676 677 678 679 680 681 682 683 685 686 687 688 689 690 691 ' +
    '692 850 852 853 855 856 880 886 960 961 962 963 964 965 966 967 968 970 ' +
    '971 972 973 974 975 976 977 992 993 994 995 996 998'
  ).split(' '),
)

/**
 * How a phone number is shown. An Israeli number is written the way it is
 * dialled locally — "050-730-8828", "03-123-4567". A Brazilian number keeps
 * its country code, with the area code and number set apart:
 * "+55 11 91234-5678", "+55 11 3123-4567". Any other number keeps its
 * international form with the country code set apart: "+1 2125550123".
 *
 * Takes the canonical form returned by `normalizePhone`.
 */
export function formatPhone(normalizedPhone: string): string {
  const digits = normalizedPhone.replace(/^\+/, '')
  if (digits.startsWith(ISRAEL_COUNTRY_CODE)) {
    const national = digits.slice(ISRAEL_COUNTRY_CODE.length)
    if (national.length === 9) {
      return `0${national.slice(0, 2)}-${national.slice(2, 5)}-${national.slice(5)}`
    }
    if (national.length === 8) {
      return `0${national.slice(0, 1)}-${national.slice(1, 4)}-${national.slice(4)}`
    }
  }
  if (digits.startsWith(BRAZIL_COUNTRY_CODE)) {
    const national = digits.slice(BRAZIL_COUNTRY_CODE.length)
    if (national.length === 10 || national.length === 11) {
      const split = national.length - 4
      return `+55 ${national.slice(0, 2)} ${national.slice(2, split)}-${national.slice(split)}`
    }
  }
  for (const length of [1, 2, 3]) {
    const code = digits.slice(0, length)
    if (CALLING_CODES.has(code)) {
      return `+${code} ${digits.slice(length)}`
    }
  }
  return `+${digits}`
}
