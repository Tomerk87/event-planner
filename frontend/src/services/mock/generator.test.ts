import { describe, expect, it } from 'vitest'
import { isEventPast } from '../../domain/eventTime.ts'
import { EVENT_LIMITS } from '../../domain/events.ts'
import { findTableConflicts, tableOccupancy } from '../../domain/seating.ts'
import { generateDemoState } from './generator.ts'
import { DATASET_VERSION } from './state.ts'

const NOW = new Date('2026-10-12T09:00:00.000Z')
const state = generateDemoState(NOW)
const main = state.events[0]!
const guestsOf = (eventId: string) =>
  state.guests.filter((guest) => guest.eventId === eventId)
const tablesOf = (eventId: string) =>
  state.tables.filter((table) => table.eventId === eventId)

describe('demo dataset generator', () => {
  it('produces identical data every time for the same moment', () => {
    expect(generateDemoState(NOW)).toEqual(state)
  })

  it('keeps the same people and structure when generated at another moment, shifting only dates', () => {
    const later = generateDemoState(new Date('2027-03-01T09:00:00.000Z'))

    expect(later.guests.map((guest) => guest.firstName)).toEqual(
      state.guests.map((guest) => guest.firstName),
    )
    expect(later.tables).toEqual(state.tables)
    expect(later.events[0]?.startsAt).not.toBe(main.startsAt)
  })

  it('has four upcoming and two past events, whenever it is generated', () => {
    for (const now of [NOW, new Date('2031-02-28T23:30:00.000Z')]) {
      const generated = generateDemoState(now)
      const past = generated.events.filter((event) => isEventPast(event, now))

      expect(generated.events).toHaveLength(6)
      expect(past).toHaveLength(2)
    }
  })

  it('keeps event settings within the product limits', () => {
    for (const event of state.events) {
      expect(event.maxAttendees).toBeGreaterThanOrEqual(
        EVENT_LIMITS.maxAttendees.min,
      )
      expect(event.maxAttendees).toBeLessThanOrEqual(
        EVENT_LIMITS.maxAttendees.max,
      )
      expect(event.defaultAllowedAttendees).toBe(5)
      expect(event.timeZone).toBe('Asia/Jerusalem')
    }
    expect(new Set(state.events.map((event) => event.rsvpSlug)).size).toBe(6)
  })

  it('starts the main event at 18:30 local time, sixty days ahead', () => {
    const start = new Date(main.startsAt)
    const local = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Jerusalem',
      hour: '2-digit',
      minute: '2-digit',
    }).format(start)

    expect(local).toBe('18:30')
    expect(
      Math.round((start.getTime() - NOW.getTime()) / 86_400_000),
    ).toBeGreaterThanOrEqual(59)
  })

  it('uses only fictional contact details', () => {
    for (const user of state.users) {
      expect(user.email).toMatch(/@example\.com$/)
      expect(user.isSuperUser).toBe(false)
    }
    for (const record of [...state.guests, ...state.unknownRsvps]) {
      // No Israeli operator code begins with 0, so these cannot be dialled.
      expect(record.phone).toMatch(/^\+972 00-\d{3}-\d{4}$/)
      expect(record.normalizedPhone).toMatch(/^\+9720\d{8}$/)
    }
    for (const send of state.messageSends) {
      expect(send.message).toContain('https://rsvp.example.com/')
    }
  })

  it('gives every guest a phone that is unique within their event', () => {
    for (const event of state.events) {
      const phones = [
        ...guestsOf(event.id),
        ...state.unknownRsvps.filter((unknown) => unknown.eventId === event.id),
      ].map((record) => record.normalizedPhone)

      expect(new Set(phones).size).toBe(phones.length)
    }
  })

  it('gives every guest a full name that is unique within their event', () => {
    for (const event of state.events) {
      const names = guestsOf(event.id).map(
        (guest) => `${guest.firstName} ${guest.lastName}`,
      )

      expect(new Set(names).size).toBe(names.length)
    }
  })

  it('keeps RSVP data consistent with each status', () => {
    for (const guest of state.guests) {
      expect(guest.allowedAttendees).toBeGreaterThanOrEqual(1)
      expect(guest.allowedAttendees).toBeLessThanOrEqual(10)
      if (guest.rsvpStatus === 'APPROVED') {
        expect(guest.confirmedAttendees).toBeGreaterThanOrEqual(1)
        expect(guest.confirmedAttendees).toBeLessThanOrEqual(
          guest.allowedAttendees,
        )
      } else if (guest.rsvpStatus === 'DECLINED') {
        expect(guest.confirmedAttendees).toBe(0)
      } else {
        expect(guest.confirmedAttendees).toBeNull()
      }
      if (guest.rsvpStatus === 'NO_RESPONSE') {
        expect(guest.invitationName).toBeNull()
        expect(guest.lastRsvpResponseAt).toBeNull()
      } else {
        expect(guest.invitationName).not.toBeNull()
        expect(guest.lastRsvpResponseAt).not.toBeNull()
      }
    }
    for (const unknown of state.unknownRsvps) {
      if (unknown.rsvpStatus === 'APPROVED') {
        expect(unknown.confirmedAttendees).toBeGreaterThanOrEqual(1)
        expect(unknown.confirmedAttendees).toBeLessThanOrEqual(5)
      }
    }
  })

  it('seats only active Approved guests, at tables of their own event', () => {
    const tables = new Map(state.tables.map((table) => [table.id, table]))

    for (const guest of state.guests) {
      if (guest.tableId === null) {
        continue
      }
      expect(guest.rsvpStatus).toBe('APPROVED')
      expect(guest.deleted).toBe(false)
      expect(tables.get(guest.tableId)?.eventId).toBe(guest.eventId)
    }
  })

  it('numbers tables uniquely within each event', () => {
    for (const event of state.events) {
      const numbers = tablesOf(event.id).map((table) => table.number)

      expect(new Set(numbers).size).toBe(numbers.length)
      expect(numbers.length).toBeGreaterThan(0)
    }
  })

  it('records one message per send, all before now and before the event', () => {
    for (const guest of state.guests) {
      const sends = state.messageSends
        .filter((send) => send.guestId === guest.id)
        .map((send) => send.sentAt)
        .sort()
      const event = state.events.find((item) => item.id === guest.eventId)!

      expect(sends).toHaveLength(guest.invitationSentCount)
      expect(guest.lastInvitationSentAt).toBe(sends[sends.length - 1] ?? null)
      for (const moment of [...sends, guest.lastRsvpResponseAt]) {
        if (moment !== null) {
          expect(new Date(moment).getTime()).toBeLessThan(NOW.getTime())
          expect(moment < event.startsAt).toBe(true)
        }
      }
      if (guest.lastRsvpResponseAt !== null && sends[0] !== undefined) {
        expect(guest.lastRsvpResponseAt > sends[0]).toBe(true)
      }
      if (guest.invitationSentCount === 0) {
        expect(guest.rsvpStatus).toBe('NO_RESPONSE')
      }
    }
  })

  it('gives every event an Owner and the demo user a different role in different events', () => {
    for (const event of state.events) {
      const roles = state.memberships
        .filter((membership) => membership.eventId === event.id)
        .map((membership) => membership.role)

      expect(roles).toContain('OWNER')
    }
    const mine = state.memberships.filter(
      (membership) => membership.userId === state.currentUserId,
    )

    expect(mine).toHaveLength(6)
    expect(new Set(mine.map((membership) => membership.role))).toEqual(
      new Set(['OWNER', 'ADMIN', 'VIEWER']),
    )
    expect(
      state.memberships.filter((membership) => membership.eventId === main.id)
        .length,
    ).toBe(6)
  })

  it('gives every event RSVP settings and a message template in its own language', () => {
    for (const event of state.events) {
      const template = state.messageTemplates.find(
        (item) => item.eventId === event.id,
      )
      const settings = state.rsvpSettings.find(
        (item) => item.eventId === event.id,
      )

      expect(template?.body).toContain('{{rsvp_url}}')
      expect(settings?.welcomeMessage.length).toBeGreaterThan(0)
      expect(/[֐-׿]/.test(template?.body ?? '')).toBe(
        event.rsvpLanguage === 'he',
      )
    }
  })

  it('gives the Hebrew event Hebrew guest names', () => {
    const hebrew = state.events.find((event) => event.rsvpLanguage === 'he')!

    for (const guest of guestsOf(hebrew.id)) {
      expect(guest.firstName).toMatch(/[֐-׿]/)
    }
  })

  it('includes every state the demo must show in the main event', () => {
    const guests = guestsOf(main.id)
    const active = guests.filter((guest) => !guest.deleted)
    const tables = tablesOf(main.id)
    const count = (test: (guest: (typeof guests)[number]) => boolean) =>
      active.filter(test).length

    expect(guests).toHaveLength(164)
    expect(tables).toHaveLength(18)
    expect(guests.filter((guest) => guest.deleted)).toHaveLength(5)
    expect(count((guest) => guest.invitationSentCount === 0)).toBeGreaterThan(0)
    expect(count((guest) => guest.invitationSentCount >= 2)).toBeGreaterThan(0)
    expect(
      count(
        (guest) =>
          guest.invitationSentCount > 0 && guest.rsvpStatus === 'NO_RESPONSE',
      ),
    ).toBeGreaterThan(0)
    expect(count((guest) => guest.rsvpStatus === 'APPROVED')).toBeGreaterThan(0)
    expect(count((guest) => guest.rsvpStatus === 'NOT_SURE')).toBeGreaterThan(0)
    expect(count((guest) => guest.rsvpStatus === 'DECLINED')).toBeGreaterThan(0)
    expect(
      count(
        (guest) => guest.rsvpStatus === 'APPROVED' && guest.tableId === null,
      ),
    ).toBeGreaterThan(0)
    expect(
      count((guest) => guest.allowedAttendees !== main.defaultAllowedAttendees),
    ).toBeGreaterThan(0)
    const unknown = state.unknownRsvps.filter(
      (candidate) => candidate.eventId === main.id,
    )
    expect(unknown.filter((candidate) => !candidate.rejectedAt)).toHaveLength(8)
    expect(unknown.filter((candidate) => candidate.rejectedAt)).toHaveLength(1)
    expect(
      tables.some(
        (table) => tableOccupancy(table.id, guests) === table.capacity,
      ),
    ).toBe(true)
    expect(
      findTableConflicts(tables, guests).map((conflict) => conflict.over),
    ).toEqual([2, 1])
  })

  it('has an over-capacity table in another event too, and none in the rest', () => {
    const conflicts = state.events.map(
      (event) =>
        findTableConflicts(tablesOf(event.id), guestsOf(event.id)).length,
    )

    expect(conflicts).toEqual([2, 0, 1, 0, 0, 0])
  })

  it('fits comfortably in browser storage', () => {
    const bytes = new TextEncoder().encode(
      JSON.stringify({ version: DATASET_VERSION, state }),
    ).length

    console.info(`demo dataset size: ${(bytes / 1024).toFixed(0)} KB`)
    expect(bytes).toBeLessThan(1_500_000)
  })
})
