import { isEventPast } from './eventTime.ts'
import type { Id, IsoDateTime } from './models.ts'
import type { VenueEventRole } from './roles.ts'

/**
 * Venues (V2.2, PRD section 20, D111–D118). A venue organization rents out
 * spaces, creates events in them and shares each event with a client. These
 * rules are pure; the demo provider applies them now and the backend will
 * enforce the same ones.
 */

/** A user's role in a venue organization (D112). */
export type VenueMemberRole = Extract<
  VenueEventRole,
  'VENUE_OWNER' | 'VENUE_MANAGER'
>

export const VENUE_MEMBER_ROLES = [
  'VENUE_OWNER',
  'VENUE_MANAGER',
] as const satisfies readonly VenueMemberRole[]

export type VenueLanguage = 'en' | 'he' | 'pt'

export interface VenueOrganization {
  id: Id
  name: string
  /** The language new events start with. */
  defaultLanguage: VenueLanguage
  /** Shown to the venue's clients in "Contact the venue" (D117). */
  contactEmail: string | null
  contactPhone: string | null
}

export interface VenueMember {
  organizationId: Id
  userId: Id
  role: VenueMemberRole
}

/** A room or area the venue rents out. */
export interface VenueSpace {
  id: Id
  organizationId: Id
  name: string
  address: string
  /** People, not chairs; copied to each new event as its maximum attendees. */
  maxPeople: number
  /** For information only: more tables only warn (D111). */
  maxTables: number | null
  timeZone: string
  /** A JPEG or PNG data address; null for the generated cover. */
  photo: string | null
  /** Hidden from new events; archiving never touches existing ones. */
  archived: boolean
}

/** How long a client invitation can be accepted. */
export const CLIENT_INVITATION_DAYS = 7

/** The client a venue invited to one of its events. */
export interface ClientInvitation {
  name: string
  email: string
  sentAt: IsoDateTime
  /** The client accepted with the account of this address (D113). */
  acceptedAt: IsoDateTime | null
}

/** What makes an event venue-managed: the venue, the space and the client. */
export interface VenueEvent {
  eventId: Id
  organizationId: Id
  spaceId: Id
  /** The layout template the event's own copy came from, if any. */
  templateId: Id | null
  client: ClientInvitation | null
}

/** How a venue-managed event stands, as the venue sees it (D115). */
export type VenueEventStatus =
  | 'AWAITING_CLIENT'
  | 'INVITATION_SENT'
  | 'INVITATION_EXPIRED'
  | 'CLIENT_JOINED'
  | 'PAST'

const DAY_MS = 86_400_000

/** When an invitation stops being accepted. */
export function invitationExpiresAt(invitation: ClientInvitation): Date {
  return new Date(
    new Date(invitation.sentAt).getTime() + CLIENT_INVITATION_DAYS * DAY_MS,
  )
}

/**
 * A past event is Past whatever its client did; otherwise the client's
 * invitation decides.
 */
export function venueEventStatus(
  venueEvent: Pick<VenueEvent, 'client'>,
  event: { startsAt: IsoDateTime },
  now: Date,
): VenueEventStatus {
  if (isEventPast(event, now)) {
    return 'PAST'
  }
  const { client } = venueEvent
  if (client === null) {
    return 'AWAITING_CLIENT'
  }
  if (client.acceptedAt !== null) {
    return 'CLIENT_JOINED'
  }
  return now < invitationExpiresAt(client)
    ? 'INVITATION_SENT'
    : 'INVITATION_EXPIRED'
}

/** What a venue member does in their organization (D112). */
export type VenueAction =
  /** See the venue's events, spaces and team. */
  | 'VIEW_VENUE'
  /** Create and edit spaces and their layouts. */
  | 'MANAGE_SPACES'
  /** Create venue events and invite their clients. */
  | 'MANAGE_EVENTS'
  /** Add and remove members, and change their roles. */
  | 'MANAGE_TEAM'
  /** The organization's name, language and contact details. */
  | 'MANAGE_SETTINGS'

const MANAGER_ACTIONS: ReadonlySet<VenueAction> = new Set([
  'VIEW_VENUE',
  'MANAGE_SPACES',
  'MANAGE_EVENTS',
])

/** The Owner may do everything; a Manager all but the team and settings. */
export function venueCan(
  role: VenueMemberRole | null,
  action: VenueAction,
): boolean {
  if (role === 'VENUE_OWNER') {
    return true
  }
  return role === 'VENUE_MANAGER' && MANAGER_ACTIONS.has(action)
}
