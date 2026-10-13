import type { SignInInput, SignUpInput } from '../../domain/accounts.ts'
import type { EventInput } from '../../domain/events.ts'
import type { GuestInput } from '../../domain/guests.ts'
import type {
  ActivityEntry,
  DashboardMetrics,
  DashboardWarnings,
} from '../../domain/metrics.ts'
import type {
  Event,
  EventTable,
  Guest,
  Id,
  IsoDateTime,
  MessageSend,
  MessageTemplate,
  RsvpLanguage,
  RsvpResponse,
  RsvpSettings,
  RsvpStatus,
  UnknownRsvp,
  User,
} from '../../domain/models.ts'
import type { EventRole } from '../../domain/roles.ts'
import type { PublicRsvpInput } from '../../domain/rsvp.ts'
import type { TableInput } from '../../domain/seating.ts'

/**
 * The data operations the application depends on. Pages use these interfaces
 * only; a browser-local mock provider implements them now and an HTTP provider
 * will implement the same interfaces against the backend.
 *
 * Every method returns a Promise and may reject with a `DomainError`.
 */

export interface EventAccessInfo {
  event: Event
  /** The current user's effective role (a Super User counts as Owner). */
  role: EventRole
  isPast: boolean
}

export interface EventSummary extends EventAccessInfo {
  confirmedAttendees: number
}

export interface SessionService {
  getCurrentUser(): Promise<User>
}

export interface EventsService {
  /** Events the current user can access, soonest first. */
  list(): Promise<EventSummary[]>
  get(eventId: Id): Promise<EventAccessInfo>
  /** Creates an event; the creator becomes its Owner. */
  create(input: EventInput): Promise<Event>
  update(eventId: Id, input: EventInput): Promise<Event>
  /**
   * Creates a new event from an existing one: its details, RSVP settings,
   * message template and tables. Guests, responses, sent messages and other
   * members are not copied. The user duplicating becomes the copy's Owner.
   */
  duplicate(eventId: Id, input: DuplicateEventInput): Promise<Event>
  /** Permanently deletes the event and everything that belongs to it. */
  remove(eventId: Id): Promise<void>
}

export interface DuplicateEventInput {
  name: string
  startsAt: IsoDateTime
}

export interface GuestRsvpInput {
  status: RsvpStatus
  attendees: number | null
}

export interface GuestsService {
  /** Active guests only. */
  list(eventId: Id): Promise<Guest[]>
  /** Adds a guest, or restores a soft-deleted one with the same phone. */
  create(eventId: Id, input: GuestInput): Promise<Guest>
  update(eventId: Id, guestId: Id, input: GuestInput): Promise<Guest>
  /** Soft-deletes. */
  remove(eventId: Id, guestId: Id): Promise<void>
  /** Organizer's manual RSVP edit; same rules as the public form. */
  setRsvp(eventId: Id, guestId: Id, input: GuestRsvpInput): Promise<Guest>
  assignTable(eventId: Id, guestId: Id, tableId: Id | null): Promise<Guest>
}

export interface UnknownGuestsService {
  list(eventId: Id): Promise<UnknownRsvp[]>
  /** Adds the responder as a known guest, keeping their response. */
  convertToGuest(
    eventId: Id,
    unknownId: Id,
    input: Omit<GuestInput, 'phone'>,
  ): Promise<Guest>
  /** Applies the response to an existing guest and removes the unknown record. */
  mergeIntoGuest(eventId: Id, unknownId: Id, guestId: Id): Promise<Guest>
  reject(eventId: Id, unknownId: Id): Promise<void>
}

export type RsvpSettingsInput = Omit<RsvpSettings, 'eventId'>

/** What the public RSVP page needs. Contains no guest records. */
export interface PublicRsvpView {
  title: string
  startsAt: IsoDateTime
  timeZone: string
  location: string | null
  language: RsvpLanguage
  isClosed: boolean
  maxSelectableAttendees: number
  settings: RsvpSettingsInput
}

/** Deliberately does not say whether the phone matched a known guest. */
export interface PublicRsvpResult {
  status: RsvpResponse
  confirmedAttendees: number | null
}

