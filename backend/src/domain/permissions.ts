import { DomainError } from './errors.ts'
import type { EventMembership, Id } from './models.ts'
import type { EventRole } from './roles.ts'

export type EventAction =
  | 'VIEW'
  | 'EXPORT'
  | 'EDIT'
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

const MINIMUM_ROLE: Record<EventAction, EventRole> = {
  VIEW: 'VIEWER',
  EXPORT: 'VIEWER',
  EDIT: 'ADMIN',
  SEND_MESSAGE: 'ADMIN',
  VIEW_PERMISSIONS: 'ADMIN',
  MANAGE_PERMISSIONS: 'ADMIN',
  DUPLICATE_EVENT: 'OWNER',
  DELETE_EVENT: 'OWNER',
}

const RANK: Record<EventRole, number> = { VIEWER: 1, ADMIN: 2, OWNER: 3 }

/** Actions that change operational data and are blocked once an event is past. */
const BLOCKED_ON_PAST_EVENT: ReadonlySet<EventAction> = new Set([
  'EDIT',
  'SEND_MESSAGE',
])

/**
 * Checks an action against the role matrix in PRD section 3.2 and the
 * past-event rule in section 5.2. Throws FORBIDDEN or EVENT_READ_ONLY.
 */
export function assertCan(
  action: EventAction,
  actor: Actor,
  context: { isPastEvent: boolean },
): void {
  const role = effectiveRole(actor)
  if (role === null || RANK[role] < RANK[MINIMUM_ROLE[action]]) {
    throw new DomainError('FORBIDDEN', { action })
  }
  if (context.isPastEvent && BLOCKED_ON_PAST_EVENT.has(action)) {
    throw new DomainError('EVENT_READ_ONLY', { action })
  }
  // Once an event is past, only an Owner still manages who can see it.
  if (
    context.isPastEvent &&
    action === 'MANAGE_PERMISSIONS' &&
    role !== 'OWNER'
  ) {
    throw new DomainError('EVENT_READ_ONLY', { action })
  }
}

export function can(
  action: EventAction,
  actor: Actor,
  context: { isPastEvent: boolean },
): boolean {
  try {
    assertCan(action, actor, context)
    return true
  } catch {
    return false
  }
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
