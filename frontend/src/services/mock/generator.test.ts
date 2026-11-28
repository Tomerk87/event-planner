import { describe, expect, it } from 'vitest'
import { isEventPast } from '../../domain/eventTime.ts'
import { EVENT_LIMITS } from '../../domain/events.ts'
import { findTableConflicts, tableOccupancy } from '../../domain/seating.ts'
import { generateDemoState } from './generator.ts'
import { DATASET_VERSION, type DemoState } from './state.ts'

const NOW = new Date('2026-10-12T09:00:00.000Z')
const state = generateDemoState(NOW)

/** The demo user's own events, without the venues' (V2.2). */
function personal(data: DemoState) {
  const managed = new Set(
    (data.venueEvents ?? []).map((venueEvent) => venueEvent.eventId),
  )
  return data.events.filter((event) => !managed.has(event.id))
}

const main = personal(state)[0]!
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
    expect(personal(later)[0]?.startsAt).not.toBe(main.startsAt)
  })

  it('has four upcoming and two past events, whenever it is generated', () => {
    for (const now of [NOW, new Date('2031-02-28T23:30:00.000Z')]) {
      const generated = generateDemoState(now)
      const past = personal(generated).filter((event) =>
        isEventPast(event, now),
      )

      expect(personal(generated)).toHaveLength(6)
      expect(past).toHaveLength(2)
    }
  })

  it('keeps event settings within the product limits', () => {
    for (const event of personal(state)) {
      expect(event.maxAttendees).toBeGreaterThanOrEqual(
        EVENT_LIMITS.maxAttendees.min,
      )
      expect(event.maxAttendees).toBeLessThanOrEqual(
        EVENT_LIMITS.maxAttendees.max,
      )
      expect(event.defaultAllowedAttendees).toBe(5)
      expect(event.timeZone).toBe('Asia/Jerusalem')
    }
    expect(new Set(personal(state).map((event) => event.rsvpSlug)).size).toBe(6)
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
      expect(record.phone).toMatch(/^000-\d{3}-\d{4}$/)
      expect(record.normalizedPhone).toMatch(/^\+9720\d{8}$/)
    }
    for (const send of state.messageSends) {
      expect(send.message).toContain('https://rsvp.example.com/')
    }
  })

  it('gives every guest a phone that is unique within their event', () => {
    for (const event of personal(state)) {
      const phones = [
        ...guestsOf(event.id),
        ...state.unknownRsvps.filter((unknown) => unknown.eventId === event.id),
      ].map((record) => record.normalizedPhone)

      expect(new Set(phones).size).toBe(phones.length)
    }
  })

  it('gives every guest a full name that is unique within their event', () => {
    for (const event of personal(state)) {
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
    for (const event of personal(state)) {
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
    for (const event of personal(state)) {
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
    for (const event of personal(state)) {
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
    const hebrew = personal(state).find((event) => event.rsvpLanguage === 'he')!

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
    const conflicts = personal(state).map(
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

describe('Brazil’s sample events (D103)', () => {
  const brazil = generateDemoState(NOW, 'BR')

  it('are in Portuguese, in Brazil, with Brazilian names and places', () => {
    expect(brazil.market).toBe('BR')
    expect(state.market).toBe('IL')
    expect(personal(brazil)).toHaveLength(6)
    for (const event of personal(brazil)) {
      expect(event).toMatchObject({
        rsvpLanguage: 'pt',
        country: 'BR',
        timeZone: 'America/Sao_Paulo',
      })
    }
    expect(personal(brazil)[0]?.name).toBe('Casamento de Mariana & Rafael')
    expect(brazil.users[0]?.name).toBe('Ana Oliveira')
    expect(brazil.users[0]?.email).toBe('ana.oliveira@example.com')
    expect(brazil.guests.some((guest) => guest.group === 'Família')).toBe(true)
  })

  it('give every guest an undiallable Brazilian number (area code 00)', () => {
    for (const guest of brazil.guests) {
      expect(guest.normalizedPhone).toMatch(/^\+5500\d{9}$/)
      expect(guest.phone).toMatch(/^\+55 00 \d{5}-\d{4}$/)
    }
    expect(
      new Set(brazil.guests.map((guest) => guest.normalizedPhone)).size,
    ).toBe(brazil.guests.length)
  })

  it('share no RSVP link with Israel’s, so a link names one set of events', () => {
    const israel = new Set(personal(state).map((event) => event.rsvpSlug))
    expect(personal(brazil).some((event) => israel.has(event.rsvpSlug))).toBe(
      false,
    )
  })

  it('show the same mix of states as Israel’s', () => {
    expect(brazil.guests.length).toBe(state.guests.length)
    expect(brazil.tables.length).toBe(state.tables.length)
    expect(brazil.unknownRsvps.length).toBe(state.unknownRsvps.length)
    expect(brazil.layouts).toHaveLength(state.layouts.length)
  })
})

describe('the demo venues (V2.2)', () => {
  const venueEvents = state.venueEvents ?? []

  it('has two venues: one the demo user owns and one they manage', () => {
    const roles = (state.venueMembers ?? [])
      .filter((member) => member.userId === state.currentUserId)
      .map((member) => member.role)
    expect(state.organizations?.map((venue) => venue.name)).toEqual([
      'Grand Garden Hall',
      'Seaside Terrace',
    ])
    expect(roles).toEqual(['VENUE_OWNER', 'VENUE_MANAGER'])
  })

  it('gives each venue an Owner and at least one Manager', () => {
    for (const venue of state.organizations ?? []) {
      const roles = new Set(
        (state.venueMembers ?? [])
          .filter((member) => member.organizationId === venue.id)
          .map((member) => member.role),
      )
      expect([...roles].sort()).toEqual(['VENUE_MANAGER', 'VENUE_OWNER'])
    }
  })

  it('gives each space with events its templates, drawn from its events', () => {
    const templates = state.layoutTemplates ?? []
    const mainHall = templates.filter((t) => t.spaceId === 'spc-1-1')
    expect(mainHall.map((t) => [t.name, t.archived])).toEqual([
      ['Wedding Rounds', false],
      ['Gala Long Tables', false],
      ['Bar Mitzvah Mixed', false],
      ['Classic Rounds', true],
    ])
    for (const template of templates) {
      expect(template.tables.length).toBeGreaterThan(0)
      expect(template.tables.every((table) => table.x !== null)).toBe(true)
    }
    expect(templates.some((t) => t.spaceId === 'spc-1-3')).toBe(false)
  })

  it('links venue events to the template they came from', () => {
    const ids = new Set((state.layoutTemplates ?? []).map((t) => t.id))
    const linked = (state.venueEvents ?? []).filter(
      (v) => v.templateId !== null,
    )
    expect(linked.length).toBeGreaterThan(0)
    for (const venueEvent of linked) {
      expect(ids.has(venueEvent.templateId ?? '')).toBe(true)
    }
  })

  it('has an archived space and a pending team invitation', () => {
    expect(
      (state.venueSpaces ?? [])
        .filter((space) => space.archived)
        .map((space) => space.name),
    ).toEqual(['Winter Pavilion'])
    expect(state.venueMemberInvitations?.map((i) => i.email)).toEqual([
      'daniel.mor@example.com',
    ])
  })

  it('makes each venue event an ordinary event in one of its spaces', () => {
    expect(venueEvents).toHaveLength(8)
    for (const venueEvent of venueEvents) {
      const event = state.events.find((item) => item.id === venueEvent.eventId)
      const space = state.venueSpaces?.find(
        (item) => item.id === venueEvent.spaceId,
      )
      expect(event).toBeDefined()
      expect(space?.organizationId).toBe(venueEvent.organizationId)
      expect(event?.location).toBe(space?.address)
      expect(event?.maxAttendees).toBeLessThanOrEqual(space?.maxPeople ?? 0)
      expect(state.tables.some((table) => table.eventId === event?.id)).toBe(
        true,
      )
    }
  })

  it('gives the demo user no personal role in a venue event', () => {
    for (const venueEvent of venueEvents) {
      expect(
        state.memberships.some(
          (membership) => membership.eventId === venueEvent.eventId,
        ),
      ).toBe(false)
    }
  })

  it('has guests only where the client has joined', () => {
    for (const venueEvent of venueEvents) {
      const guests = guestsOf(venueEvent.eventId).length
      if (venueEvent.client?.acceptedAt) {
        expect(guests).toBeGreaterThan(0)
      } else {
        expect(guests).toBe(0)
      }
    }
  })

  it('leaves the personal sample data as it was', () => {
    expect(personal(state).map((event) => event.id)).toEqual([
      'evt-1',
      'evt-2',
      'evt-3',
      'evt-4',
      'evt-5',
      'evt-6',
    ])
  })

  it('has Brazilian venues in Portuguese', () => {
    const brazil = generateDemoState(NOW, 'BR')
    expect(brazil.organizations?.[0]?.name).toBe('Espaço Jardim Imperial')
    expect(brazil.organizations?.[0]?.defaultLanguage).toBe('pt')
    const names = new Set(
      (brazil.venueEvents ?? []).map(
        (venueEvent) =>
          brazil.events.find((event) => event.id === venueEvent.eventId)
            ?.rsvpLanguage,
      ),
    )
    expect([...names]).toEqual(['pt'])
  })
})
