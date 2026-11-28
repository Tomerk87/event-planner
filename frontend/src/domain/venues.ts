import { assertEmail, normalizeEmail } from './accounts.ts'
import { assertIntegerInRange, assertNonEmpty, DomainError } from './errors.ts'
import { isEventPast, isValidTimeZone, toLocalDateTime } from './eventTime.ts'
import { EVENT_LIMITS, validateCoverImage } from './events.ts'
import {
  DEFAULT_FLOOR_IMAGE,
  DEFAULT_ROOM,
  type LayoutInput,
} from './layout.ts'
import type {
  EventLayout,
  EventTable,
  Id,
  IsoDateTime,
  TableShape,
  VenueObject,
} from './models.ts'
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
  /** The venue member who sent the latest link. */
  sentBy: Id | null
  /** How many links went to this address: the first, then each Resend. */
  timesSent: number
}

/**
 * One emailed link to accept a client invitation (#11, #12). Each works once
 * and for seven days; a Resend, a different client or a Revoke replaces it.
 */
export interface ClientInvitationLink {
  /** Long and random; the only thing the link carries. */
  token: string
  eventId: Id
  email: string
  sentAt: IsoDateTime
  status: 'OPEN' | 'USED' | 'REVOKED'
}

/** How a link stands when someone opens it. */
export type ClientLinkState = 'OPEN' | 'EXPIRED' | 'REVOKED' | 'USED'

/** The client side of a venue-managed event (D113). */
export type ClientTeamRole = 'CLIENT_LEAD' | 'CLIENT_EDITOR' | 'CLIENT_VIEWER'

export interface ClientTeamMember {
  eventId: Id
  userId: Id
  role: ClientTeamRole
  since: IsoDateTime
}

/** Someone the client lead invited who has no account yet. */
export interface ClientTeamInvitation {
  eventId: Id
  email: string
  role: Exclude<ClientTeamRole, 'CLIENT_LEAD'>
  sentAt: IsoDateTime
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
  /** The floor picture and its settings, as on an event's plan (D100). */
  floorImage: string | null
  floorImageTransparency: number
  floorImageZoom: number
  floorImageRotation: number
  /** Goes up with every save of the plan, so a stale save is refused. */
  version: number
  updatedAt: IsoDateTime
  /** Hidden from new events; events already made from it keep their copy. */
  archived: boolean
}

export const TEMPLATE_NAME_MAX_LENGTH = 80

/** Checks a template's name: new within its space, ignoring case. */
export function validateTemplateName(
  name: string,
  otherNames: readonly string[],
): string {
  const trimmed = assertNonEmpty(name, 'name')
  if (trimmed.length > TEMPLATE_NAME_MAX_LENGTH) {
    throw new DomainError('VALIDATION', { field: 'name' })
  }
  if (
    otherNames.some(
      (other) => other.trim().toLowerCase() === trimmed.toLowerCase(),
    )
  ) {
    throw new DomainError('VALIDATION', { field: 'name', reason: 'duplicate' })
  }
  return trimmed
}

/** A new template: the default room, empty (Add Layout, Phase 26). */
export function emptyTemplate(
  id: Id,
  spaceId: Id,
  name: string,
  updatedAt: IsoDateTime,
): LayoutTemplate {
  return {
    id,
    spaceId,
    name,
    ...DEFAULT_ROOM,
    tables: [],
    objects: [],
    floorImage: null,
    ...DEFAULT_FLOOR_IMAGE,
    version: 0,
    updatedAt,
    archived: false,
  }
}

/**
 * The id a template's table has on the floor plan. A template's tables are
 * known by their number; the plan needs an id for each.
 */
export function templateTableId(templateId: Id, number: number): Id {
  return `${templateId}#${number}`
}

/** A template's tables as the floor plan and the table forms know tables. */
export function templateTables(template: LayoutTemplate): EventTable[] {
  return template.tables.map((table) => ({
    id: templateTableId(template.id, table.number),
    eventId: template.id,
    number: table.number,
    capacity: table.capacity,
    shape: table.shape,
  }))
}

/** A template as a floor plan, so the event's plan editor can edit it. */
export function templateAsLayout(template: LayoutTemplate): EventLayout {
  return {
    eventId: template.id,
    roomWidth: template.roomWidth,
    roomDepth: template.roomDepth,
    floorImage: template.floorImage,
    floorImageTransparency: template.floorImageTransparency,
    floorImageZoom: template.floorImageZoom,
    floorImageRotation: template.floorImageRotation,
    placements: template.tables.flatMap((table) =>
      table.x === null || table.y === null
        ? []
        : [
            {
              tableId: templateTableId(template.id, table.number),
              x: table.x,
              y: table.y,
              rotation: table.rotation,
            },
          ],
    ),
    objects: template.objects.map((object) => ({ ...object })),
    version: template.version,
  }
}

