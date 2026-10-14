import { describe, expect, it } from 'vitest'
import {
  countMembersByRole,
  filterAccessRows,
  toAccessRows,
} from './memberList.ts'
import type { EventRole } from './roles.ts'

const member = (
  id: string,
  name: string,
  role: EventRole,
  isCurrentUser = false,
) => ({
  user: {
    id,
    name,
    email: `${name.toLowerCase().replace(' ', '.')}@example.com`,
    isSuperUser: false,
  },
  role,
  isCurrentUser,
})

const rows = toAccessRows(
  [
    member('u-1', 'Alex Morgan', 'OWNER', true),
    member('u-2', 'Jordan Hale', 'ADMIN'),
    member('u-3', 'Sam Keller', 'VIEWER'),
  ],
  [
    { id: 'inv-1', eventId: 'evt-1', email: 'new@example.org', role: 'OWNER' },
    {
      id: 'inv-2',
      eventId: 'evt-1',
      email: 'alexa@example.org',
      role: 'VIEWER',
    },
  ],
)

const all = { query: '', role: 'ALL' } as const

describe('access rows', () => {
  it('lists members first, then pending invitations without a name', () => {
    expect(rows.map((row) => [row.kind, row.id, row.name])).toEqual([
      ['member', 'u-1', 'Alex Morgan'],
      ['member', 'u-2', 'Jordan Hale'],
      ['member', 'u-3', 'Sam Keller'],
      ['invitation', 'inv-1', null],
      ['invitation', 'inv-2', null],
    ])
    expect(new Set(rows.map((row) => row.key)).size).toBe(rows.length)
    expect(
      rows.filter((row) => row.isCurrentUser).map((row) => row.id),
    ).toEqual(['u-1'])
  })

  it('counts members by role, leaving invitations out', () => {
    expect(countMembersByRole(rows)).toEqual({ OWNER: 1, ADMIN: 1, VIEWER: 1 })
    expect(countMembersByRole([])).toEqual({ OWNER: 0, ADMIN: 0, VIEWER: 0 })
  })

  it('searches names and emails in any letter case', () => {
    const find = (query: string) =>
      filterAccessRows(rows, { ...all, query }).map((row) => row.id)

    expect(find('  ALEX ')).toEqual(['u-1', 'inv-2'])
    expect(find('example.org')).toEqual(['inv-1', 'inv-2'])
    expect(find('keller')).toEqual(['u-3'])
    expect(find('nobody')).toEqual([])
    expect(find('')).toHaveLength(5)
  })

  it('filters by role, together with the search', () => {
    expect(
      filterAccessRows(rows, { ...all, role: 'OWNER' }).map((row) => row.id),
    ).toEqual(['u-1', 'inv-1'])
    expect(
      filterAccessRows(rows, { query: 'alex', role: 'VIEWER' }).map(
        (row) => row.id,
      ),
    ).toEqual(['inv-2'])
  })
})
