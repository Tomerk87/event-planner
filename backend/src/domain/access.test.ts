import { describe, expect, it } from 'vitest'
import {
  canEditEvent,
  canOpenPermissions,
  getReadOnlyReason,
} from './access.ts'

describe('getReadOnlyReason', () => {
  it.each(['OWNER', 'ADMIN'] as const)(
    'lets %s edit an active event',
    (role) => {
      expect(getReadOnlyReason({ role, isPastEvent: false })).toBeNull()
      expect(canEditEvent({ role, isPastEvent: false })).toBe(true)
    },
  )

  it('makes an active event read-only for a Viewer', () => {
    expect(getReadOnlyReason({ role: 'VIEWER', isPastEvent: false })).toBe(
      'VIEWER',
    )
    expect(canEditEvent({ role: 'VIEWER', isPastEvent: false })).toBe(false)
  })

  it.each(['OWNER', 'ADMIN', 'VIEWER'] as const)(
    'makes a past event read-only for %s',
    (role) => {
      expect(getReadOnlyReason({ role, isPastEvent: true })).toBe('PAST_EVENT')
      expect(canEditEvent({ role, isPastEvent: true })).toBe(false)
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
