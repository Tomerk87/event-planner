import { assertNonEmpty, DomainError } from './errors.ts'
import { EVENT_LIMITS } from './events.ts'
import type {
  Event,
  Guest,
  IsoDateTime,
  RsvpResponse,
  RsvpStatus,
} from './models.ts'

export interface RsvpOutcome {
  rsvpStatus: RsvpStatus
  confirmedAttendees: number | null
}

/**
 * The stored result of an RSVP (PRD section 8.3).
 *
 * Approved keeps the attendee count, which must be a whole number from 1 to
 * the event's Maximum Attendees per Guest (D104; a guest's Expected
 * Attendees is the organizer's planning note and limits nothing). Declined
 * stores 0. Not Sure and No Response store nothing.
 * Any count supplied with those statuses is discarded.
 */
export function resolveRsvp(
  status: RsvpStatus,
  attendees: number | null,
  maxPerGuest: number,
): RsvpOutcome {
  if (status === 'APPROVED') {
    if (
      attendees === null ||
      !Number.isInteger(attendees) ||
      attendees < 1 ||
      attendees > maxPerGuest
    ) {
      throw new DomainError('INVALID_ATTENDEE_COUNT', {
        min: 1,
        max: maxPerGuest,
      })
    }
    return { rsvpStatus: 'APPROVED', confirmedAttendees: attendees }
  }
  if (status === 'DECLINED') {
    return { rsvpStatus: 'DECLINED', confirmedAttendees: 0 }
  }
  return { rsvpStatus: status, confirmedAttendees: null }
}

/**
 * The limit for an answer already given, such as an unknown response being
 * added as a guest or matched to one: the event's maximum per guest, or the
 * answer itself when the maximum was lowered after it was given (D104).
 */
export function answeredLimit(
  event: Pick<Event, 'defaultAllowedAttendees'>,
  confirmedAttendees: number | null,
): number {
  return Math.max(event.defaultAllowedAttendees, confirmedAttendees ?? 0)
}

/**
 * Applies an RSVP to a guest. Leaving Approved clears the table assignment;
 * an increase that overfills the table is accepted (the conflict is derived
 * from the data afterwards).
 */
export function applyRsvp(
  guest: Guest,
  outcome: RsvpOutcome,
  respondedAt: IsoDateTime,
): Guest {
  return {
    ...guest,
    rsvpStatus: outcome.rsvpStatus,
    confirmedAttendees: outcome.confirmedAttendees,
    tableId: outcome.rsvpStatus === 'APPROVED' ? guest.tableId : null,
    lastRsvpResponseAt: respondedAt,
  }
}

export interface PublicRsvpInput {
  name: string
  phone: string
  status: RsvpResponse
  /** Always required on the public form, whichever response is chosen. */
  attendees: number
}

const RESPONSES: readonly RsvpResponse[] = ['APPROVED', 'NOT_SURE', 'DECLINED']

/**
 * Checks the parts of a public submission that do not depend on who the
 * guest is. The event's maximum per guest is checked by `resolveRsvp`.
 */
export function validatePublicRsvpInput(input: PublicRsvpInput): {
  name: string
} {
  const name = assertNonEmpty(input.name, 'name')
  if (!RESPONSES.includes(input.status)) {
    throw new DomainError('VALIDATION', { field: 'status' })
  }
  if (
    !Number.isInteger(input.attendees) ||
    input.attendees < 1 ||
    input.attendees > EVENT_LIMITS.allowedAttendees.max
  ) {
    throw new DomainError('INVALID_ATTENDEE_COUNT', {
      min: 1,
      max: EVENT_LIMITS.allowedAttendees.max,
    })
  }
  return { name }
}
