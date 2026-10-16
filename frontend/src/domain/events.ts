import { assertIntegerInRange, assertNonEmpty, DomainError } from './errors.ts'
import { isValidTimeZone } from './eventTime.ts'
import {
  isRsvpLanguage,
  type Event,
  type IsoDateTime,
  type RsvpLanguage,
} from './models.ts'
import { isCountry, type Country } from './phone.ts'

export const EVENT_LIMITS = {
  maxAttendees: { min: 50, max: 3000, default: 50 },
  allowedAttendees: { min: 1, max: 10, default: 5 },
} as const

export interface EventInput {
  name: string
  startsAt: IsoDateTime
  timeZone: string
  maxAttendees: number
  defaultAllowedAttendees: number
  rsvpLanguage: RsvpLanguage
  country: Country
  location?: string | null
  rsvpTitle?: string | null
  /** A JPEG or PNG data address; null for the generated cover. Left out, it is unchanged. */
  coverImage?: string | null
}

/** Largest stored event photo, in characters of its data address. */
export const COVER_IMAGE_MAX_LENGTH = 300_000

/** Checks an event photo: a JPEG or PNG data address of limited size. */
export function validateCoverImage(value: string | null): string | null {
  if (
    value !== null &&
    (!/^data:image\/(jpeg|png);base64,/.test(value) ||
      value.length > COVER_IMAGE_MAX_LENGTH)
  ) {
    throw new DomainError('VALIDATION', { field: 'coverImage' })
  }
  return value
}

type EventFields = Omit<Event, 'id' | 'rsvpSlug' | 'coverImage'>

function optionalText(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? ''
  return trimmed === '' ? null : trimmed
}

/** Validates and tidies event fields; throws VALIDATION naming the field. */
export function validateEventInput(input: EventInput): EventFields {
  const name = assertNonEmpty(input.name, 'name')
  assertIntegerInRange(
    input.maxAttendees,
    EVENT_LIMITS.maxAttendees.min,
    EVENT_LIMITS.maxAttendees.max,
    'maxAttendees',
  )
  assertIntegerInRange(
    input.defaultAllowedAttendees,
    EVENT_LIMITS.allowedAttendees.min,
    EVENT_LIMITS.allowedAttendees.max,
    'defaultAllowedAttendees',
  )
  if (Number.isNaN(new Date(input.startsAt).getTime())) {
    throw new DomainError('VALIDATION', { field: 'startsAt' })
  }
  if (!isValidTimeZone(input.timeZone)) {
    throw new DomainError('VALIDATION', { field: 'timeZone' })
  }
  if (!isRsvpLanguage(input.rsvpLanguage)) {
    throw new DomainError('VALIDATION', { field: 'rsvpLanguage' })
  }
  if (!isCountry(input.country)) {
    throw new DomainError('VALIDATION', { field: 'country' })
  }

  return {
    name,
    startsAt: new Date(input.startsAt).toISOString(),
    timeZone: input.timeZone,
    maxAttendees: input.maxAttendees,
    defaultAllowedAttendees: input.defaultAllowedAttendees,
    rsvpLanguage: input.rsvpLanguage,
    country: input.country,
    location: optionalText(input.location),
    rsvpTitle: optionalText(input.rsvpTitle),
  }
}

/**
 * A new event must start in the future: from its start an event is past and
 * read-only, so one created in the past could never be set up.
 */
export function assertStartsInFuture(startsAt: IsoDateTime, now: Date): void {
  if (!(new Date(startsAt).getTime() > now.getTime())) {
    throw new DomainError('VALIDATION', { field: 'startsAt', reason: 'past' })
  }
}

/**
 * The values Maximum Attendees may take for an event: never fewer than the
 * attendees who have already confirmed (D94).
 */
export function maxAttendeesRange(confirmedAttendees: number): {
  min: number
  max: number
} {
  const { min, max } = EVENT_LIMITS.maxAttendees
  return { min: Math.min(Math.max(min, confirmedAttendees), max), max }
}

/**
 * A changed maximum must leave room for the attendees who have already
 * confirmed. An unchanged one is kept even when later answers went past it,
 * so the rest of the event can still be edited (D94).
 */
export function assertMaxAttendeesCoversConfirmed(
  maxAttendees: number,
  currentMaxAttendees: number,
  confirmedAttendees: number,
): void {
  if (maxAttendees === currentMaxAttendees) {
    return
  }
  const range = maxAttendeesRange(confirmedAttendees)
  if (maxAttendees < range.min) {
    throw new DomainError('VALIDATION', { field: 'maxAttendees', ...range })
  }
}
