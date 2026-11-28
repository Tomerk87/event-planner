import { describe, expect, it } from 'vitest'
import { DomainError, type DomainErrorCode } from '../../domain/errors.ts'
import {
  isNoticeOpen,
  noticeSeverity,
  overCapacity,
  validateVenueNote,
  type VenueNotice,
} from '../../domain/venues.ts'
import { generateDemoState } from './generator.ts'
import { createMockServices } from './mockServices.ts'
import { createMemoryPersistence } from './persistence.ts'
import { DATASET_VERSION, type StoredDemo } from './state.ts'

const NOW = new Date('2026-10-12T09:00:00.000Z')

function create() {
  return createMockServices({
    persistence: createMemoryPersistence<StoredDemo>({
      version: DATASET_VERSION,
      state: generateDemoState(NOW),
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

/** The joined event's busiest table, as the venue owner sees it. */
async function setup() {
  const services = create()
  const view = (await services.demo!.getViewAs())!
  const eventId = view.client.eventId
  const tables = await services.tables.list(eventId)
  const busiest = [...tables].sort((a, b) => b.assigned - a.assigned)[0]!
  return { services, eventId, busiest }
}

describe('the notice rules (D122)', () => {
  const guest = (id: string, tableId: string | null, people = 2) => ({
    id,
    tableId,
    confirmedAttendees: people,
    rsvpStatus: 'APPROVED',
    deleted: false,
  })
  const notice = (fields: Partial<VenueNotice>): VenueNotice => ({
    id: 'n',
    eventId: 'e',
    kind: 'TABLE_OVER_CAPACITY',
    tableId: 't',
    tableNumber: 7,
    parties: 2,
    people: 4,
    guestIds: [],
    changes: [],
    note: null,
    actorName: null,
    createdAt: NOW.toISOString(),
    readBy: [],
    handledAt: null,
    ...fields,
  })

  it('counts the people beyond a table’s chairs', () => {
    expect(
      overCapacity({ id: 't', capacity: 3 }, [
        guest('a', 't'),
        guest('b', 't'),
      ]),
    ).toBe(1)
    expect(overCapacity({ id: 't', capacity: 8 }, [guest('a', 't')])).toBe(0)
  })

  it('keeps an action open until it is done, information until read', () => {
    const over = notice({})
    expect(
      isNoticeOpen(
        over,
        [{ id: 't', capacity: 3 }],
        [guest('a', 't'), guest('b', 't')],
        'me',
      ),
    ).toBe(true)
    expect(
      isNoticeOpen(
        over,
        [{ id: 't', capacity: 4 }],
        [guest('a', 't'), guest('b', 't')],
        'me',
      ),
    ).toBe(false)
    // The table gone: nothing left to fix there.
    expect(isNoticeOpen(over, [], [], 'me')).toBe(false)

    const removed = notice({ kind: 'TABLE_REMOVED', guestIds: ['a', 'b'] })
    expect(
      isNoticeOpen(removed, [], [guest('a', null), guest('b', 'x')], 'me'),
    ).toBe(true)
    expect(
      isNoticeOpen(removed, [], [guest('a', 'y'), guest('b', 'x')], 'me'),
    ).toBe(false)
    expect(
      isNoticeOpen(
        { ...removed, handledAt: NOW.toISOString() },
        [],
        [guest('a', null)],
        'me',
      ),
    ).toBe(false)

    const info = notice({ kind: 'DETAILS_CHANGED' })
    expect(isNoticeOpen(info, [], [], 'me')).toBe(true)
    expect(isNoticeOpen({ ...info, readBy: ['me'] }, [], [], 'me')).toBe(false)
    expect(noticeSeverity(info)).toBe('INFO')
    expect(noticeSeverity(over)).toBe('ACTION')
  })

  it('keeps the note short and optional', () => {
    expect(validateVenueNote('  Sorry!  ')).toBe('Sorry!')
    expect(validateVenueNote('   ')).toBeNull()
    expect(validateVenueNote(undefined)).toBeNull()
    expect(() => validateVenueNote('x'.repeat(301))).toThrow(DomainError)
  })
})

describe('the venue changes the room under the client (Phase 30)', () => {
  it('needs an acknowledgement to lower chairs below the seated guests', async () => {
    const { services, eventId, busiest } = await setup()
    const smaller = { ...busiest.table, capacity: 2 }
    expect(
      await codeOf(services.tables.update(eventId, busiest.table.id, smaller)),
    ).toBe('VALIDATION')

    await services.tables.update(eventId, busiest.table.id, smaller, {
      acknowledgeSeated: true,
      note: 'We need room for the dance floor.',
    })
    // Nobody lost a seat: the table is over capacity.
    const after = (await services.tables.list(eventId)).find(
      (row) => row.table.id === busiest.table.id,
    )!
    expect(after.assigned).toBe(busiest.assigned)
    expect(after.available).toBeLessThan(0)

    const notices = await services.venues!.listNotices(eventId)
    expect(notices[0]).toMatchObject({
      kind: 'TABLE_OVER_CAPACITY',
      severity: 'ACTION',
      open: true,
      tableNumber: busiest.table.number,
      overBy: busiest.assigned - 2,
      note: 'We need room for the dance floor.',
      actorName: 'Alex Morgan',
    })
  })

  it('lets more chairs, or a table that never had guests, pass freely', async () => {
    const { services, eventId, busiest } = await setup()
    await services.tables.update(eventId, busiest.table.id, {
      ...busiest.table,
      capacity: busiest.table.capacity + 2,
    })
    const empty = await services.tables.create(eventId, {
      number: 98,
      capacity: 6,
      shape: 'CIRCLE',
    })
    await services.tables.remove(eventId, empty.id)
    expect(await services.venues!.listNotices(eventId)).toEqual([])
  })

  it('needs an acknowledgement to delete a table with guests, and unseats them', async () => {
    const { services, eventId, busiest } = await setup()
    expect(
      await codeOf(services.tables.remove(eventId, busiest.table.id)),
    ).toBe('VALIDATION')
    await services.tables.remove(eventId, busiest.table.id, {
      acknowledgeSeated: true,
    })
    const guests = await services.guests.list(eventId)
    expect(guests.some((guest) => guest.tableId === busiest.table.id)).toBe(
      false,
    )
    const [notice] = await services.venues!.listNotices(eventId)
    expect(notice).toMatchObject({ kind: 'TABLE_REMOVED', open: true })
  })

  it('tells the client when the date, address or maximum change', async () => {
    const { services, eventId } = await setup()
    const { event } = await services.events.get(eventId)
    await services.events.update(eventId, {
      ...event,
      location: '14 Orchard Lane, Ramat Gan',
      maxAttendees: event.maxAttendees + 10,
    })
    const [notice] = await services.venues!.listNotices(eventId)
    expect(notice).toMatchObject({
      kind: 'DETAILS_CHANGED',
      severity: 'INFO',
      changes: ['address', 'maxAttendees'],
    })
  })

  it('shows the client their notices, closes an action only when it’s done', async () => {
    const { services, eventId, busiest } = await setup()
    await services.tables.update(
      eventId,
      busiest.table.id,
      { ...busiest.table, capacity: 2 },
      { acknowledgeSeated: true },
    )
    await services.demo!.setViewAs('CLIENT')
    const venues = services.venues!
    const [notice] = await venues.listNotices()
    expect(notice).toMatchObject({ open: true, read: false })

    // Read, but still open: the table is still over capacity.
    await venues.markNoticesRead([notice!.id])
    expect((await venues.listNotices())[0]).toMatchObject({
      open: true,
      read: true,
    })
    // The client moves people off the table: it fits, the action closes.
    const seated = (await services.guests.list(eventId)).filter(
      (guest) => guest.tableId === busiest.table.id,
    )
    for (const guest of seated.slice(1)) {
      await services.guests.assignTable(eventId, guest.id, null)
    }
    const fits = (await venues.listNotices())[0]!
    expect(fits.open).toBe(seated[0]!.confirmedAttendees! > 2)
  })

  it('lets the client close a removed table’s notice by hand', async () => {
    const { services, eventId, busiest } = await setup()
    await services.tables.remove(eventId, busiest.table.id, {
      acknowledgeSeated: true,
    })
    await services.demo!.setViewAs('CLIENT')
    const [notice] = await services.venues!.listNotices()
    await services.venues!.handleNotice(eventId, notice!.id)
    expect((await services.venues!.listNotices())[0]?.open).toBe(false)
  })

  it('records nothing before a client has joined', async () => {
    const services = create()
    const events = await services.venues!.listEvents('org-1')
    const awaiting = events.find((s) => s.status === 'AWAITING_CLIENT')!
    const tables = await services.tables.list(awaiting.event.id)
    await services.tables.remove(awaiting.event.id, tables[0]!.table.id)
    expect(await services.venues!.listNotices(awaiting.event.id)).toEqual([])
  })

  it('keeps the venue from closing the client’s notices', async () => {
    const { services, eventId, busiest } = await setup()
    await services.tables.remove(eventId, busiest.table.id, {
      acknowledgeSeated: true,
    })
    const [notice] = await services.venues!.listNotices(eventId)
    expect(
      await codeOf(services.venues!.handleNotice(eventId, notice!.id)),
    ).toBe('FORBIDDEN')
    // The venue has no client notices of its own in the bell.
    expect(await services.venues!.listNotices()).toEqual([])
  })
})
