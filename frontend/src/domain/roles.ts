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
