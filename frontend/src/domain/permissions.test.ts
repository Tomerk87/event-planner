import { describe, expect, it } from 'vitest'
import { DomainError } from './errors.ts'
import {
  assertCan,
  assertCanChangeInvitation,
  can,
  canHandleRole,
  type Actor,
} from './permissions.ts'
import type { EventRole } from './roles.ts'

const actor = (role: EventRole | null, isSuperUser = false): Actor => ({
  userId: 'u-me',
  isSuperUser,
  role,
})

function codeOf(run: () => void): string {
  try {
    run()
  } catch (error) {
    if (error instanceof DomainError) {
      return error.code
    }
    throw error
  }
  return 'NO_ERROR'
}

describe('permissions of a past event', () => {
  const past = { isPastEvent: true }

  it('are managed by an Owner or a Super User only', () => {
    expect(can('MANAGE_PERMISSIONS', actor('OWNER'), past)).toBe(true)
    expect(can('MANAGE_PERMISSIONS', actor(null, true), past)).toBe(true)
    expect(
      codeOf(() => assertCan('MANAGE_PERMISSIONS', actor('ADMIN'), past)),
    ).toBe('EVENT_READ_ONLY')
    expect(
      codeOf(() => assertCan('MANAGE_PERMISSIONS', actor('VIEWER'), past)),
    ).toBe('FORBIDDEN')
  })

  it('can still be seen by an Admin', () => {
    expect(can('VIEW_PERMISSIONS', actor('ADMIN'), past)).toBe(true)
    expect(can('VIEW_PERMISSIONS', actor('VIEWER'), past)).toBe(false)
  })

  it('are managed by an Admin while the event is upcoming', () => {
    expect(
      can('MANAGE_PERMISSIONS', actor('ADMIN'), { isPastEvent: false }),
    ).toBe(true)
  })
})

describe('roles a user may hand out', () => {
  it.each([
    ['OWNER', { OWNER: true, ADMIN: true, VIEWER: true }],
    ['ADMIN', { OWNER: false, ADMIN: true, VIEWER: true }],
    ['VIEWER', { OWNER: false, ADMIN: false, VIEWER: false }],
  ] as const)('as %s', (own, expected) => {
    for (const role of ['OWNER', 'ADMIN', 'VIEWER'] as const) {
      expect(canHandleRole(actor(own), role)).toBe(expected[role])
    }
  })

  it('are every role for a Super User, none without access', () => {
    expect(canHandleRole(actor(null, true), 'OWNER')).toBe(true)
    expect(canHandleRole(actor(null), 'VIEWER')).toBe(false)
  })
})

describe('changing a pending invitation', () => {
  const change = (
    by: Actor,
    currentRole: EventRole | null,
    newRole: EventRole | null,
  ) => codeOf(() => assertCanChangeInvitation(by, { currentRole, newRole }))

  it('lets an Owner create, change and cancel any invitation', () => {
    expect(change(actor('OWNER'), null, 'OWNER')).toBe('NO_ERROR')
    expect(change(actor('OWNER'), 'OWNER', 'VIEWER')).toBe('NO_ERROR')
    expect(change(actor('OWNER'), 'ADMIN', null)).toBe('NO_ERROR')
  })

  it('keeps an Admin to Admin and Viewer invitations', () => {
    expect(change(actor('ADMIN'), null, 'ADMIN')).toBe('NO_ERROR')
    expect(change(actor('ADMIN'), 'VIEWER', 'ADMIN')).toBe('NO_ERROR')
    expect(change(actor('ADMIN'), 'VIEWER', null)).toBe('NO_ERROR')
    expect(change(actor('ADMIN'), null, 'OWNER')).toBe('FORBIDDEN')
    expect(change(actor('ADMIN'), 'ADMIN', 'OWNER')).toBe('FORBIDDEN')
    expect(change(actor('ADMIN'), 'OWNER', 'VIEWER')).toBe('FORBIDDEN')
    expect(change(actor('ADMIN'), 'OWNER', null)).toBe('FORBIDDEN')
  })

  it('refuses a Viewer and someone with no access', () => {
    expect(change(actor('VIEWER'), null, 'VIEWER')).toBe('FORBIDDEN')
    expect(change(actor(null), 'VIEWER', null)).toBe('FORBIDDEN')
  })
})
