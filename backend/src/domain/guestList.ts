import type { EventTable, Guest, Id, RsvpStatus } from './models.ts'

export const GUEST_SORT_KEYS = [
  'name',
  'invitationName',
  'phone',
  'allowed',
  'confirmed',
  'status',
  'sent',
  'table',
  'group',
] as const

export type GuestSortKey = (typeof GUEST_SORT_KEYS)[number]

export interface GuestSort {
  key: GuestSortKey
  direction: 'asc' | 'desc'
}

export const DEFAULT_GUEST_SORT: GuestSort = { key: 'name', direction: 'asc' }

export interface GuestFilters {
  /** Free text: a name, an invitation name or part of a phone number. */
  query: string
  rsvp: 'ALL' | RsvpStatus
  invitation: 'ALL' | 'SENT' | 'NOT_SENT'
  /** A table id, `NONE` for guests without a table, or `ALL`. */
  table: 'ALL' | 'NONE' | Id
  /** A group's name, `''` for guests in no group, or null for everyone. */
  group: string | null
}

export const NO_GUEST_FILTERS: GuestFilters = {
  query: '',
  rsvp: 'ALL',
  invitation: 'ALL',
  table: 'ALL',
  group: null,
}

export function hasActiveFilters(filters: GuestFilters): boolean {
  return (
    filters.query.trim() !== '' ||
    filters.rsvp !== 'ALL' ||
    filters.invitation !== 'ALL' ||
    filters.table !== 'ALL' ||
    filters.group !== null
  )
}

export function guestFullName(
  guest: Pick<Guest, 'firstName' | 'lastName'>,
): string {
  return `${guest.firstName} ${guest.lastName}`.trim()
}

function digitsOf(value: string): string {
  return value.replace(/\D/g, '')
}

/**
 * Whether a guest matches the search text: by first name, last name, full
 * name in either order, invitation name, group, or phone. A phone can be typed in
 * any format, local ("050…") or international ("+972 50…").
 */
export function matchesGuestQuery(
  guest: Guest,
  query: string,
  locale: string,
): boolean {
  const needle = query.trim().toLocaleLowerCase(locale)
  if (needle === '') {
    return true
  }
  const texts = [
    guest.firstName,
    guest.lastName,
    `${guest.firstName} ${guest.lastName}`,
    `${guest.lastName} ${guest.firstName}`,
    guest.invitationName ?? '',
    guest.group ?? '',
  ]
  if (texts.some((text) => text.toLocaleLowerCase(locale).includes(needle))) {
    return true
  }
  const typedDigits = digitsOf(needle)
  if (typedDigits.length < 2 || /[^\d\s+\-().]/.test(needle)) {
    return false
  }
  const stored = [digitsOf(guest.phone), digitsOf(guest.normalizedPhone)]
  // A local number's leading zero is absent from the international form.
  const candidates = [typedDigits, typedDigits.replace(/^0+/, '')].filter(
    (candidate) => candidate.length >= 2,
  )
  return candidates.some((candidate) =>
    stored.some((phone) => phone.includes(candidate)),
  )
}

export function filterGuests(
  guests: readonly Guest[],
  filters: GuestFilters,
  locale: string,
): Guest[] {
  return guests.filter(
    (guest) =>
      !guest.deleted &&
      (filters.rsvp === 'ALL' || guest.rsvpStatus === filters.rsvp) &&
      (filters.invitation === 'ALL' ||
        guest.invitationSentCount > 0 === (filters.invitation === 'SENT')) &&
      (filters.table === 'ALL' ||
        (filters.table === 'NONE'
          ? guest.tableId === null
          : guest.tableId === filters.table)) &&
      (filters.group === null || (guest.group ?? '') === filters.group) &&
      matchesGuestQuery(guest, filters.query, locale),
  )
}

const STATUS_ORDER: Record<RsvpStatus, number> = {
  APPROVED: 0,
  NOT_SURE: 1,
  DECLINED: 2,
  NO_RESPONSE: 3,
}

/** Compares two optional numbers; a missing value always sorts last. */
function compareOptional(
  a: number | null,
  b: number | null,
  direction: 1 | -1,
): number {
  if (a === null || b === null) {
    return a === b ? 0 : a === null ? 1 : -1
  }
  return (a - b) * direction
}

/** Sorts a copy of the guests; ties are broken by name, then id, so the order is stable. */
export function sortGuests(
  guests: readonly Guest[],
  sort: GuestSort,
  tables: readonly EventTable[],
  locale: string,
): Guest[] {
  const direction = sort.direction === 'asc' ? 1 : -1
  const collator = new Intl.Collator(locale, { sensitivity: 'base' })
  const tableNumbers = new Map(tables.map((table) => [table.id, table.number]))
  const tableNumber = (guest: Guest) =>
    guest.tableId === null ? null : (tableNumbers.get(guest.tableId) ?? null)
  const byName = (a: Guest, b: Guest) =>
    collator.compare(guestFullName(a), guestFullName(b))

  function compare(a: Guest, b: Guest): number {
    switch (sort.key) {
      case 'name':
        return byName(a, b) * direction
      case 'invitationName': {
        const [first, second] = [a.invitationName, b.invitationName]
        if (first === null || second === null) {
          return first === second ? 0 : first === null ? 1 : -1
        }
        return collator.compare(first, second) * direction
      }
      case 'phone':
        return a.normalizedPhone.localeCompare(b.normalizedPhone) * direction
      case 'group': {
        // Guests in no group always come last.
        if (a.group === null || b.group === null) {
          return a.group === b.group ? 0 : a.group === null ? 1 : -1
        }
        return collator.compare(a.group, b.group) * direction
      }
      case 'allowed':
        return (a.allowedAttendees - b.allowedAttendees) * direction
      case 'confirmed':
        return compareOptional(
          a.confirmedAttendees,
          b.confirmedAttendees,
          direction,
        )
      case 'status':
        return (
          (STATUS_ORDER[a.rsvpStatus] - STATUS_ORDER[b.rsvpStatus] ||
            Number(b.invitationSentCount > 0) -
              Number(a.invitationSentCount > 0)) * direction
        )
      case 'sent':
        return (a.invitationSentCount - b.invitationSentCount) * direction
      case 'table':
        return compareOptional(tableNumber(a), tableNumber(b), direction)
    }
  }

  return [...guests].sort(
    (a, b) => compare(a, b) || byName(a, b) || a.id.localeCompare(b.id),
  )
}
