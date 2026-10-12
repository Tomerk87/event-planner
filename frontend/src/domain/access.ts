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
