export const EVENT_ROLES = ['OWNER', 'ADMIN', 'VIEWER'] as const

export type EventRole = (typeof EVENT_ROLES)[number]

/**
 * Roles in a venue-managed event (V2.2, D112–D113). The venue side comes from
 * the user's membership of the venue organization; the client side from the
 * event's client team. They exist only in venue-managed events; a personal
 * event keeps the roles above.
 */
export const VENUE_EVENT_ROLES = [
  'VENUE_OWNER',
  'VENUE_MANAGER',
  'CLIENT_LEAD',
  'CLIENT_EDITOR',
  'CLIENT_VIEWER',
] as const

export type VenueEventRole = (typeof VENUE_EVENT_ROLES)[number]

/** Any role a user can hold in an event, personal or venue-managed. */
export type AnyEventRole = EventRole | VenueEventRole

/** The venue's side of a venue-managed event (D112). */
export function isVenueSide(role: AnyEventRole | null): boolean {
  return role === 'VENUE_OWNER' || role === 'VENUE_MANAGER'
}

/** The client's side of a venue-managed event (D113). */
export function isClientSide(role: AnyEventRole | null): boolean {
  return (
    role === 'CLIENT_LEAD' ||
    role === 'CLIENT_EDITOR' ||
    role === 'CLIENT_VIEWER'
  )
}
