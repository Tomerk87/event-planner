import type { EventInvitation, Id, User } from './models.ts'
import { EVENT_ROLES, type EventRole } from './roles.ts'

/** One line of an event's access list: a member, or a pending invitation. */
export interface AccessRow {
  key: string
  kind: 'member' | 'invitation'
  /** The user's id for a member, the invitation's id otherwise. */
  id: Id
  /** A pending invitation has no account yet, so no name. */
  name: string | null
  email: string
  role: EventRole
  isCurrentUser: boolean
}

export interface AccessFilters {
  /** Part of a name or an email, in any letter case. */
  query: string
  role: 'ALL' | EventRole
}

/** Members first, in the order given, then the pending invitations. */
export function toAccessRows(
  members: readonly { user: User; role: EventRole; isCurrentUser: boolean }[],
  invitations: readonly EventInvitation[],
): AccessRow[] {
  return [
    ...members.map(({ user, role, isCurrentUser }): AccessRow => ({
      key: `member-${user.id}`,
      kind: 'member',
      id: user.id,
      name: user.name,
      email: user.email,
      role,
      isCurrentUser,
    })),
    ...invitations.map((invitation): AccessRow => ({
      key: `invitation-${invitation.id}`,
      kind: 'invitation',
      id: invitation.id,
      name: null,
      email: invitation.email,
      role: invitation.role,
      isCurrentUser: false,
    })),
  ]
}

export function filterAccessRows(
  rows: readonly AccessRow[],
  filters: AccessFilters,
): AccessRow[] {
  const query = filters.query.trim().toLowerCase()
  return rows.filter(
    (row) =>
      (filters.role === 'ALL' || row.role === filters.role) &&
      (query === '' ||
        row.email.toLowerCase().includes(query) ||
        (row.name?.toLowerCase().includes(query) ?? false)),
  )
}

/** How many members hold each role; pending invitations are not members. */
export function countMembersByRole(
  rows: readonly AccessRow[],
): Record<EventRole, number> {
  const counts = Object.fromEntries(
    EVENT_ROLES.map((role) => [role, 0]),
  ) as Record<EventRole, number>
  for (const row of rows) {
    if (row.kind === 'member') {
      counts[row.role] += 1
    }
  }
  return counts
}
