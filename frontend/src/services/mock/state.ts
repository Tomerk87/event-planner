import type {
  Event,
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
import type { DemoRole } from '../contracts/index.ts'

/**
 * Bump when the shape or content of the generated dataset changes in a way
 * that makes previously stored demo data unusable. Stored data from another
 * version is discarded and regenerated.
 */
export const DATASET_VERSION = 6

/**
 * Version of the accounts workspace, which holds what people created
 * themselves. It changes only when its shape does, never because the
 * generated demo content changed.
 */
export const ACCOUNTS_VERSION = 1

/** Everything the demo holds, exactly as it is stored in the browser. */
export interface DemoState {
  currentUserId: Id
  demoRole: DemoRole | null
  /** Source of ids for records created after generation. */
  nextId: number
  users: User[]
  events: Event[]
  memberships: EventMembership[]
  guests: Guest[]
  unknownRsvps: UnknownRsvp[]
  rsvpSettings: RsvpSettings[]
  messageTemplates: MessageTemplate[]
  messageSends: MessageSend[]
  tables: EventTable[]
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
] as const satisfies readonly (keyof DemoState)[]

/** A workspace with no data yet; accounts are added to it as people sign up. */
export function createEmptyState(): DemoState {
  return {
    currentUserId: '',
    demoRole: null,
    nextId: 1,
    users: [],
    events: [],
    memberships: [],
    guests: [],
    unknownRsvps: [],
    rsvpSettings: [],
    messageTemplates: [],
    messageSends: [],
    tables: [],
  }
}

/**
 * Stored data comes from the browser, so it is checked before it is trusted.
 * The demo always has a current user; the accounts workspace has none of its
 * own, because the session says who is signed in.
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
