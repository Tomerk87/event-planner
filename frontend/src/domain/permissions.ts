import { DomainError } from './errors.ts'
import type { EventInput } from './events.ts'
import type { EventMembership, Id } from './models.ts'
import type { AnyEventRole, EventRole } from './roles.ts'

/**
 * What a user does in an event. Each change to the event is its own action, so
 * the venue and the client of a venue-managed event can each be given only
 * their part (D113); for a personal event every change still needs an Admin.
 *
 * `EDIT` is the earlier single "change anything" action. The backend still
 * checks it until its own permission split (PLAN.md Phase 33); the frontend
 * uses the specific actions below. Remove `EDIT` then.
 */
export type EventAction =
  | 'VIEW'
  /** The seating list and other operational exports. */
  | 'EXPORT'
  /** The full guest list, with phone numbers. */
  | 'EXPORT_GUESTS'
  | 'EDIT'
  /** Date, time, time zone, location and maximum attendees. */
  | 'EDIT_EVENT_SCHEDULE'
  /** Name, photo, RSVP title and the guest settings (language, country, attendees per guest). */
  | 'EDIT_EVENT_SETTINGS'
  /** Guests, their RSVP answers and groups, imports, and the review of unknown guests. */
  | 'EDIT_GUESTS'
  /** Seating an approved guest at a table, or taking them off it. */
  | 'ASSIGN_SEATING'
  /** Adding, changing and deleting tables. */
  | 'EDIT_TABLES'
  /** The floor plan: room, picture, objects and where the tables stand. */
  | 'EDIT_LAYOUT'
  | 'EDIT_RSVP_SETTINGS'
  /** The WhatsApp message template. */
  | 'EDIT_MESSAGE'
  | 'SEND_MESSAGE'
  | 'VIEW_PERMISSIONS'
  | 'MANAGE_PERMISSIONS'
  | 'DUPLICATE_EVENT'
  | 'DELETE_EVENT'

/** Who is acting. `role` is their membership in the event, if any. */
export interface Actor {
  userId: Id
  isSuperUser: boolean
  role: EventRole | null
}

/** A Super User has Owner-equivalent capability on every event. */
export function effectiveRole(actor: Actor): EventRole | null {
  return actor.isSuperUser ? 'OWNER' : actor.role
}

/** Every change to an event's data; blocked once the event has started. */
const CHANGES = [
  'EDIT',
  'EDIT_EVENT_SCHEDULE',
  'EDIT_EVENT_SETTINGS',
  'EDIT_GUESTS',
  'ASSIGN_SEATING',
  'EDIT_TABLES',
  'EDIT_LAYOUT',
  'EDIT_RSVP_SETTINGS',
  'EDIT_MESSAGE',
  'SEND_MESSAGE',
] as const satisfies readonly EventAction[]

const BLOCKED_ON_PAST_EVENT: ReadonlySet<EventAction> = new Set(CHANGES)

const VIEWER_ACTIONS = [
  'VIEW',
  'EXPORT',
  'EXPORT_GUESTS',
] as const satisfies readonly EventAction[]
const ADMIN_ACTIONS = [
  ...VIEWER_ACTIONS,
  ...CHANGES,
  'VIEW_PERMISSIONS',
  'MANAGE_PERMISSIONS',
] as const satisfies readonly EventAction[]

/** The venue's part of a venue-managed event (D112, D113). */
const VENUE_MANAGER_ACTIONS = [
  'VIEW',
  'EXPORT',
  'EDIT_EVENT_SCHEDULE',
  'EDIT_TABLES',
  'EDIT_LAYOUT',
  'VIEW_PERMISSIONS',
] as const satisfies readonly EventAction[]

