import { assertEmail } from './accounts.ts'
import { assertIntegerInRange, assertNonEmpty, DomainError } from './errors.ts'
import { isEventPast, isValidTimeZone } from './eventTime.ts'
import { EVENT_LIMITS, validateCoverImage } from './events.ts'
import type { Id, IsoDateTime, TableShape, VenueObject } from './models.ts'
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
  /** When they joined the venue; absent in data saved before Phase 25b. */
  since?: IsoDateTime
}

/** Someone invited to a venue's team who has not joined yet (D112). */
export interface VenueMemberInvitation {
  organizationId: Id
  /** Stored normalized: trimmed and in lower case. */
  email: string
  role: VenueMemberRole
  sentAt: IsoDateTime
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

/** A table of a layout template: its number, chairs, shape and place. */
export interface TemplateTable {
  number: number
  capacity: number
  shape: TableShape
  /** The table's centre in centimetres; null while not placed. */
  x: number | null
  y: number | null
  rotation: number
}

/**
 * A named, editable floor plan of a space (D111). An event created from it
 * gets its own copy, so editing a template never changes an event.
 */
export interface LayoutTemplate {
  id: Id
  spaceId: Id
  name: string
  roomWidth: number
  roomDepth: number
  tables: TemplateTable[]
  objects: VenueObject[]
  updatedAt: IsoDateTime
  /** Hidden from new events; events already made from it keep their copy. */
  archived: boolean
}

export interface TemplateFigures {
  tables: number
  chairs: number
  /** Chairs beyond the space's maximum people; 0 when within it. */
  extraChairs: number
  /** Tables beyond the space's maximum tables (for information); 0 when within or unset. */
  extraTables: number
}

/**
 * A template's tables and chairs against its space. Going beyond only warns
 * (D111): nothing is blocked.
 */
export function templateFigures(
  template: Pick<LayoutTemplate, 'tables'>,
  space: Pick<VenueSpace, 'maxPeople' | 'maxTables'>,
): TemplateFigures {
  const tables = template.tables.length
  const chairs = template.tables.reduce((sum, table) => sum + table.capacity, 0)
  return {
    tables,
    chairs,
    extraChairs: Math.max(0, chairs - space.maxPeople),
    extraTables:
      space.maxTables === null ? 0 : Math.max(0, tables - space.maxTables),
  }
}

/** What a venue enters to create or change a space (mockup #4). */
export interface SpaceInput {
  name: string
  address: string
  maxPeople: number
  maxTables: number | null
  timeZone: string
  /** A JPEG or PNG data address; null for the generated cover. Left out, unchanged. */
  photo?: string | null
}

export const SPACE_NAME_MAX_LENGTH = 80
export const SPACE_ADDRESS_MAX_LENGTH = 160
/** A space can hold at most this many tables, even for information. */
export const SPACE_MAX_TABLES = 500

/** Checks a space; its name must be new within the venue, ignoring case. */
export function validateSpaceInput(
  input: SpaceInput,
  otherNames: readonly string[],
): Omit<SpaceInput, 'photo'> {
  const name = assertNonEmpty(input.name, 'name')
  if (name.length > SPACE_NAME_MAX_LENGTH) {
    throw new DomainError('VALIDATION', { field: 'name' })
  }
  if (
    otherNames.some(
      (other) => other.trim().toLowerCase() === name.toLowerCase(),
    )
  ) {
    throw new DomainError('VALIDATION', { field: 'name', reason: 'duplicate' })
  }
  const address = assertNonEmpty(input.address, 'address')
  if (address.length > SPACE_ADDRESS_MAX_LENGTH) {
    throw new DomainError('VALIDATION', { field: 'address' })
  }
  // People, as an event's maximum attendees: the same range (D110).
  assertIntegerInRange(
    input.maxPeople,
    1,
    EVENT_LIMITS.maxAttendees.max,
    'maxPeople',
  )
  if (input.maxTables !== null) {
    assertIntegerInRange(input.maxTables, 1, SPACE_MAX_TABLES, 'maxTables')
  }
  if (!isValidTimeZone(input.timeZone)) {
    throw new DomainError('VALIDATION', { field: 'timeZone' })
  }
  return {
    name,
    address,
    maxPeople: input.maxPeople,
    maxTables: input.maxTables,
    timeZone: input.timeZone,
  }
}

/** Checks a space photo, like an event photo. */
export const validateSpacePhoto = validateCoverImage

/** The venue's own details (Venue Settings, D117). */
export interface OrganizationInput {
  name: string
  defaultLanguage: VenueLanguage
  contactEmail: string | null
  contactPhone: string | null
}

export const ORGANIZATION_NAME_MAX_LENGTH = 80
export const CONTACT_PHONE_MAX_LENGTH = 30

export function validateOrganizationInput(
  input: OrganizationInput,
): OrganizationInput {
  const name = assertNonEmpty(input.name, 'name')
  if (name.length > ORGANIZATION_NAME_MAX_LENGTH) {
    throw new DomainError('VALIDATION', { field: 'name' })
  }
  if (!['en', 'he', 'pt'].includes(input.defaultLanguage)) {
    throw new DomainError('VALIDATION', { field: 'defaultLanguage' })
  }
  const email = input.contactEmail?.trim() ?? ''
  const phone = input.contactPhone?.trim() ?? ''
  if (phone.length > CONTACT_PHONE_MAX_LENGTH) {
    throw new DomainError('VALIDATION', { field: 'contactPhone' })
  }
  let contactEmail: string | null = null
  if (email !== '') {
    try {
      contactEmail = assertEmail(email)
    } catch {
      throw new DomainError('VALIDATION', { field: 'contactEmail' })
    }
  }
  return {
    name,
    defaultLanguage: input.defaultLanguage,
    contactEmail,
    contactPhone: phone === '' ? null : phone,
  }
}

/**
 * Checks a change to a venue's team (D112): only the Owner manages it, nobody
 * changes or removes themselves, and a venue always keeps an Owner.
 */
export function assertCanChangeVenueMember(
  actor: { userId: Id; role: VenueMemberRole | null },
  members: readonly Pick<VenueMember, 'userId' | 'role'>[],
  change: { userId: Id; newRole: VenueMemberRole | null },
): void {
  if (!venueCan(actor.role, 'MANAGE_TEAM')) {
    throw new DomainError('FORBIDDEN', { action: 'MANAGE_TEAM' })
  }
  const current = members.find((member) => member.userId === change.userId)
  if (!current) {
    throw new DomainError('NOT_FOUND', { entity: 'member' })
  }
  if (change.userId === actor.userId) {
    throw new DomainError('SELF_PERMISSION')
  }
  const owners = members.filter((member) => member.role === 'VENUE_OWNER')
  if (
    current.role === 'VENUE_OWNER' &&
    change.newRole !== 'VENUE_OWNER' &&
    owners.length <= 1
  ) {
    throw new DomainError('LAST_OWNER')
  }
}
