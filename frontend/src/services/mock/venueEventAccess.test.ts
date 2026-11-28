import { describe, expect, it } from 'vitest'
import { DomainError, type DomainErrorCode } from '../../domain/errors.ts'
import { SEATING_EXPORT_COLUMNS } from '../../domain/exports.ts'
import { generateDemoState } from './generator.ts'
import { createMockServices } from './mockServices.ts'
import { createMemoryPersistence } from './persistence.ts'
import { DATASET_VERSION, type DemoState, type StoredDemo } from './state.ts'

const NOW = new Date('2026-10-12T09:00:00.000Z')

function create(state: DemoState = generateDemoState(NOW)) {
  return createMockServices({
    persistence: createMemoryPersistence<StoredDemo>({
      version: DATASET_VERSION,
      state,
    }),
    now: () => NOW,
    venues: true,
  })
}

async function codeOf(
  action: Promise<unknown>,
): Promise<DomainErrorCode | 'NO_ERROR'> {
  try {
    await action
  } catch (error) {
    if (error instanceof DomainError) {
      return error.code
    }
    throw error
  }
  return 'NO_ERROR'
}

/** The demo user owns Grand Garden Hall (org-1); its first event is joined. */
async function joinedEvent(services: ReturnType<typeof create>) {
  const events = await services.venues!.listEvents('org-1')
  return events.find((summary) => summary.status === 'CLIENT_JOINED')!.event.id
}

describe('a venue event, opened by the venue (Phase 29a)', () => {
  it('gives the venue its own role and the venue’s details', async () => {
    const services = create()
    const eventId = await joinedEvent(services)
    const info = await services.events.get(eventId)
    expect(info.role).toBe('VENUE_OWNER')
    expect(info.venue).toMatchObject({
      organizationId: 'org-1',
      name: 'Grand Garden Hall',
      status: 'CLIENT_JOINED',
      clientName: 'Dana Levi',
      space: { name: 'Main Hall' },
    })
    // Still not among the personal events (Phase 25).
    expect(
      (await services.events.list()).some((s) => s.event.id === eventId),
    ).toBe(false)
  })

  it('lets a Manager in as a Manager (D112)', async () => {
    const services = create()
    const events = await services.venues!.listEvents('org-2')
    const info = await services.events.get(events[0]!.event.id)
    expect(info.role).toBe('VENUE_MANAGER')
  })

  it('never shows the venue a guest’s phone (D111)', async () => {
    const services = create()
    const eventId = await joinedEvent(services)
    const guests = await services.guests.list(eventId)
    expect(guests.length).toBeGreaterThan(0)
    expect(
      guests.every((g) => g.phone === '' && g.normalizedPhone === ''),
    ).toBe(true)
  })

  it('keeps the client’s messages, RSVP settings and unknown answers from the venue', async () => {
    const services = create()
    const eventId = await joinedEvent(services)
    const guestId = (await services.guests.list(eventId))[0]!.id
    for (const read of [
      services.unknownGuests.list(eventId),
      services.unknownGuests.listRejected(eventId),
      services.rsvp.getSettings(eventId),
      services.messages.getTemplate(eventId),
      services.messages.getDefaultTemplate(eventId),
      services.messages.getValues(eventId, guestId),
      services.messages.preview(eventId, guestId),
      services.messages.listSends(eventId),
    ]) {
      expect(await codeOf(read)).toBe('FORBIDDEN')
    }
    const dashboard = await services.dashboard.get(eventId)
    expect(
      dashboard.recentActivity.every((entry) => entry.kind === 'RSVP'),
    ).toBe(true)
  })

  it('exports seating without the phone column', async () => {
    const services = create()
    const eventId = await joinedEvent(services)
    const headings = Object.fromEntries(
      SEATING_EXPORT_COLUMNS.map((column) => [column, column]),
    ) as Record<(typeof SEATING_EXPORT_COLUMNS)[number], string>
    const blob = await services.files.exportSeating(eventId, {
      format: 'csv',
      headings,
      sheetName: 'Seating',
      rightToLeft: false,
    })
    const text = await blob.text()
    expect(text.split('\n')[0]).not.toMatch(/phone/)
    expect(text).not.toMatch(/\+972|00-?0\d/)
  })

  it('lets the venue change the schedule and tables, not guests, seating or messages', async () => {
    const services = create()
    const eventId = await joinedEvent(services)
    const guest = (await services.guests.list(eventId))[0]!
    const tables = await services.tables.list(eventId)
    expect(
      await codeOf(
        services.guests.update(eventId, guest.id, {
          firstName: 'Changed',
          lastName: guest.lastName,
          phone: '050-000-0000',
          allowedAttendees: guest.allowedAttendees,
          group: guest.group,
        }),
      ),
    ).toBe('FORBIDDEN')
    expect(
      await codeOf(
        services.guests.assignTable(eventId, guest.id, tables[0]!.table.id),
      ),
    ).toBe('FORBIDDEN')
    expect(await codeOf(services.messages.send(eventId, guest.id))).toBe(
      'FORBIDDEN',
    )
    // A table of its own: the venue's part (D113).
    const table = await services.tables.create(eventId, {
      number: 99,
      capacity: 8,
      shape: 'CIRCLE',
    })
    expect(table.number).toBe(99)
  })

  it('ignores a personal membership and the role switcher on a venue event', async () => {
    const state = generateDemoState(NOW)
    const eventId = state.venueEvents![0]!.eventId
    // Even an Owner membership in the personal records gives no client part.
    state.memberships.push({
      eventId,
      userId: state.currentUserId,
      role: 'OWNER',
    })
    state.demoRole = 'VIEWER'
    const services = create(state)
    expect((await services.events.get(eventId)).role).toBe('VENUE_OWNER')
    expect(await codeOf(services.messages.listSends(eventId))).toBe('FORBIDDEN')
  })

  it('is not found for someone in neither team', async () => {
    const state = generateDemoState(NOW)
    const eventId = state.venueEvents![0]!.eventId
    state.venueMembers = state.venueMembers!.filter(
      (member) => member.userId !== state.currentUserId,
    )
    const services = create(state)
    expect(await codeOf(services.events.get(eventId))).toBe('NOT_FOUND')
    expect(await codeOf(services.guests.list(eventId))).toBe('NOT_FOUND')
  })
})