/** The client's part of a venue-managed event (D113). */
const CLIENT_VIEWER_ACTIONS = [
  'VIEW',
  'EXPORT',
] as const satisfies readonly EventAction[]
const CLIENT_EDITOR_ACTIONS = [
  ...CLIENT_VIEWER_ACTIONS,
  'EXPORT_GUESTS',
  'EDIT_EVENT_SETTINGS',
  'EDIT_GUESTS',
  'ASSIGN_SEATING',
  'EDIT_RSVP_SETTINGS',
  'EDIT_MESSAGE',
  'SEND_MESSAGE',
  'VIEW_PERMISSIONS',
] as const satisfies readonly EventAction[]

/**
 * What each role may do: PRD section 3.2 for a personal event, D112–D113 for
 * a venue-managed one. Neither side of a venue-managed event can change the
 * other side's part.
 */
const ROLE_ACTIONS: Record<AnyEventRole, ReadonlySet<EventAction>> = {
  VIEWER: new Set(VIEWER_ACTIONS),
  ADMIN: new Set(ADMIN_ACTIONS),
  OWNER: new Set([...ADMIN_ACTIONS, 'DUPLICATE_EVENT', 'DELETE_EVENT']),
  VENUE_MANAGER: new Set(VENUE_MANAGER_ACTIONS),
  VENUE_OWNER: new Set([...VENUE_MANAGER_ACTIONS, 'DELETE_EVENT']),
  CLIENT_VIEWER: new Set(CLIENT_VIEWER_ACTIONS),
  CLIENT_EDITOR: new Set(CLIENT_EDITOR_ACTIONS),
  CLIENT_LEAD: new Set([...CLIENT_EDITOR_ACTIONS, 'MANAGE_PERMISSIONS']),
}

/** Roles that keep managing their side's permissions once an event is past. */
const MANAGES_PERMISSIONS_WHEN_PAST: ReadonlySet<AnyEventRole> = new Set([
  'OWNER',
  'CLIENT_LEAD',
])

/**
 * Checks an action for a role against the role table and the past-event rule
 * in PRD section 5.2. Throws FORBIDDEN or EVENT_READ_ONLY.
 */
export function assertRoleCan(
  action: EventAction,
  role: AnyEventRole | null,
  context: { isPastEvent: boolean },
): void {
  if (role === null || !ROLE_ACTIONS[role].has(action)) {
    throw new DomainError('FORBIDDEN', { action })
  }
  if (context.isPastEvent && BLOCKED_ON_PAST_EVENT.has(action)) {
    throw new DomainError('EVENT_READ_ONLY', { action })
  }
  // Once an event is past, only an Owner (or a client lead) still manages
  // who can see it.
  if (
    context.isPastEvent &&
    action === 'MANAGE_PERMISSIONS' &&
    !MANAGES_PERMISSIONS_WHEN_PAST.has(role)
  ) {
    throw new DomainError('EVENT_READ_ONLY', { action })
  }
}

/** Whether a role may take an action now; see `assertRoleCan`. */
export function roleCan(
  action: EventAction,
  role: AnyEventRole | null,
  context: { isPastEvent: boolean },
): boolean {
  try {
    assertRoleCan(action, role, context)
    return true
  } catch {
    return false
  }
}

/** Checks an action for an actor. Throws FORBIDDEN or EVENT_READ_ONLY. */
export function assertCan(
  action: EventAction,
  actor: Actor,
  context: { isPastEvent: boolean },
): void {
  assertRoleCan(action, effectiveRole(actor), context)
}

export function can(
  action: EventAction,
  actor: Actor,
  context: { isPastEvent: boolean },
): boolean {
  return roleCan(action, effectiveRole(actor), context)
}

/** The details of an event an update can change, as stored. */
type EventDetails = Pick<
  EventInput,
  | 'name'
  | 'startsAt'
  | 'timeZone'
  | 'maxAttendees'
  | 'defaultAllowedAttendees'
  | 'rsvpLanguage'
  | 'country'
> & {
  location: string | null
  rsvpTitle: string | null
  coverImage: string | null
}

const SCHEDULE_FIELDS = ['timeZone', 'maxAttendees'] as const
const SETTINGS_FIELDS = [
  'defaultAllowedAttendees',
  'rsvpLanguage',
  'country',
] as const

