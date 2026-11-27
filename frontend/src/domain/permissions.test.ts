import { describe, expect, it } from 'vitest'
import { DomainError } from './errors.ts'
import type { EventInput } from './events.ts'
import {
  assertCan,
  assertCanChangeInvitation,
  assertRoleCan,
  can,
  canHandleRole,
  eventUpdateActions,
  roleCan,
  type Actor,
  type EventAction,
} from './permissions.ts'
import { EVENT_ROLES, VENUE_EVENT_ROLES, type EventRole } from './roles.ts'

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

/**
 * The permission rules exactly as they were before the actions were split
 * (PLAN.md Phase 24), kept here to prove that personal events behave the same.
 */
type LegacyAction =
  | 'VIEW'
  | 'EXPORT'
  | 'EDIT'
  | 'SEND_MESSAGE'
  | 'VIEW_PERMISSIONS'
  | 'MANAGE_PERMISSIONS'
  | 'DUPLICATE_EVENT'
  | 'DELETE_EVENT'
const LEGACY_MINIMUM: Record<LegacyAction, EventRole> = {
  VIEW: 'VIEWER',
  EXPORT: 'VIEWER',
  EDIT: 'ADMIN',
  SEND_MESSAGE: 'ADMIN',
  VIEW_PERMISSIONS: 'ADMIN',
  MANAGE_PERMISSIONS: 'ADMIN',
  DUPLICATE_EVENT: 'OWNER',
  DELETE_EVENT: 'OWNER',
}
const LEGACY_RANK: Record<EventRole, number> = { VIEWER: 1, ADMIN: 2, OWNER: 3 }
function legacyAssertCan(
  action: LegacyAction,
  who: Actor,
  context: { isPastEvent: boolean },
): void {
  const role = who.isSuperUser ? 'OWNER' : who.role
  if (
    role === null ||
    LEGACY_RANK[role] < LEGACY_RANK[LEGACY_MINIMUM[action]]
  ) {
    throw new DomainError('FORBIDDEN', { action })
  }
  if (context.isPastEvent && (action === 'EDIT' || action === 'SEND_MESSAGE')) {
    throw new DomainError('EVENT_READ_ONLY', { action })
  }
  if (
    context.isPastEvent &&
    action === 'MANAGE_PERMISSIONS' &&
    role !== 'OWNER'
  ) {
    throw new DomainError('EVENT_READ_ONLY', { action })
  }
}

/** Each new action stands for what the old rules allowed through this one. */
const SPLIT_FROM: Record<EventAction, LegacyAction> = {
  VIEW: 'VIEW',
  EXPORT: 'EXPORT',
  EXPORT_GUESTS: 'EXPORT',
  EDIT: 'EDIT',
  EDIT_EVENT_SCHEDULE: 'EDIT',
  EDIT_EVENT_SETTINGS: 'EDIT',
  EDIT_GUESTS: 'EDIT',
  ASSIGN_SEATING: 'EDIT',
  EDIT_TABLES: 'EDIT',
  EDIT_LAYOUT: 'EDIT',
  EDIT_RSVP_SETTINGS: 'EDIT',
  EDIT_MESSAGE: 'EDIT',
  SEND_MESSAGE: 'SEND_MESSAGE',
  VIEW_PERMISSIONS: 'VIEW_PERMISSIONS',
  MANAGE_PERMISSIONS: 'MANAGE_PERMISSIONS',
  DUPLICATE_EVENT: 'DUPLICATE_EVENT',
  DELETE_EVENT: 'DELETE_EVENT',
}
const ACTIONS = Object.keys(SPLIT_FROM) as EventAction[]

describe('personal events keep the rules they had before the split', () => {
  const actors: [string, Actor][] = [
    ...EVENT_ROLES.map((role): [string, Actor] => [role, actor(role)]),
    ['no access', actor(null)],
    ['Super User', actor(null, true)],
    ['Super User who is a Viewer', actor('VIEWER', true)],
  ]
  const cases = actors.flatMap(([name, who]) =>
    ACTIONS.flatMap((action) =>
      [false, true].map(
        (isPastEvent) => [name, action, isPastEvent, who] as const,
      ),
    ),
  )

  it('covers every role, action and event state', () => {
    expect(cases).toHaveLength(actors.length * ACTIONS.length * 2)
  })

  it.each(cases)('%s, %s, past event %s', (_name, action, isPastEvent, who) => {
    const context = { isPastEvent }
    expect(codeOf(() => assertCan(action, who, context))).toBe(
      codeOf(() => legacyAssertCan(SPLIT_FROM[action], who, context)),
    )
  })
})

