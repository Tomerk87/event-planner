import { describe, expect, it } from 'vitest'
import {
  makeApprovedGuest,
  makeEvent,
  makeGuest,
  makeTable,
} from '../test/factories.ts'
import { DomainError, isDomainError, type DomainErrorCode } from './errors.ts'
import { validateEventInput, type EventInput } from './events.ts'
import {
  fromLocalDateTime,
  isEventPast,
  isValidTimeZone,
  toLocalDateTime,
} from './eventTime.ts'
import {
  buildGuestExportRows,
  buildSeatingDetailRows,
  buildSeatingSummaryRows,
} from './exports.ts'
import {
  addGuest,
  editGuest,
  recordInvitationSent,
  softDeleteGuest,
} from './guests.ts'
import { renderMessage } from './messages.ts'
import {
  computeDashboardMetrics,
  computeDashboardWarnings,
  deriveRecentActivity,
} from './metrics.ts'
import type { EventMembership, MessageSend } from './models.ts'
import {
  assertCan,
  assertCanChangeMembership,
  can,
  effectiveRole,
  type Actor,
  type EventAction,
} from './permissions.ts'
import { normalizePhone } from './phone.ts'
import type { EventRole } from './roles.ts'
import { applyRsvp, resolveRsvp, validatePublicRsvpInput } from './rsvp.ts'
import {
  assertCanAssign,
  findTableConflicts,
  tableOccupancy,
  validateTableInput,
} from './seating.ts'

