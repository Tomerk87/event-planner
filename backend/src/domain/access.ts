import { roleCan, type EventAction } from './permissions.ts'
import type { AnyEventRole, EventRole } from './roles.ts'

export interface EventAccess {
  role: AnyEventRole
  isPastEvent: boolean
}

export type ReadOnlyReason = 'PAST_EVENT' | 'VIEWER'

/**
 * Why the event's operational data cannot be edited, or null when it can.
 * A past event is read-only for every role, so it takes precedence.
 */
export function getReadOnlyReason(access: EventAccess): ReadOnlyReason | null {
  if (access.isPastEvent) {
    return 'PAST_EVENT'
  }
  if (access.role === 'VIEWER' || access.role === 'CLIENT_VIEWER') {
    return 'VIEWER'
  }
  return null
}

/**
 * Whether the user may take this action in the event now. Each page asks for
 * the action it performs (PLAN.md Phase 24), so a venue and a client can later
 * hold different parts of one event. For the interface only; the data layer
 * enforces the same rule.
 */
export function canPerform(access: EventAccess, action: EventAction): boolean {
  return roleCan(action, access.role, { isPastEvent: access.isPastEvent })
}

export function canOpenPermissions(role: AnyEventRole): boolean {
  return roleCan('VIEW_PERMISSIONS', role, { isPastEvent: false })
}

/**
 * Whether the user may change who has access. An Admin loses this once the
 * event is past; an Owner (or a Super User, who counts as one) keeps it.
 */
export function canManagePermissions(access: EventAccess): boolean {
  return canPerform(access, 'MANAGE_PERMISSIONS')
}

/** The roles the user may give, change or take away. */
export function manageableRoles(access: EventAccess): EventRole[] {
  if (!canManagePermissions(access)) {
    return []
  }
  return access.role === 'OWNER'
    ? ['OWNER', 'ADMIN', 'VIEWER']
    : access.role === 'ADMIN'
      ? ['ADMIN', 'VIEWER']
      : []
}
