import type { SignInInput, SignUpInput } from '../../domain/accounts.ts'
import type { EventInput } from '../../domain/events.ts'
import type {
  GuestExportLabels,
  SeatingExportColumn,
} from '../../domain/exports.ts'
import type { GuestInput } from '../../domain/guests.ts'
import type { MessageValues } from '../../domain/messages.ts'
import type {
  ActivityEntry,
  DashboardMetrics,
  DashboardWarnings,
} from '../../domain/metrics.ts'
import type {
  Event,
  EventInvitation,
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
  /**
   * Whether the account proved its email (D89). Always true in the demo and
   * while the server sends no email (D88).
   */
  getEmailVerified(): Promise<boolean>
  /** Emails the verification link again; real accounts with email on only. */
  resendVerification(): Promise<void>
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
  /** Soft-deletes several guests at once; all of them or none. */
  removeMany(eventId: Id, guestIds: readonly Id[]): Promise<void>
  /** Moves the guests to one group, replacing any group they had; `null` clears it. */
  setGroup(
    eventId: Id,
    guestIds: readonly Id[],
    group: string | null,
  ): Promise<void>
  /**
   * Adds many guests at once, with the same rules as `create`. If any entry
   * is invalid nothing is saved.
   */
  importMany(eventId: Id, inputs: readonly GuestInput[]): Promise<ImportOutcome>
}

export interface ImportOutcome {
  /** Guests added as new records. */
  created: number
  /** Soft-deleted guests brought back because their phone was imported. */
  restored: number
}

export interface UnknownGuestsService {
  /** Responses awaiting review, newest first. */
  list(eventId: Id): Promise<UnknownRsvp[]>
  /** Responses an organizer rejected, most recently rejected first. */
  listRejected(eventId: Id): Promise<UnknownRsvp[]>
  /** Adds the responder as a known guest, keeping their response. */
  convertToGuest(
    eventId: Id,
    unknownId: Id,
    input: Omit<GuestInput, 'phone'>,
  ): Promise<Guest>
  /** Applies the response to an existing guest and removes the unknown record. */
  mergeIntoGuest(eventId: Id, unknownId: Id, guestId: Id): Promise<Guest>
  /** Moves the response out of the review list; it is kept and can be restored. */
  reject(eventId: Id, unknownId: Id): Promise<void>
  /** Returns a rejected response to the review list. */
  restore(eventId: Id, unknownId: Id): Promise<UnknownRsvp>
}

/**
 * Choices about how the application looks to this person, kept apart from
 * any event's data.
 */
export interface PreferencesService {
  /** Ids of the Guests table columns to show; null when never chosen. */
  getGuestColumns(): Promise<string[] | null>
  setGuestColumns(columns: readonly string[]): Promise<void>
  /** Whether the desktop side menu is reduced to its icons. */
  getSidebarCollapsed(): Promise<boolean>
  setSidebarCollapsed(collapsed: boolean): Promise<void>
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
  /** The WhatsApp link of this send: the guest's number and the message. */
  launchUrl: string
}

/** The saved template filled in for one guest, and the link that sends it. */
export interface MessagePreview {
  message: string
  launchUrl: string
}

/** A recorded send with the guest it went to, as the guest is now. */
export interface SentMessage extends MessageSend {
  guestName: string
  phone: string
  /** False once the guest has been deleted; such a guest cannot be sent to. */
  guestActive: boolean
}

