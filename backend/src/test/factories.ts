import type { Event, EventTable, Guest } from '../domain/models.ts'

export function makeEvent(overrides: Partial<Event> = {}): Event {
  return {
    id: 'evt-1',
    name: 'Garden Celebration',
    startsAt: '2030-06-15T15:30:00.000Z',
    timeZone: 'Asia/Jerusalem',
    maxAttendees: 300,
    defaultAllowedAttendees: 5,
    rsvpLanguage: 'en',
    country: 'IL',
    location: null,
    rsvpTitle: null,
    coverImage: null,
    rsvpSlug: 'garden',
    ...overrides,
  }
}

let guestCounter = 0

export function makeGuest(overrides: Partial<Guest> = {}): Guest {
  guestCounter += 1
  const suffix = String(guestCounter).padStart(4, '0')
  return {
    id: `g-${suffix}`,
    eventId: 'evt-1',
    firstName: 'Jordan',
    lastName: 'Reed',
    invitationName: null,
    phone: `+972 00-001-${suffix}`,
    normalizedPhone: `+97200001${suffix}`,
    allowedAttendees: 5,
    confirmedAttendees: null,
    rsvpStatus: 'NO_RESPONSE',
    invitationSentCount: 0,
    lastInvitationSentAt: null,
    lastRsvpResponseAt: null,
    tableId: null,
    group: null,
    deleted: false,
    ...overrides,
  }
}

export function makeApprovedGuest(
  confirmedAttendees: number,
  overrides: Partial<Guest> = {},
): Guest {
  return makeGuest({
    rsvpStatus: 'APPROVED',
    confirmedAttendees,
    invitationSentCount: 1,
    lastInvitationSentAt: '2030-01-01T10:00:00.000Z',
    lastRsvpResponseAt: '2030-01-02T10:00:00.000Z',
    ...overrides,
  })
}

export function makeTable(overrides: Partial<EventTable> = {}): EventTable {
  return {
    id: 't-1',
    eventId: 'evt-1',
    number: 1,
    capacity: 10,
    shape: 'CIRCLE',
    ...overrides,
  }
}
