import { describe, expect, it } from 'vitest'
import {
  canManagePermissions,
  canOpenPermissions,
  canPerform,
  manageableRoles,
  getReadOnlyReason,
  type EventAccess,
} from './access.ts'
import type { EventAction } from './permissions.ts'

/** Every change a page can offer; each followed the old single edit right. */
const CHANGES: EventAction[] = [
  'EDIT_EVENT_SCHEDULE',
  'EDIT_EVENT_SETTINGS',
  'EDIT_GUESTS',
  'ASSIGN_SEATING',
  'EDIT_TABLES',
  'EDIT_LAYOUT',
  'EDIT_RSVP_SETTINGS',
  'EDIT_MESSAGE',
  'SEND_MESSAGE',
]
const canChangeAll = (access: EventAccess) =>
  CHANGES.every((action) => canPerform(access, action))
const canChangeAny = (access: EventAccess) =>
  CHANGES.some((action) => canPerform(access, action))

describe('getReadOnlyReason', () => {
  it.each(['OWNER', 'ADMIN'] as const)(
    'lets %s edit an active event',
    (role) => {
      expect(getReadOnlyReason({ role, isPastEvent: false })).toBeNull()
      expect(canChangeAll({ role, isPastEvent: false })).toBe(true)
    },
  )

  it('makes an active event read-only for a Viewer', () => {
    expect(getReadOnlyReason({ role: 'VIEWER', isPastEvent: false })).toBe(
      'VIEWER',
    )
    expect(canChangeAny({ role: 'VIEWER', isPastEvent: false })).toBe(false)
  })

  it.each(['OWNER', 'ADMIN', 'VIEWER'] as const)(
    'makes a past event read-only for %s',
    (role) => {
      expect(getReadOnlyReason({ role, isPastEvent: true })).toBe('PAST_EVENT')
      expect(canChangeAny({ role, isPastEvent: true })).toBe(false)
    },
  )
})

describe('canOpenPermissions', () => {
  it('allows Owner and Admin but not Viewer', () => {
    expect(canOpenPermissions('OWNER')).toBe(true)
    expect(canOpenPermissions('ADMIN')).toBe(true)
    expect(canOpenPermissions('VIEWER')).toBe(false)
  })
})

describe('canPerform', () => {
  it('lets every role export and view, even after the event', () => {
    for (const role of ['OWNER', 'ADMIN', 'VIEWER'] as const) {
      for (const isPastEvent of [false, true]) {
        expect(canPerform({ role, isPastEvent }, 'VIEW')).toBe(true)
        expect(canPerform({ role, isPastEvent }, 'EXPORT')).toBe(true)
        expect(canPerform({ role, isPastEvent }, 'EXPORT_GUESTS')).toBe(true)
      }
    }
  })

  it('keeps duplicating and deleting to the Owner', () => {
    const upcoming = { isPastEvent: false }
    expect(canPerform({ role: 'OWNER', ...upcoming }, 'DELETE_EVENT')).toBe(
      true,
    )
    expect(canPerform({ role: 'ADMIN', ...upcoming }, 'DELETE_EVENT')).toBe(
      false,
    )
    expect(canPerform({ role: 'ADMIN', ...upcoming }, 'DUPLICATE_EVENT')).toBe(
      false,
    )
  })
})

describe('canManagePermissions', () => {
  it('lets an Owner always, and an Admin until the event starts', () => {
    expect(canManagePermissions({ role: 'OWNER', isPastEvent: true })).toBe(
      true,
    )
    expect(canManagePermissions({ role: 'ADMIN', isPastEvent: false })).toBe(
      true,
    )
    expect(canManagePermissions({ role: 'ADMIN', isPastEvent: true })).toBe(
      false,
    )
    expect(canManagePermissions({ role: 'VIEWER', isPastEvent: false })).toBe(
      false,
    )
  })

  it('offers the roles each may hand out', () => {
    expect(manageableRoles({ role: 'OWNER', isPastEvent: false })).toEqual([
      'OWNER',
      'ADMIN',
      'VIEWER',
    ])
    expect(manageableRoles({ role: 'ADMIN', isPastEvent: false })).toEqual([
      'ADMIN',
      'VIEWER',
    ])
    expect(manageableRoles({ role: 'ADMIN', isPastEvent: true })).toEqual([])
  })
})
