import type { EventRole } from './roles.ts'

export interface EventAccess {
  role: EventRole
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
  if (access.role === 'VIEWER') {
    return 'VIEWER'
  }
  return null
}

export function canEditEvent(access: EventAccess): boolean {
  return getReadOnlyReason(access) === null
}

export function canOpenPermissions(role: EventRole): boolean {
  return role !== 'VIEWER'
}

/**
 * Whether the user may change who has access. An Admin loses this once the
 * event is past; an Owner (or a Super User, who counts as one) keeps it.
 */
export function canManagePermissions(access: EventAccess): boolean {
  return (
    access.role === 'OWNER' || (access.role === 'ADMIN' && !access.isPastEvent)
  )
}

/** The roles the user may give, change or take away. */
export function manageableRoles(access: EventAccess): EventRole[] {
  if (!canManagePermissions(access)) {
    return []
  }
  return access.role === 'OWNER'
    ? ['OWNER', 'ADMIN', 'VIEWER']
    : ['ADMIN', 'VIEWER']
}