export interface RsvpService {
  getSettings(eventId: Id): Promise<RsvpSettings>
  updateSettings(eventId: Id, input: RsvpSettingsInput): Promise<RsvpSettings>
  getPublicEvent(rsvpSlug: string): Promise<PublicRsvpView>
  submit(rsvpSlug: string, input: PublicRsvpInput): Promise<PublicRsvpResult>
}

export interface SendResult {
  guest: Guest
  send: MessageSend
  /**
   * The WhatsApp link to open for this send, or null when the send is
   * simulated. The interface opens a link only when one is returned.
   */
  launchUrl: string | null
}

export interface MessagesService {
  getTemplate(eventId: Id): Promise<MessageTemplate>
  updateTemplate(eventId: Id, body: string): Promise<MessageTemplate>
  /** The template with its variables filled in for one guest. */
  preview(eventId: Id, guestId: Id): Promise<string>
  /** Records one initiated send and increments the guest's counter. */
  send(eventId: Id, guestId: Id): Promise<SendResult>
  /** Newest first. */
  listSends(eventId: Id): Promise<MessageSend[]>
}

export interface TableWithOccupancy {
  table: EventTable
  /** Confirmed attendees seated at the table. */
  assigned: number
  /** Negative when the table is over capacity. */
  available: number
}

export interface TablesService {
  list(eventId: Id): Promise<TableWithOccupancy[]>
  create(eventId: Id, input: TableInput): Promise<EventTable>
  update(eventId: Id, tableId: Id, input: TableInput): Promise<EventTable>
  /** Deletes the table and unassigns its guests; guests are never deleted. */
  remove(eventId: Id, tableId: Id): Promise<void>
}

export interface Member {
  user: User
  role: EventRole
  isCurrentUser: boolean
}

export interface PermissionsService {
  list(eventId: Id): Promise<Member[]>
  /** Existing users who are not yet members of the event. */
  listCandidates(eventId: Id): Promise<User[]>
  grant(eventId: Id, userId: Id, role: EventRole): Promise<Member>
  changeRole(eventId: Id, userId: Id, role: EventRole): Promise<Member>
  revoke(eventId: Id, userId: Id): Promise<void>
}

export type ActivityItem = ActivityEntry & { guestName: string }

export interface Dashboard {
  metrics: DashboardMetrics
  warnings: DashboardWarnings
  recentActivity: ActivityItem[]
}

export interface DashboardService {
  get(eventId: Id): Promise<Dashboard>
}

export type DemoRole = EventRole | 'SUPER_USER'

/**
 * Controls that exist only in Demo Mode. A simulated role changes what the
 * local demo allows; it is never sent anywhere and confers no real access.
 */
export interface DemoControl {
  /** The simulated role, or null when the user's own memberships apply. */
  getRole(): Promise<DemoRole | null>
  setRole(role: DemoRole | null): Promise<void>
  /** Discards all changes and restores the initial generated dataset. */
  reset(): Promise<void>
  /**
   * True once after stored demo data was discarded because it came from an
   * older dataset version or could not be read.
   */
  consumeRegeneratedNotice(): boolean
}

/**
 * Who is using the application: a visitor exploring the demo, or a signed-in
 * account. The two never share data.
 */
export type Session =
  { workspace: 'demo' } | { workspace: 'account'; userId: Id }

export interface AuthService {
  /** The session remembered from an earlier visit, if any. */
  getSession(): Promise<Session | null>
  signUp(input: SignUpInput): Promise<Session>
  signIn(input: SignInInput): Promise<Session>
  /** Opens the demo; needs no account. */
  enterDemo(): Promise<Session>
  signOut(): Promise<void>
}

/** Everything the application needs from its data provider. */
export interface Backend {
  auth: AuthService
  /** The data operations available to a session. */
  servicesFor(session: Session): Services
}

export interface Services {
  session: SessionService
  events: EventsService
  guests: GuestsService
  unknownGuests: UnknownGuestsService
  rsvp: RsvpService
  messages: MessagesService
  tables: TablesService
  permissions: PermissionsService
  dashboard: DashboardService
  /** Present only when the application runs on demo data. */
  demo: DemoControl | null
}
