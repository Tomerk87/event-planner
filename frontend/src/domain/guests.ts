import { assertIntegerInRange, assertNonEmpty, DomainError } from './errors.ts'
import { EVENT_LIMITS } from './events.ts'
import type { Guest, Id, IsoDateTime } from './models.ts'
import { formatPhone, normalizePhone } from './phone.ts'

export interface GuestInput {
  firstName: string
  lastName: string
  phone: string
  allowedAttendees: number
}

interface GuestFields extends GuestInput {
  normalizedPhone: string
}

function validateGuestInput(input: GuestInput): GuestFields {
  const firstName = assertNonEmpty(input.firstName, 'firstName')
  assertIntegerInRange(
    input.allowedAttendees,
    EVENT_LIMITS.allowedAttendees.min,
    EVENT_LIMITS.allowedAttendees.max,
    'allowedAttendees',
  )
  const normalizedPhone = normalizePhone(input.phone)
  return {
    firstName,
    lastName: input.lastName.trim(),
    // Kept in the form it is shown in, however it was typed.
    phone: formatPhone(normalizedPhone),
    normalizedPhone,
    allowedAttendees: input.allowedAttendees,
  }
}

function findByPhone(
  guests: readonly Guest[],
  eventId: Id,
  normalizedPhone: string,
): Guest | undefined {
  return guests.find(
    (guest) =>
      guest.eventId === eventId && guest.normalizedPhone === normalizedPhone,
  )
}

export interface AddGuestResult {
  guest: Guest
  /** True when a soft-deleted record was reactivated instead of a new one created. */
  restored: boolean
}

/**
 * Adds a guest to an event (PRD sections 6.1–6.2).
 *
 * A phone already used by an active guest is rejected. A phone belonging to a
 * soft-deleted guest restores that record: names, phone and allowance come
 * from the new entry, the RSVP is reset to No Response with no table, and the
 * invitation counter is kept because it never decreases.
 */
export function addGuest(
  guests: readonly Guest[],
  eventId: Id,
  input: GuestInput,
  newId: Id,
): AddGuestResult {
  const fields = validateGuestInput(input)
  const existing = findByPhone(guests, eventId, fields.normalizedPhone)

  if (existing && !existing.deleted) {
    throw new DomainError('DUPLICATE_PHONE')
  }

  if (existing) {
    return {
      restored: true,
      guest: {
        ...existing,
        ...fields,
        invitationName: null,
        rsvpStatus: 'NO_RESPONSE',
        confirmedAttendees: null,
        lastRsvpResponseAt: null,
        tableId: null,
        deleted: false,
      },
    }
  }

  return {
    restored: false,
    guest: {
      id: newId,
      eventId,
      ...fields,
      invitationName: null,
      confirmedAttendees: null,
      rsvpStatus: 'NO_RESPONSE',
      invitationSentCount: 0,
      lastInvitationSentAt: null,
      lastRsvpResponseAt: null,
      tableId: null,
      deleted: false,
    },
  }
}

/**
 * Edits the organizer-controlled fields of a guest. The phone must stay
 * unique among the event's active guests, and the allowance cannot drop below
 * an attendee count the guest has already confirmed.
 */
export function editGuest(
  guests: readonly Guest[],
  guest: Guest,
  input: GuestInput,
): Guest {
  const fields = validateGuestInput(input)
  const other = findByPhone(
    guests.filter((candidate) => candidate.id !== guest.id),
    guest.eventId,
    fields.normalizedPhone,
  )
  if (other && !other.deleted) {
    throw new DomainError('DUPLICATE_PHONE')
  }
  if (
    guest.rsvpStatus === 'APPROVED' &&
    (guest.confirmedAttendees ?? 0) > fields.allowedAttendees
  ) {
    throw new DomainError('INVALID_ATTENDEE_COUNT', {
      min: guest.confirmedAttendees ?? 1,
      max: EVENT_LIMITS.allowedAttendees.max,
    })
  }
  return { ...guest, ...fields }
}

/** Soft-deletes a guest and frees their seats. */
export function softDeleteGuest(guest: Guest): Guest {
  return { ...guest, deleted: true, tableId: null }
}

/** Records one WhatsApp send initiated from the system. */
export function recordInvitationSent(guest: Guest, sentAt: IsoDateTime): Guest {
  return {
    ...guest,
    invitationSentCount: guest.invitationSentCount + 1,
    lastInvitationSentAt: sentAt,
  }
}