function codeOf(run: () => unknown): DomainErrorCode | 'NO_ERROR' {
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

function detailsOf(run: () => unknown) {
  try {
    run()
  } catch (error) {
    if (error instanceof DomainError) {
      return error.details
    }
  }
  return undefined
}

describe('DomainError', () => {
  it('carries a code and details and is recognised by isDomainError', () => {
    const error = new DomainError('TABLE_FULL', { capacity: 10 })

    expect(error).toBeInstanceOf(Error)
    expect(error.code).toBe('TABLE_FULL')
    expect(error.details).toEqual({ capacity: 10 })
    expect(isDomainError(error)).toBe(true)
    expect(isDomainError(error, 'TABLE_FULL')).toBe(true)
    expect(isDomainError(error, 'FORBIDDEN')).toBe(false)
    expect(isDomainError(new Error('x'))).toBe(false)
  })
})

describe('normalizePhone', () => {
  it.each([
    ['050-123-4567', '+972501234567'],
    ['0501234567', '+972501234567'],
    ['(050) 123.4567', '+972501234567'],
    ['+972 50 123 4567', '+972501234567'],
    ['+972-050-1234567', '+972501234567'],
    ['972501234567', '+972501234567'],
    ['00972501234567', '+972501234567'],
    ['03-1234567', '+97231234567'],
    ['+972 00-000-0142', '+972000000142'],
    ['000-000-0142', '+972000000142'],
    ['+1 202-555-0142', '+12025550142'],
    ['0012025550142', '+12025550142'],
  ])('normalizes %j to %s', (input, expected) => {
    expect(normalizePhone(input)).toBe(expected)
  })

  it('gives the same result for every way of writing one number', () => {
    const forms = ['050-123-4567', '+972501234567', '972 50 1234567']

    expect(new Set(forms.map(normalizePhone)).size).toBe(1)
  })

  it.each([
    '',
    '   ',
    'abc',
    '050-123-456a',
    '12345',
    '050-123',
    '+972 5',
    '+972 50 123 4567 89',
    '+1234567',
    '+1234567890123456',
    '501234567',
    '++972501234567',
  ])('rejects %j', (input) => {
    expect(codeOf(() => normalizePhone(input))).toBe('INVALID_PHONE')
  })
})

describe('event time', () => {
  it('converts a local date and time to the instant in the event time zone', () => {
    const summer = fromLocalDateTime(
      { year: 2025, month: 6, day: 15, hour: 18, minute: 30 },
      'Asia/Jerusalem',
    )
    const winter = fromLocalDateTime(
      { year: 2025, month: 1, day: 15, hour: 18, minute: 30 },
      'Asia/Jerusalem',
    )

    expect(summer.toISOString()).toBe('2025-06-15T15:30:00.000Z')
    expect(winter.toISOString()).toBe('2025-01-15T16:30:00.000Z')
  })

  it('handles a zone behind UTC and a half-hour offset', () => {
    expect(
      fromLocalDateTime(
        { year: 2025, month: 6, day: 15, hour: 18, minute: 30 },
        'America/New_York',
      ).toISOString(),
    ).toBe('2025-06-15T22:30:00.000Z')
    expect(
      fromLocalDateTime(
        { year: 2025, month: 6, day: 15, hour: 18, minute: 30 },
        'Asia/Kolkata',
      ).toISOString(),
    ).toBe('2025-06-15T13:00:00.000Z')
  })

  it('round-trips an instant through local date and time', () => {
    const instant = new Date('2025-10-26T21:15:00.000Z')
    const local = toLocalDateTime(instant, 'Asia/Jerusalem')

    expect(local).toEqual({
      year: 2025,
      month: 10,
      day: 26,
      hour: 23,
      minute: 15,
    })
    expect(fromLocalDateTime(local, 'Asia/Jerusalem')).toEqual(instant)
  })

  it('recognises valid and invalid time zones', () => {
    expect(isValidTimeZone('Asia/Jerusalem')).toBe(true)
    expect(isValidTimeZone('Mars/Olympus')).toBe(false)
  })

  it('treats an event as past from the instant it starts', () => {
    const event = makeEvent({ startsAt: '2030-06-15T15:30:00.000Z' })

    expect(isEventPast(event, new Date('2030-06-15T15:29:59.999Z'))).toBe(false)
    expect(isEventPast(event, new Date('2030-06-15T15:30:00.000Z'))).toBe(true)
    expect(isEventPast(event, new Date('2031-01-01T00:00:00.000Z'))).toBe(true)
  })
})

describe('validateEventInput', () => {
  const valid: EventInput = {
    name: '  Garden Celebration ',
    startsAt: '2030-06-15T15:30:00Z',
    timeZone: 'Asia/Jerusalem',
    maxAttendees: 300,
    defaultAllowedAttendees: 5,
    rsvpLanguage: 'he',
    location: '  ',
    rsvpTitle: ' Maya & Daniel ',
  }

  it('accepts valid input, trimming text and turning blank optional text into null', () => {
    expect(validateEventInput(valid)).toEqual({
      name: 'Garden Celebration',
      startsAt: '2030-06-15T15:30:00.000Z',
      timeZone: 'Asia/Jerusalem',
      maxAttendees: 300,
      defaultAllowedAttendees: 5,
      rsvpLanguage: 'he',
      location: null,
      rsvpTitle: 'Maya & Daniel',
    })
  })

  it.each([50, 3000])('accepts a maximum of %i attendees', (maxAttendees) => {
    expect(validateEventInput({ ...valid, maxAttendees }).maxAttendees).toBe(
      maxAttendees,
    )
  })

  it.each([49, 3001, 0, -50, 100.5, Number.NaN])(
    'rejects a maximum of %s attendees',
    (maxAttendees) => {
      const run = () => validateEventInput({ ...valid, maxAttendees })

      expect(codeOf(run)).toBe('VALIDATION')
      expect(detailsOf(run)).toMatchObject({
        field: 'maxAttendees',
        min: 50,
        max: 3000,
      })
    },
  )

  it.each([1, 10])('accepts a default allowance of %i', (value) => {
    expect(
      validateEventInput({ ...valid, defaultAllowedAttendees: value })
        .defaultAllowedAttendees,
    ).toBe(value)
  })

  it.each([0, 11, 2.5])('rejects a default allowance of %s', (value) => {
    const run = () =>
      validateEventInput({ ...valid, defaultAllowedAttendees: value })

    expect(detailsOf(run)).toMatchObject({ field: 'defaultAllowedAttendees' })
  })

  it.each([
    [{ name: '   ' }, 'name'],
    [{ startsAt: 'not a date' }, 'startsAt'],
    [{ timeZone: 'Mars/Olympus' }, 'timeZone'],
    [{ rsvpLanguage: 'fr' as 'en' }, 'rsvpLanguage'],
  ])('rejects %j', (patch, field) => {
    const run = () => validateEventInput({ ...valid, ...patch })

    expect(codeOf(run)).toBe('VALIDATION')
    expect(detailsOf(run)).toMatchObject({ field })
  })
})

describe('permissions', () => {
  const actor = (role: EventRole | null, isSuperUser = false): Actor => ({
    userId: 'u-me',
    isSuperUser,
    role,
  })
  const active = { isPastEvent: false }
  const past = { isPastEvent: true }

  const matrix: [EventAction, Record<EventRole, boolean>][] = [
    ['VIEW', { VIEWER: true, ADMIN: true, OWNER: true }],
    ['EXPORT', { VIEWER: true, ADMIN: true, OWNER: true }],
    ['EDIT', { VIEWER: false, ADMIN: true, OWNER: true }],
    ['SEND_MESSAGE', { VIEWER: false, ADMIN: true, OWNER: true }],
    ['VIEW_PERMISSIONS', { VIEWER: false, ADMIN: true, OWNER: true }],
    ['MANAGE_PERMISSIONS', { VIEWER: false, ADMIN: true, OWNER: true }],
    ['DUPLICATE_EVENT', { VIEWER: false, ADMIN: false, OWNER: true }],
    ['DELETE_EVENT', { VIEWER: false, ADMIN: false, OWNER: true }],
  ]

  describe.each(matrix)('%s on an active event', (action, expected) => {
    it.each(['VIEWER', 'ADMIN', 'OWNER'] as const)('as %s', (role) => {
      expect(can(action, actor(role), active)).toBe(expected[role])
    })

    it('is allowed for a Super User without a membership', () => {
      expect(can(action, actor(null, true), active)).toBe(true)
    })

    it('is refused without a membership', () => {
      expect(codeOf(() => assertCan(action, actor(null), active))).toBe(
        'FORBIDDEN',
      )
    })
  })

  it.each(['EDIT', 'SEND_MESSAGE'] as const)(
    'blocks %s on a past event for every role, including a Super User',
    (action) => {
      expect(codeOf(() => assertCan(action, actor('OWNER'), past))).toBe(
        'EVENT_READ_ONLY',
      )
      expect(codeOf(() => assertCan(action, actor('ADMIN'), past))).toBe(
        'EVENT_READ_ONLY',
      )
      expect(codeOf(() => assertCan(action, actor(null, true), past))).toBe(
        'EVENT_READ_ONLY',
      )
    },
  )

  it('reports a Viewer of a past event as forbidden, not read-only', () => {
    expect(codeOf(() => assertCan('EDIT', actor('VIEWER'), past))).toBe(
      'FORBIDDEN',
    )
  })

  it.each(['VIEW', 'EXPORT'] as const)(
    'still allows %s on a past event',
    (action) => {
      expect(can(action, actor('VIEWER'), past)).toBe(true)
    },
  )

  it('treats a Super User as an Owner whatever their membership', () => {
    expect(effectiveRole(actor('VIEWER', true))).toBe('OWNER')
    expect(effectiveRole(actor(null))).toBeNull()
  })

  describe('changing memberships', () => {
    const members = (...list: [string, EventRole][]): EventMembership[] =>
      list.map(([userId, role]) => ({ eventId: 'evt-1', userId, role }))
    const base = members(
      ['u-me', 'OWNER'],
      ['u-owner2', 'OWNER'],
      ['u-admin', 'ADMIN'],
      ['u-viewer', 'VIEWER'],
    )
    const change = (
      by: Actor,
      userId: string,
      newRole: EventRole | null,
      list = base,
    ) =>
      codeOf(() =>
        assertCanChangeMembership(by, list, {
          eventId: 'evt-1',
          userId,
          newRole,
        }),
      )

    it('lets an Owner grant, change and remove any role for others', () => {
      expect(change(actor('OWNER'), 'u-new', 'OWNER')).toBe('NO_ERROR')
      expect(change(actor('OWNER'), 'u-admin', 'OWNER')).toBe('NO_ERROR')
      expect(change(actor('OWNER'), 'u-owner2', 'VIEWER')).toBe('NO_ERROR')
      expect(change(actor('OWNER'), 'u-viewer', null)).toBe('NO_ERROR')
    })

    it('lets an Admin manage Admin and Viewer permissions', () => {
      const admin: Actor = {
        userId: 'u-admin2',
        isSuperUser: false,
        role: 'ADMIN',
      }

      expect(change(admin, 'u-new', 'ADMIN')).toBe('NO_ERROR')
      expect(change(admin, 'u-new', 'VIEWER')).toBe('NO_ERROR')
      expect(change(admin, 'u-viewer', 'ADMIN')).toBe('NO_ERROR')
      expect(change(admin, 'u-admin', null)).toBe('NO_ERROR')
    })

    it('stops an Admin from granting Owner or touching an Owner', () => {
      const admin: Actor = {
        userId: 'u-admin2',
        isSuperUser: false,
        role: 'ADMIN',
      }

      expect(change(admin, 'u-new', 'OWNER')).toBe('FORBIDDEN')
      expect(change(admin, 'u-viewer', 'OWNER')).toBe('FORBIDDEN')
      expect(change(admin, 'u-owner2', 'ADMIN')).toBe('FORBIDDEN')
      expect(change(admin, 'u-owner2', null)).toBe('FORBIDDEN')
    })

    it('stops a Viewer and a non-member from managing permissions', () => {
      expect(change(actor('VIEWER'), 'u-new', 'VIEWER')).toBe('FORBIDDEN')
      expect(change(actor(null), 'u-new', 'VIEWER')).toBe('FORBIDDEN')
    })

    it('stops anyone from changing or removing their own permission', () => {
      expect(change(actor('OWNER'), 'u-me', 'ADMIN')).toBe('SELF_PERMISSION')
      expect(change(actor('OWNER'), 'u-me', null)).toBe('SELF_PERMISSION')
    })

    it('keeps at least one Owner', () => {
      const single = members(['u-owner', 'OWNER'], ['u-admin', 'ADMIN'])
      const superUser = actor(null, true)

      expect(change(superUser, 'u-owner', 'ADMIN', single)).toBe('LAST_OWNER')
      expect(change(superUser, 'u-owner', null, single)).toBe('LAST_OWNER')
      expect(change(superUser, 'u-owner', 'OWNER', single)).toBe('NO_ERROR')
    })

    it('counts Owners per event', () => {
      const list: EventMembership[] = [
        { eventId: 'evt-1', userId: 'u-owner', role: 'OWNER' },
        { eventId: 'evt-2', userId: 'u-other', role: 'OWNER' },
      ]

      expect(change(actor(null, true), 'u-owner', null, list)).toBe(
        'LAST_OWNER',
      )
    })

    it('cannot remove someone who is not a member', () => {
      expect(change(actor('OWNER'), 'u-stranger', null)).toBe('NOT_FOUND')
    })
  })
})

describe('guests', () => {
  const input = {
    firstName: ' Jordan ',
    lastName: ' Reed ',
    phone: ' 050-123-4567 ',
    allowedAttendees: 4,
  }

  it('creates a guest with no response, no sends and no table', () => {
    const { guest, restored } = addGuest([], 'evt-1', input, 'g-new')

    expect(restored).toBe(false)
    expect(guest).toEqual({
      id: 'g-new',
      eventId: 'evt-1',
      firstName: 'Jordan',
      lastName: 'Reed',
      invitationName: null,
      phone: '050-123-4567',
      normalizedPhone: '+972501234567',
      allowedAttendees: 4,
      confirmedAttendees: null,
      rsvpStatus: 'NO_RESPONSE',
      invitationSentCount: 0,
      lastInvitationSentAt: null,
      lastRsvpResponseAt: null,
      tableId: null,
      deleted: false,
    })
  })

  it('rejects a phone already used by an active guest, however it is written', () => {
    const existing = makeGuest({ normalizedPhone: '+972501234567' })

    expect(
      codeOf(() =>
        addGuest(
          [existing],
          'evt-1',
          { ...input, phone: '+972 50 123 4567' },
          'x',
        ),
      ),
    ).toBe('DUPLICATE_PHONE')
  })

  it('allows the same phone in a different event', () => {
    const elsewhere = makeGuest({
      eventId: 'evt-2',
      normalizedPhone: '+972501234567',
    })

    expect(addGuest([elsewhere], 'evt-1', input, 'g-new').restored).toBe(false)
  })

  it('restores a soft-deleted guest with a fresh RSVP, no table, and the counter kept', () => {
    const deleted = makeApprovedGuest(3, {
      id: 'g-old',
      firstName: 'Old',
      lastName: 'Name',
      invitationName: 'The Old Family',
      normalizedPhone: '+972501234567',
      invitationSentCount: 4,
      lastInvitationSentAt: '2030-01-01T10:00:00.000Z',
      tableId: 't-1',
      deleted: true,
    })

    const { guest, restored } = addGuest([deleted], 'evt-1', input, 'g-unused')

    expect(restored).toBe(true)
    expect(guest).toMatchObject({
      id: 'g-old',
      firstName: 'Jordan',
      lastName: 'Reed',
      allowedAttendees: 4,
      invitationName: null,
      rsvpStatus: 'NO_RESPONSE',
      confirmedAttendees: null,
      lastRsvpResponseAt: null,
      tableId: null,
      deleted: false,
      invitationSentCount: 4,
      lastInvitationSentAt: '2030-01-01T10:00:00.000Z',
    })
  })

  it.each([
    [{ firstName: '  ' }, 'VALIDATION'],
    [{ allowedAttendees: 0 }, 'VALIDATION'],
    [{ allowedAttendees: 11 }, 'VALIDATION'],
    [{ allowedAttendees: 2.5 }, 'VALIDATION'],
    [{ phone: 'abc' }, 'INVALID_PHONE'],
  ] as const)('rejects %j', (patch, code) => {
    expect(
      codeOf(() => addGuest([], 'evt-1', { ...input, ...patch }, 'x')),
    ).toBe(code)
  })

  it('accepts a guest without a last name', () => {
    expect(
      addGuest([], 'evt-1', { ...input, lastName: '' }, 'x').guest.lastName,
    ).toBe('')
  })

  it('edits organizer fields without touching RSVP data', () => {
    const guest = makeApprovedGuest(2, {
      invitationName: 'Jordan & Sam',
      tableId: 't-1',
    })

    const edited = editGuest([guest], guest, input)

    expect(edited).toMatchObject({
      firstName: 'Jordan',
      normalizedPhone: '+972501234567',
      allowedAttendees: 4,
      invitationName: 'Jordan & Sam',
      rsvpStatus: 'APPROVED',
      confirmedAttendees: 2,
      tableId: 't-1',
    })
  })

  it('lets a guest keep their own phone but not take another active guest’s', () => {
    const guest = makeGuest({ normalizedPhone: '+972501234567' })
    const other = makeGuest({ normalizedPhone: '+972521111111' })
    const deleted = makeGuest({
      normalizedPhone: '+972531111111',
      deleted: true,
    })
    const all = [guest, other, deleted]

    expect(codeOf(() => editGuest(all, guest, input))).toBe('NO_ERROR')
    expect(
      codeOf(() => editGuest(all, guest, { ...input, phone: '052-111-1111' })),
    ).toBe('DUPLICATE_PHONE')
    expect(
      codeOf(() => editGuest(all, guest, { ...input, phone: '053-111-1111' })),
    ).toBe('NO_ERROR')
  })

  it('refuses to lower the allowance below an already confirmed count', () => {
    const guest = makeApprovedGuest(5, { normalizedPhone: '+972501234567' })

    expect(
      codeOf(() =>
        editGuest([guest], guest, { ...input, allowedAttendees: 4 }),
      ),
    ).toBe('INVALID_ATTENDEE_COUNT')
    expect(
      codeOf(() =>
        editGuest([guest], guest, { ...input, allowedAttendees: 5 }),
      ),
    ).toBe('NO_ERROR')
  })

  it('soft-deletes a guest and frees their seats', () => {
    const deleted = softDeleteGuest(makeApprovedGuest(3, { tableId: 't-1' }))

    expect(deleted.deleted).toBe(true)
    expect(deleted.tableId).toBeNull()
    expect(deleted.rsvpStatus).toBe('APPROVED')
  })

  it('increments the invitation counter by exactly one per send', () => {
    let guest = makeGuest()
    for (let send = 1; send <= 5; send += 1) {
      guest = recordInvitationSent(guest, `2030-01-0${send}T10:00:00.000Z`)
      expect(guest.invitationSentCount).toBe(send)
    }

    expect(guest.lastInvitationSentAt).toBe('2030-01-05T10:00:00.000Z')
  })
})

describe('RSVP', () => {
  it.each([1, 3, 5])(
    'approves %i attendees within an allowance of 5',
    (count) => {
      expect(resolveRsvp('APPROVED', count, 5)).toEqual({
        rsvpStatus: 'APPROVED',
        confirmedAttendees: count,
      })
    },
  )

  it.each([0, -1, 6, 2.5, null, Number.NaN])(
    'rejects an approval for %s attendees with an allowance of 5',
    (count) => {
      const run = () => resolveRsvp('APPROVED', count, 5)

      expect(codeOf(run)).toBe('INVALID_ATTENDEE_COUNT')
      expect(detailsOf(run)).toEqual({ min: 1, max: 5 })
    },
  )

  it('stores zero for Declined and nothing for Not Sure and No Response, discarding any count', () => {
    expect(resolveRsvp('DECLINED', 4, 5)).toEqual({
      rsvpStatus: 'DECLINED',
      confirmedAttendees: 0,
    })
    expect(resolveRsvp('NOT_SURE', 4, 5)).toEqual({
      rsvpStatus: 'NOT_SURE',
      confirmedAttendees: null,
    })
    expect(resolveRsvp('NO_RESPONSE', 4, 5)).toEqual({
      rsvpStatus: 'NO_RESPONSE',
      confirmedAttendees: null,
    })
    expect(resolveRsvp('DECLINED', 99, 5).confirmedAttendees).toBe(0)
  })

  it('keeps the table when a guest stays Approved, even with more attendees', () => {
    const guest = makeApprovedGuest(2, { tableId: 't-1' })

    const updated = applyRsvp(
      guest,
      resolveRsvp('APPROVED', 5, 5),
      '2030-02-01T10:00:00.000Z',
    )

    expect(updated.tableId).toBe('t-1')
    expect(updated.confirmedAttendees).toBe(5)
    expect(updated.lastRsvpResponseAt).toBe('2030-02-01T10:00:00.000Z')
  })

  it.each(['DECLINED', 'NOT_SURE', 'NO_RESPONSE'] as const)(
    'clears the table when a guest moves from Approved to %s',
    (status) => {
      const guest = makeApprovedGuest(2, { tableId: 't-1' })

      expect(
        applyRsvp(guest, resolveRsvp(status, 2, 5), '2030-02-01T10:00:00.000Z')
          .tableId,
      ).toBeNull()
    },
  )

  describe('public form input', () => {
    const valid = {
      name: ' Jordan & Sam ',
      phone: '050-123-4567',
      status: 'APPROVED' as const,
      attendees: 2,
    }

    it('accepts valid input and trims the name', () => {
      expect(validatePublicRsvpInput(valid)).toEqual({ name: 'Jordan & Sam' })
    })

    it.each(['APPROVED', 'DECLINED', 'NOT_SURE'] as const)(
      'requires the number of attendees for %s too',
      (status) => {
        expect(
          codeOf(() =>
            validatePublicRsvpInput({
              ...valid,
              status,
              attendees: Number.NaN,
            }),
          ),
        ).toBe('INVALID_ATTENDEE_COUNT')
        expect(
          codeOf(() =>
            validatePublicRsvpInput({ ...valid, status, attendees: 0 }),
          ),
        ).toBe('INVALID_ATTENDEE_COUNT')
      },
    )

    it.each([1, 10])('accepts %i attendees', (attendees) => {
      expect(
        codeOf(() => validatePublicRsvpInput({ ...valid, attendees })),
      ).toBe('NO_ERROR')
    })

    it.each([11, 1.5, -2])('rejects %s attendees', (attendees) => {
      expect(
        codeOf(() => validatePublicRsvpInput({ ...valid, attendees })),
      ).toBe('INVALID_ATTENDEE_COUNT')
    })

    it('rejects a blank name and an unknown status', () => {
      expect(
        codeOf(() => validatePublicRsvpInput({ ...valid, name: ' ' })),
      ).toBe('VALIDATION')
      expect(
        codeOf(() =>
          validatePublicRsvpInput({
            ...valid,
            status: 'NO_RESPONSE' as 'APPROVED',
          }),
        ),
      ).toBe('VALIDATION')
    })
  })
})

describe('seating', () => {
  const table = makeTable({ id: 't-1', capacity: 10 })

  it('counts only active Approved guests at the table', () => {
    const guests = [
      makeApprovedGuest(4, { tableId: 't-1' }),
      makeApprovedGuest(3, { tableId: 't-1' }),
      makeApprovedGuest(5, { tableId: 't-2' }),
      makeApprovedGuest(2, { tableId: 't-1', deleted: true }),
      makeGuest({
        tableId: 't-1',
        rsvpStatus: 'DECLINED',
        confirmedAttendees: 0,
      }),
    ]

    expect(tableOccupancy('t-1', guests)).toBe(7)
  })

  it('seats a party that exactly fills the table and refuses one more', () => {
    const seated = makeApprovedGuest(6, { tableId: 't-1' })
    const fits = makeApprovedGuest(4)
    const tooBig = makeApprovedGuest(5)
    const run = () => assertCanAssign(tooBig, table, [seated, fits, tooBig])

    expect(codeOf(() => assertCanAssign(fits, table, [seated, fits]))).toBe(
      'NO_ERROR',
    )
    expect(codeOf(run)).toBe('TABLE_FULL')
    expect(detailsOf(run)).toEqual({ capacity: 10, available: 4, needed: 5 })
  })

  it('does not count the guest against themselves when re-seating at the same table', () => {
    const guest = makeApprovedGuest(10, { tableId: 't-1' })

    expect(codeOf(() => assertCanAssign(guest, table, [guest]))).toBe(
      'NO_ERROR',
    )
  })

  it.each([
    ['NO_RESPONSE', null],
    ['NOT_SURE', null],
    ['DECLINED', 0],
  ] as const)(
    'refuses to seat a %s guest',
    (rsvpStatus, confirmedAttendees) => {
      const guest = makeGuest({ rsvpStatus, confirmedAttendees })

      expect(codeOf(() => assertCanAssign(guest, table, [guest]))).toBe(
        'GUEST_NOT_APPROVED',
      )
    },
  )

  it('refuses to seat a deleted guest', () => {
    const guest = makeApprovedGuest(2, { deleted: true })

    expect(codeOf(() => assertCanAssign(guest, table, [guest]))).toBe(
      'GUEST_NOT_APPROVED',
    )
  })

  it('always allows unassigning', () => {
    const guest = makeGuest({ rsvpStatus: 'DECLINED', confirmedAttendees: 0 })

    expect(codeOf(() => assertCanAssign(guest, null, [guest]))).toBe('NO_ERROR')
  })

  it('reports a table overfilled by an RSVP increase as a conflict', () => {
    const tables = [
      makeTable({ id: 't-2', number: 14, capacity: 8 }),
      makeTable({ id: 't-1', number: 12, capacity: 10 }),
      makeTable({ id: 't-3', number: 3, capacity: 10 }),
    ]
    const guests = [
      makeApprovedGuest(12, { tableId: 't-1' }),
      makeApprovedGuest(9, { tableId: 't-2' }),
      makeApprovedGuest(10, { tableId: 't-3' }),
    ]

    expect(findTableConflicts(tables, guests)).toEqual([
      { tableId: 't-1', tableNumber: 12, over: 2 },
      { tableId: 't-2', tableNumber: 14, over: 1 },
    ])
  })

  describe('table input', () => {
    const existing = [
      makeTable({ id: 't-1', number: 1 }),
      makeTable({ id: 't-2', number: 2 }),
    ]
    const input = {
      number: 3,
      name: ' Friends ',
      capacity: 12,
      shape: 'SQUARE' as const,
    }

    it('accepts a new table and trims its name', () => {
      expect(validateTableInput(input, existing, null)).toEqual({
        number: 3,
        name: 'Friends',
        capacity: 12,
        shape: 'SQUARE',
      })
    })

    it('rejects a number already used in the event', () => {
      expect(
        codeOf(() =>
          validateTableInput({ ...input, number: 2 }, existing, null),
        ),
      ).toBe('DUPLICATE_TABLE_NUMBER')
    })

    it('lets a table keep its own number when edited', () => {
      expect(
        codeOf(() =>
          validateTableInput({ ...input, number: 2 }, existing, 't-2'),
        ),
      ).toBe('NO_ERROR')
    })

    it.each([
      [{ number: 0 }, 'number'],
      [{ number: 1.5 }, 'number'],
      [{ capacity: 0 }, 'capacity'],
      [{ capacity: -4 }, 'capacity'],
      [{ name: ' ' }, 'name'],
      [{ shape: 'OVAL' as 'CIRCLE' }, 'shape'],
    ])('rejects %j', (patch, field) => {
      const run = () =>
        validateTableInput({ ...input, ...patch }, existing, null)

      expect(codeOf(run)).toBe('VALIDATION')
      expect(detailsOf(run)).toMatchObject({ field })
    })
  })
})

describe('dashboard', () => {
  const tables = [
    makeTable({ id: 't-1', number: 1, capacity: 10 }),
    makeTable({ id: 't-2', number: 2, capacity: 8 }),
  ]
  const guests = [
    makeApprovedGuest(4, { tableId: 't-1', invitationSentCount: 5 }),
    makeApprovedGuest(7, { tableId: 't-1' }),
    makeApprovedGuest(3, { invitationSentCount: 0 }),
    makeGuest({ invitationSentCount: 2 }),
    makeGuest({ invitationSentCount: 1 }),
    makeGuest(),
    makeGuest({
      rsvpStatus: 'NOT_SURE',
      invitationSentCount: 1,
      confirmedAttendees: null,
    }),
    makeGuest({
      rsvpStatus: 'DECLINED',
      invitationSentCount: 1,
      confirmedAttendees: 0,
    }),
    makeApprovedGuest(9, { deleted: true, invitationSentCount: 3 }),
  ]
  const metrics = computeDashboardMetrics(guests, tables)

  it('derives every figure from active guests and tables', () => {
    expect(metrics).toEqual({
      totalGuests: 8,
      invitationsSent: 6,
      invitationsNotSent: 2,
      awaitingResponse: 2,
      rsvpApproved: 3,
      rsvpNotSure: 1,
      rsvpDeclined: 1,
      confirmedAttendees: 14,
      seatingCapacity: 18,
      unassignedConfirmedAttendees: 3,
    })
  })

  it('counts a guest sent five invitations once', () => {
    const single = [makeGuest({ invitationSentCount: 5 })]

    expect(computeDashboardMetrics(single, []).invitationsSent).toBe(1)
  })

  it('keeps invitation counts consistent', () => {
    expect(metrics.invitationsSent + metrics.invitationsNotSent).toBe(
      metrics.totalGuests,
    )
  })

  it('excludes Not Sure guests from confirmed attendees', () => {
    const list = [
      makeGuest({ rsvpStatus: 'NOT_SURE', confirmedAttendees: null }),
      makeApprovedGuest(2),
    ]

    expect(computeDashboardMetrics(list, []).confirmedAttendees).toBe(2)
  })

  it('returns zeros for an event with no guests or tables', () => {
    expect(computeDashboardMetrics([], [])).toEqual({
      totalGuests: 0,
      invitationsSent: 0,
      invitationsNotSent: 0,
      awaitingResponse: 0,
      rsvpApproved: 0,
      rsvpNotSure: 0,
      rsvpDeclined: 0,
      confirmedAttendees: 0,
      seatingCapacity: 0,
      unassignedConfirmedAttendees: 0,
    })
  })

  it('warns about tables over capacity, seating below the maximum and attendees awaiting a table', () => {
    expect(
      computeDashboardWarnings({ maxAttendees: 50 }, metrics, guests, tables),
    ).toEqual({
      attendeesOverMaximum: 0,
      seatingVersusMaximum: -32,
      tablesOverCapacity: [{ tableId: 't-1', tableNumber: 1, over: 1 }],
      attendeesAwaitingTable: 3,
    })
  })

  it('warns when confirmed attendees or chairs exceed the event maximum', () => {
    const warnings = computeDashboardWarnings(
      { maxAttendees: 12 },
      metrics,
      guests,
      tables,
    )

    expect(warnings.attendeesOverMaximum).toBe(2)
    expect(warnings.seatingVersusMaximum).toBe(6)
  })

  it('has nothing to warn about when everything matches', () => {
    const table = makeTable({ id: 't-9', capacity: 50 })
    const list = [makeApprovedGuest(5, { tableId: 't-9' })]

    expect(
      computeDashboardWarnings(
        { maxAttendees: 50 },
        computeDashboardMetrics(list, [table]),
        list,
        [table],
      ),
    ).toEqual({
      attendeesOverMaximum: 0,
      seatingVersusMaximum: 0,
      tablesOverCapacity: [],
      attendeesAwaitingTable: 0,
    })
  })
})

describe('recent activity', () => {
  const send = (guestId: string, sentAt: string): MessageSend => ({
    id: `s-${sentAt}`,
    eventId: 'evt-1',
    guestId,
    sentAt,
    message: 'Hello',
  })

  it('lists sends and each guest’s latest response, newest first', () => {
    const approved = makeApprovedGuest(4, {
      id: 'g-a',
      lastRsvpResponseAt: '2030-01-05T10:00:00.000Z',
    })
    const declined = makeGuest({
      id: 'g-b',
      rsvpStatus: 'DECLINED',
      confirmedAttendees: 0,
      lastRsvpResponseAt: '2030-01-03T10:00:00.000Z',
    })
    const silent = makeGuest({ id: 'g-c' })
    const sends = [
      send('g-a', '2030-01-01T10:00:00.000Z'),
      send('g-a', '2030-01-04T10:00:00.000Z'),
      send('g-c', '2030-01-06T10:00:00.000Z'),
    ]

    expect(
      deriveRecentActivity([approved, declined, silent], sends, 10),
    ).toEqual([
      {
        kind: 'INVITATION_SENT',
        guestId: 'g-c',
        at: '2030-01-06T10:00:00.000Z',
      },
      {
        kind: 'RSVP',
        guestId: 'g-a',
        at: '2030-01-05T10:00:00.000Z',
        status: 'APPROVED',
        confirmedAttendees: 4,
      },
      {
        kind: 'INVITATION_SENT',
        guestId: 'g-a',
        at: '2030-01-04T10:00:00.000Z',
      },
      {
        kind: 'RSVP',
        guestId: 'g-b',
        at: '2030-01-03T10:00:00.000Z',
        status: 'DECLINED',
        confirmedAttendees: 0,
      },
      {
        kind: 'INVITATION_SENT',
        guestId: 'g-a',
        at: '2030-01-01T10:00:00.000Z',
      },
    ])
  })

  it('respects the limit and leaves out deleted guests', () => {
    const active = makeApprovedGuest(2, { id: 'g-a' })
    const deleted = makeApprovedGuest(2, { id: 'g-d', deleted: true })
    const sends = [
      send('g-d', '2030-03-01T10:00:00.000Z'),
      send('g-a', '2030-01-01T09:00:00.000Z'),
    ]

    const activity = deriveRecentActivity([active, deleted], sends, 1)

    expect(activity).toHaveLength(1)
    expect(activity[0]?.guestId).toBe('g-a')
  })

  it('does not list a guest reset to No Response as an RSVP', () => {
    const reset = makeGuest({ lastRsvpResponseAt: '2030-01-05T10:00:00.000Z' })

    expect(deriveRecentActivity([reset], [], 10)).toEqual([])
  })
})

describe('renderMessage', () => {
  const values = {
    first_name: 'Jordan',
    last_name: 'Reed',
    event_name: 'Garden Celebration',
    event_date: 'Jun 15, 2030',
    event_time: '18:30',
    rsvp_url: 'https://rsvp.example.com/garden',
  }

  it('fills every supported variable, each time it appears', () => {
    expect(
      renderMessage(
        'Hello {{first_name}} {{last_name}}, join {{event_name}} on {{event_date}} at {{event_time}}: {{rsvp_url}}. See you, {{first_name}}!',
        values,
      ),
    ).toBe(
      'Hello Jordan Reed, join Garden Celebration on Jun 15, 2030 at 18:30: https://rsvp.example.com/garden. See you, Jordan!',
    )
  })

  it('tolerates spaces inside the braces', () => {
    expect(renderMessage('Hi {{ first_name }}', values)).toBe('Hi Jordan')
  })

  it('leaves unknown variables and plain text untouched', () => {
    expect(renderMessage('Hi {{nickname}} {first_name} {{}}', values)).toBe(
      'Hi {{nickname}} {first_name} {{}}',
    )
  })

  it('does not re-expand a value that itself looks like a variable', () => {
    expect(
      renderMessage('{{first_name}}', {
        ...values,
        first_name: '{{last_name}}',
      }),
    ).toBe('{{last_name}}')
  })
})

describe('exports', () => {
  const tables = [
    makeTable({ id: 't-2', number: 2, name: 'Friends', capacity: 8 }),
    makeTable({ id: 't-1', number: 1, name: 'Family', capacity: 10 }),
    makeTable({ id: 't-3', number: 3, name: 'Empty', capacity: 6 }),
  ]
  const guests = [
    makeApprovedGuest(9, {
      firstName: 'Riley',
      lastName: 'Brooks',
      invitationName: 'Riley & co',
      phone: '+972 00-000-0003',
      tableId: 't-2',
    }),
    makeApprovedGuest(4, {
      firstName: 'Sam',
      lastName: 'Carter',
      phone: '+972 00-000-0002',
      tableId: 't-1',
    }),
    makeApprovedGuest(2, {
      firstName: 'Alex',
      lastName: 'Carter',
      phone: '+972 00-000-0001',
      tableId: 't-1',
    }),
    makeGuest({
      firstName: 'Casey',
      lastName: 'Lane',
      phone: '+972 00-000-0004',
    }),
    makeApprovedGuest(3, {
      firstName: 'Gone',
      lastName: 'Guest',
      deleted: true,
    }),
  ]

  it('lists active guests by name with their table number', () => {
    const rows = buildGuestExportRows(guests, tables)

    expect(rows.map((row) => `${row.firstName} ${row.lastName}`)).toEqual([
      'Riley Brooks',
      'Alex Carter',
      'Sam Carter',
      'Casey Lane',
    ])
    expect(rows[0]).toEqual({
      firstName: 'Riley',
      lastName: 'Brooks',
      invitationName: 'Riley & co',
      phone: '+972 00-000-0003',
      allowedAttendees: 5,
      confirmedAttendees: 9,
      rsvpStatus: 'APPROVED',
      invitationSentCount: 1,
      tableNumber: 2,
    })
    expect(rows[3]).toMatchObject({ invitationName: '', tableNumber: null })
  })

  it('lists seated parties by table number for the venue', () => {
    expect(buildSeatingDetailRows(guests, tables)).toEqual([
      {
        tableNumber: 1,
        tableName: 'Family',
        firstName: 'Alex',
        lastName: 'Carter',
        invitationName: '',
        phone: '+972 00-000-0001',
        confirmedAttendees: 2,
      },
      {
        tableNumber: 1,
        tableName: 'Family',
        firstName: 'Sam',
        lastName: 'Carter',
        invitationName: '',
        phone: '+972 00-000-0002',
        confirmedAttendees: 4,
      },
      {
        tableNumber: 2,
        tableName: 'Friends',
        firstName: 'Riley',
        lastName: 'Brooks',
        invitationName: 'Riley & co',
        phone: '+972 00-000-0003',
        confirmedAttendees: 9,
      },
    ])
  })

  it('summarises every table, with a negative remainder when over capacity', () => {
    expect(buildSeatingSummaryRows(guests, tables)).toEqual([
      {
        tableNumber: 1,
        tableName: 'Family',
        capacity: 10,
        assigned: 6,
        remaining: 4,
      },
      {
        tableNumber: 2,
        tableName: 'Friends',
        capacity: 8,
        assigned: 9,
        remaining: -1,
      },
      {
        tableNumber: 3,
        tableName: 'Empty',
        capacity: 6,
        assigned: 0,
        remaining: 6,
      },
    ])
  })
})
