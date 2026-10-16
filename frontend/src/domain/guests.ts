import { assertIntegerInRange, assertNonEmpty, DomainError } from './errors.ts'
import { EVENT_LIMITS } from './events.ts'
import type { Event, Guest, Id, IsoDateTime } from './models.ts'
import { formatPhone, normalizePhone, type Country } from './phone.ts'

export interface GuestInput {
  firstName: string
  lastName: string
  phone: string
  allowedAttendees: number
  /** Optional; empty or missing means the guest is in no group. */
  group?: string | null
}

export const GROUP_MAX_LENGTH = 40

interface GuestFields extends GuestInput {
  normalizedPhone: string
  group: string | null
}

function validateGroup(value: string | null | undefined): string | null {
  const group = value?.trim() ?? ''
  if (group.length > GROUP_MAX_LENGTH) {
    throw new DomainError('VALIDATION', { field: 'group' })
  }
  return group === '' ? null : group
}

function validateGuestInput(input: GuestInput, country: Country): GuestFields {
  const firstName = assertNonEmpty(input.firstName, 'firstName')
  assertIntegerInRange(
    input.allowedAttendees,
    EVENT_LIMITS.allowedAttendees.min,
    EVENT_LIMITS.allowedAttendees.max,
    'allowedAttendees',
  )
  const normalizedPhone = normalizePhone(input.phone, country)
  return {
    firstName,
    lastName: input.lastName.trim(),
    // Kept in the form it is shown in, however it was typed.
    phone: formatPhone(normalizedPhone),
    normalizedPhone,
    allowedAttendees: input.allowedAttendees,
    group: validateGroup(input.group),
  }
}

/** The groups in use among an event's active guests, in alphabetical order. */
export function listGroups(guests: readonly Guest[]): string[] {
  const groups = new Set<string>()
  for (const guest of guests) {
    if (!guest.deleted && guest.group !== null) {
      groups.add(guest.group)
    }
  }
  return [...groups].sort((a, b) => a.localeCompare(b))
}

/**
 * A group typed with different capitals is the group that already exists, so
 * "family" joins "Family" instead of starting a second one.
 */
function existingSpelling(
  guests: readonly Guest[],
  eventId: Id,
  group: string | null,
): string | null {
  if (group === null) {
    return null
  }
  const wanted = group.toLocaleLowerCase()
  return (
    listGroups(guests.filter((guest) => guest.eventId === eventId)).find(
      (existing) => existing.toLocaleLowerCase() === wanted,
    ) ?? group
  )
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
  event: Pick<Event, 'id' | 'country'>,
  input: GuestInput,
  newId: Id,
): AddGuestResult {
  const eventId = event.id
  const fields = validateGuestInput(input, event.country)
  fields.group = existingSpelling(guests, eventId, fields.group)
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
  country: Country,
): Guest {
  const fields = validateGuestInput(input, country)
  const others = guests.filter((candidate) => candidate.id !== guest.id)
  fields.group = existingSpelling(others, guest.eventId, fields.group)
  const other = findByPhone(others, guest.eventId, fields.normalizedPhone)
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

/**
 * The group several guests of one event are moved to at once; `null` takes
 * them out of their groups. A guest who already has a group changes group.
 */
export function resolveGroup(
  guests: readonly Guest[],
  eventId: Id,
  group: string | null,
): string | null {
  return existingSpelling(guests, eventId, validateGroup(group))
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