/**
 * A checked floor plan written back to its template: the room, the picture,
 * the objects, and where each table stands. A table the plan leaves out is
 * kept, not placed.
 */
export function applyLayoutToTemplate(
  template: LayoutTemplate,
  layout: Omit<LayoutInput, 'version'>,
): Omit<LayoutTemplate, 'version' | 'updatedAt'> {
  return {
    ...template,
    roomWidth: layout.roomWidth,
    roomDepth: layout.roomDepth,
    floorImage: layout.floorImage,
    floorImageTransparency: layout.floorImageTransparency,
    floorImageZoom: layout.floorImageZoom,
    floorImageRotation: layout.floorImageRotation,
    objects: layout.objects.map((object) => ({ ...object })),
    tables: template.tables.map((table) => {
      const placement = layout.placements.find(
        (candidate) =>
          candidate.tableId === templateTableId(template.id, table.number),
      )
      return placement
        ? {
            ...table,
            x: placement.x,
            y: placement.y,
            rotation: placement.rotation,
          }
        : { ...table, x: null, y: null, rotation: 0 }
    }),
  }
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

/** What a venue enters to create an event (the wizard, mockup #9). */
export interface VenueEventInput {
  spaceId: Id
  templateId: Id
  name: string
  startsAt: IsoDateTime
  /** A JPEG or PNG data address; null for the generated cover. */
  coverImage?: string | null
  /** Invites the client now; left empty, they are invited later. */
  clientEmail?: string | null
}

/** Whether two instants fall on the same day in a time zone. */
export function isSameLocalDay(
  a: IsoDateTime,
  b: IsoDateTime,
  timeZone: string,
): boolean {
  const first = toLocalDateTime(new Date(a), timeZone)
  const second = toLocalDateTime(new Date(b), timeZone)
  return (
    first.year === second.year &&
    first.month === second.month &&
    first.day === second.day
  )
}

/**
 * The events of a space on the same day as a new one (D111, Q12): a warning
 * only, never a block. The day is the space's own.
 */
export function sameDayEvents<Item extends { startsAt: IsoDateTime }>(
  events: readonly Item[],
  startsAt: IsoDateTime,
  timeZone: string,
): Item[] {
  return events.filter((event) =>
    isSameLocalDay(event.startsAt, startsAt, timeZone),
  )
}

/**
 * An event's own copy of a template (D111): its tables with new ids, in the
 * same places, and the room, picture and objects. Nothing links them after,
 * so changing the template never changes the event.
 */
export function copyTemplateToEvent(
  template: LayoutTemplate,
  eventId: Id,
  newTableId: () => Id,
): { tables: EventTable[]; layout: EventLayout } {
  const copies = template.tables.map((table) => ({
    table: {
      id: newTableId(),
      eventId,
      number: table.number,
      capacity: table.capacity,
      shape: table.shape,
    },
    place: table,
  }))
  return {
    tables: copies.map(({ table }) => table),
    layout: {
      eventId,
      roomWidth: template.roomWidth,
      roomDepth: template.roomDepth,
      floorImage: template.floorImage,
      floorImageTransparency: template.floorImageTransparency,
      floorImageZoom: template.floorImageZoom,
      floorImageRotation: template.floorImageRotation,
      placements: copies.flatMap(({ table, place }) =>
        place.x === null || place.y === null
          ? []
          : [
              {
                tableId: table.id,
                x: place.x,
                y: place.y,
                rotation: place.rotation,
              },
            ],
      ),
      objects: template.objects.map((object) => ({ ...object })),
      version: 0,
    },
  }
}

/** When a link stops working: seven days after it was sent (D115). */
export function clientLinkExpiresAt(
  link: Pick<ClientInvitationLink, 'sentAt'>,
): Date {
  return new Date(
    new Date(link.sentAt).getTime() + CLIENT_INVITATION_DAYS * DAY_MS,
  )
}

/**
 * How a link stands: used and revoked links never work again; an open one
 * expires after seven days, or when the event has started (PRD 5.2).
 */
export function clientLinkState(
  link: ClientInvitationLink,
  event: { startsAt: IsoDateTime },
  now: Date,
): ClientLinkState {
  if (link.status !== 'OPEN') {
    return link.status
  }
  return now < clientLinkExpiresAt(link) && !isEventPast(event, now)
    ? 'OPEN'
    : 'EXPIRED'
}

/**
 * Whether this user may accept the link: it must be open, and the account's
 * email must be the invited one (D113). Throws LINK_EXPIRED (with the
 * link's state) or FORBIDDEN.
 */
export function assertCanAcceptClientLink(
  link: ClientInvitationLink,
  event: { startsAt: IsoDateTime },
  user: { email: string },
  now: Date,
): void {
  const state = clientLinkState(link, event, now)
  if (state !== 'OPEN') {
    throw new DomainError('LINK_EXPIRED', { state })
  }
  if (normalizeEmail(user.email) !== normalizeEmail(link.email)) {
    throw new DomainError('FORBIDDEN', { reason: 'email' })
  }
}

/** A token no one can guess: 128 random bits. */
export function newClientLinkToken(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join(
    '',
  )
}

/**
 * Something the venue changed under the client (D114, D122). Changing the
 * room under seated guests needs the client to act; changing the date,
 * address or maximum is for their information.
 */
export interface VenueNotice {
  id: Id
  eventId: Id
  kind: 'TABLE_REMOVED' | 'TABLE_OVER_CAPACITY' | 'DETAILS_CHANGED'
  tableId: Id | null
  tableNumber: number | null
  /** The guest parties and people the change reached when it was made. */
  parties: number
  people: number
  /** A removed table's guests: the notice is open until they have seats. */
  guestIds: Id[]
  /** What a DETAILS_CHANGED notice is about. */
  changes: VenueDetailChange[]
  /** The venue's optional word to the client. */
  note: string | null
  actorName: string | null
  createdAt: IsoDateTime
  /** The client side's members who read it. */
  readBy: Id[]
  /** A removed table's notice the client closed by hand ("I've handled it"). */
  handledAt: IsoDateTime | null
}

export type VenueDetailChange = 'date' | 'address' | 'maxAttendees'

export const VENUE_NOTE_MAX_LENGTH = 300

/** Action needed for the room under guests; information otherwise. */
export function noticeSeverity(
  notice: Pick<VenueNotice, 'kind'>,
): 'ACTION' | 'INFO' {
  return notice.kind === 'DETAILS_CHANGED' ? 'INFO' : 'ACTION'
}

/** The venue's note: optional, trimmed, at most 300 characters. */
export function validateVenueNote(
  note: string | null | undefined,
): string | null {
  const trimmed = (note ?? '').trim()
  if (trimmed.length > VENUE_NOTE_MAX_LENGTH) {
    throw new DomainError('VALIDATION', { field: 'note' })
  }
  return trimmed === '' ? null : trimmed
}

/**
 * Whether an action is still needed (D122): an over-capacity table until it
 * fits (or is gone), a removed table until its guests are seated again or
 * the client closes it. Information stays open until read.
 */
export function isNoticeOpen(
  notice: VenueNotice,
  tables: readonly { id: Id; capacity: number }[],
  guests: readonly {
    id: Id
    tableId: Id | null
    confirmedAttendees: number | null
    rsvpStatus: string
    deleted: boolean
  }[],
  readerId: Id,
): boolean {
  if (notice.kind === 'DETAILS_CHANGED') {
    return !notice.readBy.includes(readerId)
  }
  if (notice.kind === 'TABLE_OVER_CAPACITY') {
    const table = tables.find((candidate) => candidate.id === notice.tableId)
    return table !== undefined && overCapacity(table, guests) > 0
  }
  if (notice.handledAt !== null) {
    return false
  }
  return guests.some(
    (guest) =>
      notice.guestIds.includes(guest.id) &&
      !guest.deleted &&
      guest.rsvpStatus === 'APPROVED' &&
      guest.tableId === null,
  )
}

/** People seated at a table beyond its chairs; 0 when they fit. */
export function overCapacity(
  table: { id: Id; capacity: number },
  guests: readonly {
    tableId: Id | null
    confirmedAttendees: number | null
    rsvpStatus: string
    deleted: boolean
  }[],
): number {
  const seated = guests
    .filter(
      (guest) =>
        guest.tableId === table.id &&
        !guest.deleted &&
        guest.rsvpStatus === 'APPROVED',
    )
    .reduce((sum, guest) => sum + (guest.confirmedAttendees ?? 0), 0)
  return Math.max(0, seated - table.capacity)
}
