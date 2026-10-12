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
export const DATASET_VERSION = 1

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

/** Demo data comes from the browser, so it is checked before it is trusted. */
export function isUsableStoredDemo(value: unknown): value is StoredDemo {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const { version, state } = value as Partial<StoredDemo>
  if (
    version !== DATASET_VERSION ||
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
    (candidate.users as User[]).some(
      (user) => user.id === candidate.currentUserId,
    )
  )
}