/**
 * The actions an update of an event's details needs (D113): the schedule
 * (date, time, time zone, location, maximum attendees) and the settings (name,
 * photo, RSVP title, guest settings) are owned by different sides of a
 * venue-managed event. An update that changes nothing still needs the right to
 * change the settings, as saving always did.
 */
export function eventUpdateActions(
  event: EventDetails,
  input: EventInput,
): EventAction[] {
  const sameText = (a: string | null | undefined, b: string | null) =>
    (a ?? '').trim() === (b ?? '').trim()
  const schedule =
    new Date(input.startsAt).getTime() !== new Date(event.startsAt).getTime() ||
    SCHEDULE_FIELDS.some((field) => input[field] !== event[field]) ||
    (input.location !== undefined && !sameText(input.location, event.location))
  const settings =
    !sameText(input.name, event.name) ||
    SETTINGS_FIELDS.some((field) => input[field] !== event[field]) ||
    (input.rsvpTitle !== undefined &&
      !sameText(input.rsvpTitle, event.rsvpTitle)) ||
    (input.coverImage !== undefined && input.coverImage !== event.coverImage)
  const actions: EventAction[] = []
  if (schedule) {
    actions.push('EDIT_EVENT_SCHEDULE')
  }
  if (settings || !schedule) {
    actions.push('EDIT_EVENT_SETTINGS')
  }
  return actions
}

function assertMayHandleRole(actor: Actor, role: EventRole): void {
  if (!canHandleRole(actor, role)) {
    throw new DomainError('FORBIDDEN', { action: 'MANAGE_PERMISSIONS' })
  }
}

/**
 * Whether the actor may give, change or take away this role: an Owner any
 * role, an Admin only Admin and Viewer, a Viewer none.
 */
export function canHandleRole(actor: Actor, role: EventRole): boolean {
  const own = effectiveRole(actor)
  return own === 'OWNER' || (own === 'ADMIN' && role !== 'OWNER')
}

/**
 * Checks a change to a pending invitation: creating it (no current role),
 * changing its role, or cancelling it (no new role). An invitation is not a
 * membership, so it never counts as one of the event's Owners.
 */
export function assertCanChangeInvitation(
  actor: Actor,
  change: { currentRole: EventRole | null; newRole: EventRole | null },
): void {
  for (const role of [change.currentRole, change.newRole]) {
    if (role !== null) {
      assertMayHandleRole(actor, role)
    }
  }
}

/**
 * Checks a change to one member's permission: granting (no current
 * membership), changing the role, or removing (no new role).
 *
 * - Viewers cannot manage permissions.
 * - Admins manage only Admin and Viewer permissions.
 * - Nobody changes or removes their own permission.
 * - An event always keeps at least one Owner.
 */
export function assertCanChangeMembership(
  actor: Actor,
  memberships: readonly EventMembership[],
  target: { eventId: Id; userId: Id; newRole: EventRole | null },
): void {
  const role = effectiveRole(actor)
  if (role === null || role === 'VIEWER') {
    throw new DomainError('FORBIDDEN', { action: 'MANAGE_PERMISSIONS' })
  }

  const eventMembers = memberships.filter(
    (membership) => membership.eventId === target.eventId,
  )
  const current = eventMembers.find(
    (membership) => membership.userId === target.userId,
  )

  if (current === undefined) {
    if (target.newRole === null) {
      throw new DomainError('NOT_FOUND', { entity: 'membership' })
    }
    assertMayHandleRole(actor, target.newRole)
    return
  }

  if (target.userId === actor.userId) {
    throw new DomainError('SELF_PERMISSION')
  }
  assertMayHandleRole(actor, current.role)
  if (target.newRole !== null) {
    assertMayHandleRole(actor, target.newRole)
  }

  const ownerCount = eventMembers.filter(
    (membership) => membership.role === 'OWNER',
  ).length
  if (
    current.role === 'OWNER' &&
    target.newRole !== 'OWNER' &&
    ownerCount <= 1
  ) {
    throw new DomainError('LAST_OWNER')
  }
}
