import { assertIntegerInRange, assertNonEmpty, DomainError } from './errors.ts'
import { isValidTimeZone } from './eventTime.ts'
import type { Event, IsoDateTime, RsvpLanguage } from './models.ts'

export const EVENT_LIMITS = {
  maxAttendees: { min: 50, max: 3000, default: 300 },
  allowedAttendees: { min: 1, max: 10, default: 5 },
} as const

export interface EventInput {
  name: string
  startsAt: IsoDateTime
  timeZone: string
  maxAttendees: number
  defaultAllowedAttendees: number
  rsvpLanguage: RsvpLanguage
  location?: string | null
  rsvpTitle?: string | null
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
  if (input.rsvpLanguage !== 'en' && input.rsvpLanguage !== 'he') {
    throw new DomainError('VALIDATION', { field: 'rsvpLanguage' })
  }

  return {
    name,
    startsAt: new Date(input.startsAt).toISOString(),
    timeZone: input.timeZone,
    maxAttendees: input.maxAttendees,
    defaultAllowedAttendees: input.defaultAllowedAttendees,
    rsvpLanguage: input.rsvpLanguage,
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
