import type {
  Event,
  EventInvitation,
  EventLayout,
  EventMembership,
  EventTable,
  Guest,
  Id,
  MessageSend,
  MessageTemplate,
  RsvpSettings,
  UnknownRsvp,
  User,
} from '../../domain/models.ts'
import type { Country } from '../../domain/phone.ts'
import type { DemoRole } from '../contracts/index.ts'

/**
 * Bump when the shape or content of the generated dataset changes in a way
 * that makes previously stored demo data unusable. Stored data from another
 * version is discarded and regenerated.
 */
export const DATASET_VERSION = 9

/** Everything the demo holds, exactly as it is stored in the browser. */
export interface DemoState {
  currentUserId: Id
  demoRole: DemoRole | null
  /** Source of ids for records created after generation. */
  nextId: number
  users: User[]
  events: Event[]
  memberships: EventMembership[]
  invitations: EventInvitation[]
  guests: Guest[]
  unknownRsvps: UnknownRsvp[]
  rsvpSettings: RsvpSettings[]
  messageTemplates: MessageTemplate[]
  messageSends: MessageSend[]
  tables: EventTable[]
  /** Floor plans (D100); an event without one has an empty plan. */
  layouts: EventLayout[]
  /** Notices the visitor has read (D95); absent in demos saved before. */
  readNotifications?: Id[]
  /**
   * Whose sample events these are (D103); absent in a workspace that was not
   * generated as a demo.
   */
  market?: Country
}

export interface StoredDemo {
  version: number
  state: DemoState
}

const COLLECTIONS = [
  'users',
  'events',
  'memberships',
  'guests',
  'unknownRsvps',
  'rsvpSettings',
  'messageTemplates',
  'messageSends',
  'tables',
  'layouts',
] as const satisfies readonly (keyof DemoState)[]

/** A workspace with no data yet (used by the test stand-in for the server). */
export function createEmptyState(): DemoState {
  return {
    currentUserId: '',
    demoRole: null,
    nextId: 1,
    users: [],
    events: [],
    memberships: [],
    invitations: [],
    guests: [],
    unknownRsvps: [],
    rsvpSettings: [],
    messageTemplates: [],
    messageSends: [],
    tables: [],
    layouts: [],
  }
}

/** Data saved before invitations existed reads as having none. */
export function withInvitations(state: DemoState): DemoState {
  const { invitations } = state as { invitations?: unknown }
  return Array.isArray(invitations) ? state : { ...state, invitations: [] }
}

/**
 * Stored data comes from the browser, so it is checked before it is trusted.
 * The demo always has a current user; a workspace shared by several
 * accounts (the test stand-in for the server) has none of its own.
 */
export function isUsableStoredDemo(
  value: unknown,
  {
    requireCurrentUser = true,
    version: expectedVersion = DATASET_VERSION,
  }: { requireCurrentUser?: boolean; version?: number } = {},
): value is StoredDemo {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const { version, state } = value as Partial<StoredDemo>
  if (
    version !== expectedVersion ||
    typeof state !== 'object' ||
    state === null
  ) {
    return false
  }
  const candidate = state as Partial<Record<keyof DemoState, unknown>>
  return (
    typeof candidate.currentUserId === 'string' &&
    typeof candidate.nextId === 'number' &&
    COLLECTIONS.every((key) => Array.isArray(candidate[key])) &&
    (!requireCurrentUser ||
      (candidate.users as User[]).some(
        (user) => user.id === candidate.currentUserId,
      ))
  )
}