export interface MessagesService {
  getTemplate(eventId: Id): Promise<MessageTemplate>
  /** Refuses an empty template and one longer than the limit. */
  updateTemplate(eventId: Id, body: string): Promise<MessageTemplate>
  /** The template a new event starts with, in the event's RSVP language. */
  getDefaultTemplate(eventId: Id): Promise<string>
  /**
   * What each variable stands for, for one guest; with no guest, for a
   * made-up one, so a message can be previewed before any guest exists.
   */
  getValues(eventId: Id, guestId: Id | null): Promise<MessageValues>
  /** The saved template filled in for one guest, ready to send. */
  preview(eventId: Id, guestId: Id): Promise<MessagePreview>
  /** Records one initiated send and increments the guest's counter. */
  send(eventId: Id, guestId: Id): Promise<SendResult>
  /** Newest first. */
  listSends(eventId: Id): Promise<SentMessage[]>
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

export interface EventAccessList {
  members: Member[]
  /** Access offered to emails that have no account yet. */
  invitations: EventInvitation[]
}

/** What an invite produced: a member at once, or a pending invitation. */
export type InviteResult =
  | { kind: 'member'; member: Member }
  | { kind: 'invitation'; invitation: EventInvitation }

export interface PermissionsService {
  list(eventId: Id): Promise<EventAccessList>
  /**
   * Gives access by email. An email with an account becomes a member at
   * once; any other is kept as a pending invitation until it signs up.
   * Accounts are never listed or searched, so no directory is exposed.
   */
  invite(eventId: Id, email: string, role: EventRole): Promise<InviteResult>
  changeRole(eventId: Id, userId: Id, role: EventRole): Promise<Member>
  revoke(eventId: Id, userId: Id): Promise<void>
  changeInvitationRole(
    eventId: Id,
    invitationId: Id,
    role: EventRole,
  ): Promise<EventInvitation>
  cancelInvitation(eventId: Id, invitationId: Id): Promise<void>
  /** Emails a pending invitation again; real accounts with email on only (D90). */
  resendInvitation(eventId: Id, invitationId: Id): Promise<void>
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
/** What the server offers (D88). */
export interface ServerFeatures {
  /** Whether emails are really sent. */
  email: boolean
}

/**
 * The emails of real accounts (D88): links that work without a session.
 * The demo has no email; there, `getFeatures` says email is off.
 */
export interface AccountEmailService {
  getFeatures(): Promise<ServerFeatures>
  /** Answers the same whether or not the email has an account. */
  forgotPassword(email: string): Promise<void>
  /** Sets a new password; every session of the account ends. */
  resetPassword(token: string, password: string): Promise<void>
  verifyEmail(token: string): Promise<void>
}

/** The email settings of the server, without any secret (D91). */
export interface EmailStatus {
  mode: 'off' | 'smtp'
  host: string | null
  port: number | null
  from: string
  authenticated: boolean
}

/** The server's own settings, for a Super User; read-only (D91). */
export interface SystemService {
  getEmailStatus(): Promise<EmailStatus>
  /** Sends a test email to the Super User; `sent` is false while email is off. */
  sendTestEmail(): Promise<{ sent: boolean }>
}

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

export type FileFormat = 'csv' | 'xlsx'

/** How an exported file is written: format, sheet name and reading direction. */
export interface SpreadsheetOptions {
  format: FileFormat
  sheetName: string
  rightToLeft: boolean
}

export interface GuestExportRequest extends SpreadsheetOptions {
  /** The guests to include, in any order; they are listed by name. */
  guestIds: readonly Id[]
  /** Headings and status names in the person's interface language. */
  labels: GuestExportLabels
}

export interface SeatingExportRequest extends SpreadsheetOptions {
  /** Headings in the person's interface language. */
  headings: Record<SeatingExportColumn, string>
}

/**
 * Guest and seating files. The demo reads and writes them in the browser;
 * the real application on the server (decision D83).
 */
export interface FilesService {
  /**
   * Reads a CSV or Excel file into rows of text for the import dialog.
   * Nothing is saved; the chosen rows go to `guests.importMany`.
   */
  readGuestFile(eventId: Id, file: File): Promise<string[][]>
  /** The guests as a file, with every field. */
  exportGuests(eventId: Id, request: GuestExportRequest): Promise<Blob>
  /** The seating list as a file: one row per seated party, in table order. */
  exportSeating(eventId: Id, request: SeatingExportRequest): Promise<Blob>
}

/** The public RSVP page: reachable with the link alone, by anyone. */
export type PublicRsvpService = Pick<RsvpService, 'getPublicEvent' | 'submit'>

/** Everything the application needs from its data provider. */
export interface Backend {
  /** Whether this deployment offers the public demo (`VITE_DEMO_ENABLED`). */
  demoAvailable: boolean
  auth: AuthService
  accountEmail: AccountEmailService
  /** The data operations available to a session. */
  servicesFor(session: Session): Services
  publicRsvp: PublicRsvpService
  /**
   * Tells when data changed outside this page, so what is shown can be
   * reloaded. Returns the function that stops listening.
   */
  onExternalChange(listener: () => void): () => void
  /**
   * Tells when the server no longer accepts the signed-in session (it
   * expired or was revoked), so the application can return to signed out.
   */
  onSessionEnded(listener: () => void): () => void
}

/** The data operations of one session. */
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
  files: FilesService
  system: SystemService
  preferences: PreferencesService
  /** Present only when the application runs on demo data. */
  demo: DemoControl | null
}