describe('venue-managed events (D112, D113)', () => {
  const upcoming = { isPastEvent: false }
  const allowed = (role: (typeof VENUE_EVENT_ROLES)[number]) =>
    ACTIONS.filter((action) => roleCan(action, role, upcoming))

  it('give the venue the schedule, the tables and the floor plan', () => {
    expect(allowed('VENUE_MANAGER')).toEqual([
      'VIEW',
      'EXPORT',
      'EDIT_EVENT_SCHEDULE',
      'EDIT_TABLES',
      'EDIT_LAYOUT',
      'VIEW_PERMISSIONS',
    ])
    expect(allowed('VENUE_OWNER')).toEqual([
      ...allowed('VENUE_MANAGER'),
      'DELETE_EVENT',
    ])
  })

  it('give the client the guests, RSVP, messages and seating', () => {
    expect(allowed('CLIENT_LEAD')).toEqual([
      'VIEW',
      'EXPORT',
      'EXPORT_GUESTS',
      'EDIT_EVENT_SETTINGS',
      'EDIT_GUESTS',
      'ASSIGN_SEATING',
      'EDIT_RSVP_SETTINGS',
      'EDIT_MESSAGE',
      'SEND_MESSAGE',
      'VIEW_PERMISSIONS',
      'MANAGE_PERMISSIONS',
    ])
    expect(allowed('CLIENT_EDITOR')).toEqual(
      allowed('CLIENT_LEAD').filter(
        (action) => action !== 'MANAGE_PERMISSIONS',
      ),
    )
    expect(allowed('CLIENT_VIEWER')).toEqual(['VIEW', 'EXPORT'])
  })

  it("never let one side change the other side's part", () => {
    const venue = new Set(allowed('VENUE_OWNER'))
    const client = new Set(allowed('CLIENT_LEAD'))
    const shared = new Set<EventAction>(['VIEW', 'EXPORT', 'VIEW_PERMISSIONS'])
    for (const action of venue) {
      if (!shared.has(action)) {
        expect(client.has(action), action).toBe(false)
      }
    }
  })

  it('keep the venue away from phone numbers and the old edit right', () => {
    for (const role of ['VENUE_OWNER', 'VENUE_MANAGER'] as const) {
      expect(roleCan('EXPORT_GUESTS', role, upcoming)).toBe(false)
      expect(roleCan('EDIT', role, upcoming)).toBe(false)
    }
    expect(roleCan('EXPORT_GUESTS', 'CLIENT_VIEWER', upcoming)).toBe(false)
  })

  it('make every change read-only once the event is past', () => {
    const past = { isPastEvent: true }
    for (const role of VENUE_EVENT_ROLES) {
      for (const action of allowed(role)) {
        const code = codeOf(() => assertRoleCan(action, role, past))
        if (
          [
            'VIEW',
            'EXPORT',
            'EXPORT_GUESTS',
            'VIEW_PERMISSIONS',
            'DELETE_EVENT',
          ].includes(action)
        ) {
          expect(code, `${role} ${action}`).toBe('NO_ERROR')
        } else if (action === 'MANAGE_PERMISSIONS') {
          expect(code, role).toBe(
            role === 'CLIENT_LEAD' ? 'NO_ERROR' : 'EVENT_READ_ONLY',
          )
        } else {
          expect(code, `${role} ${action}`).toBe('EVENT_READ_ONLY')
        }
      }
    }
  })
})

describe('the actions an event update needs (D113)', () => {
  const event = {
    name: 'Maya & Daniel',
    startsAt: '2027-06-18T17:30:00.000Z',
    timeZone: 'Asia/Jerusalem',
    maxAttendees: 300,
    defaultAllowedAttendees: 5,
    rsvpLanguage: 'en',
    country: 'IL',
    location: 'Seaside Hall',
    rsvpTitle: null,
    coverImage: null,
  } as const
  const input = (changes: Partial<EventInput> = {}): EventInput => ({
    name: event.name,
    startsAt: event.startsAt,
    timeZone: event.timeZone,
    maxAttendees: event.maxAttendees,
    defaultAllowedAttendees: event.defaultAllowedAttendees,
    rsvpLanguage: event.rsvpLanguage,
    country: event.country,
    location: event.location,
    ...changes,
  })

  it('asks for the schedule when the date, time zone, place or size changes', () => {
    for (const change of [
      { startsAt: '2027-06-19T17:30:00.000Z' },
      { timeZone: 'America/Sao_Paulo' },
      { location: 'Garden' },
      { maxAttendees: 350 },
    ]) {
      expect(eventUpdateActions(event, input(change))).toEqual([
        'EDIT_EVENT_SCHEDULE',
      ])
    }
  })

  it('asks for the settings when the name, photo or guest settings change', () => {
    for (const change of [
      { name: 'Maya & Dan' },
      { coverImage: 'data:image/png;base64,AAAA' },
      { rsvpTitle: 'Our wedding' },
      { defaultAllowedAttendees: 4 },
      { rsvpLanguage: 'he' },
      { country: 'BR' },
    ] satisfies Partial<EventInput>[]) {
      expect(eventUpdateActions(event, input(change))).toEqual([
        'EDIT_EVENT_SETTINGS',
      ])
    }
  })

  it('asks for both when both change', () => {
    expect(
      eventUpdateActions(event, input({ name: 'New', maxAttendees: 400 })),
    ).toEqual(['EDIT_EVENT_SCHEDULE', 'EDIT_EVENT_SETTINGS'])
  })

  it('treats the same date written differently, spaces and an untouched photo as no change', () => {
    expect(
      eventUpdateActions(
        event,
        input({
          startsAt: '2027-06-18T20:30:00+03:00',
          name: ' Maya & Daniel ',
          location: 'Seaside Hall ',
          coverImage: undefined,
        }),
      ),
    ).toEqual(['EDIT_EVENT_SETTINGS'])
  })

  it('still needs the right to change the settings to save nothing', () => {
    expect(eventUpdateActions(event, input())).toEqual(['EDIT_EVENT_SETTINGS'])
  })
})
