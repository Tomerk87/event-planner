import { describe, expect, it } from 'vitest'
import { DomainError } from '../../domain/errors.ts'
import type { Services } from '../contracts/index.ts'
import {
  createMockServices,
  DEMO_LIMITS,
  type DemoLimits,
} from './mockServices.ts'
import { createMemoryPersistence, type DemoPersistence } from './persistence.ts'
import type { StoredDemo } from './state.ts'

const NOW = new Date('2026-10-15T09:00:00.000Z')

const NEW_EVENT = {
  name: 'Fresh Start',
  startsAt: '2031-01-01T18:00:00.000Z',
  timeZone: 'Asia/Jerusalem',
  maxAttendees: 100,
  defaultAllowedAttendees: 4,
  rsvpLanguage: 'en',
  country: 'IL',
} as const

function guest(index: number) {
  return {
    firstName: `Guest ${index}`,
    lastName: 'Test',
    phone: `05${String(index).padStart(8, '0')}`,
    allowedAttendees: 2,
  }
}

/** A browser's storage that can be made to refuse, as a full one does. */
function refusableStorage(): DemoPersistence & { refuse: boolean } {
  const memory = createMemoryPersistence<StoredDemo>()
  const storage = {
    refuse: false,
    load: () => memory.load(),
    save: (value: StoredDemo) => !storage.refuse && memory.save(value),
    clear: () => memory.clear(),
  }
  return storage
}

function demo(
  limits: Partial<DemoLimits>,
  persistence: DemoPersistence = createMemoryPersistence(),
): Services {
  return createMockServices({
    persistence,
    now: () => NOW,
    limits: { ...DEMO_LIMITS, ...limits },
  })
}

async function errorOf(action: Promise<unknown>): Promise<DomainError> {
  try {
    await action
  } catch (error) {
    if (error instanceof DomainError) {
      return error
    }
    throw error
  }
  throw new Error('expected the change to be refused')
}

describe('Demo limits (D109)', () => {
  it('holds up to the events allowed, and deleting one makes room', async () => {
    const services = demo({})
    const existing = (await services.events.list()).length
    const full = demo({ events: existing + 1 })

    const added = await full.events.create(NEW_EVENT)
    const refused = await errorOf(full.events.create(NEW_EVENT))
    expect(refused.code).toBe('DEMO_EVENT_LIMIT')
    expect(refused.details).toEqual({ max: existing + 1 })
    expect(await full.events.list()).toHaveLength(existing + 1)

    await full.events.remove(added.id)
    await full.events.create(NEW_EVENT)
    expect(await full.events.list()).toHaveLength(existing + 1)
  })

  it('holds up to the guests allowed in an event', async () => {
    const services = demo({ guestsPerEvent: 2 })
    const event = await services.events.create(NEW_EVENT)
    await services.guests.create(event.id, guest(1))
    const second = await services.guests.create(event.id, guest(2))

    const refused = await errorOf(services.guests.create(event.id, guest(3)))
    expect(refused.code).toBe('DEMO_GUEST_LIMIT')
    expect(refused.details).toEqual({ max: 2 })

    await services.guests.remove(event.id, second.id)
    await services.guests.create(event.id, guest(3))
    expect(await services.guests.list(event.id)).toHaveLength(2)
  })

  it('refuses a change past its storage, keeping nothing of it, and still lets things be deleted', async () => {
    const persistence = createMemoryPersistence<StoredDemo>()
    createMockServices({ persistence, now: () => NOW })
    const used = JSON.stringify(persistence.load()).length
    const services = demo({ storedLength: used + 100 }, persistence)
    const before = await services.events.list()

    const refused = await errorOf(services.events.create(NEW_EVENT))
    expect(refused.code).toBe('DEMO_STORAGE_FULL')
    expect(await services.events.list()).toEqual(before)
    // Nothing of the refused event was stored either.
    expect(JSON.stringify(persistence.load()).length).toBe(used)

    // Deleting is never refused, however full the demo is.
    const [first] = await services.guests.list('evt-1')
    await services.guests.remove('evt-1', first!.id)
    expect(JSON.stringify(persistence.load()).length).toBeLessThan(used)
  })

  it('refuses a change the browser will not store, instead of losing it on the next visit', async () => {
    const storage = refusableStorage()
    const services = demo({}, storage)
    const before = await services.events.list()

    storage.refuse = true
    const refused = await errorOf(services.events.create(NEW_EVENT))
    expect(refused.code).toBe('DEMO_STORAGE_FULL')
    expect(await services.events.list()).toEqual(before)

    // After a reload the demo is as it was last stored.
    storage.refuse = false
    expect(await demo({}, storage).events.list()).toEqual(before)
  })

  it('still runs, for this visit, where the browser stores nothing at all', async () => {
    const storage = refusableStorage()
    storage.refuse = true
    const services = demo({}, storage)

    const added = await services.events.create(NEW_EVENT)
    expect(
      (await services.events.list()).map((summary) => summary.event.id),
    ).toContain(added.id)
  })

  it('has no limits outside Demo Mode', async () => {
    const services = createMockServices({
      persistence: createMemoryPersistence(),
      now: () => NOW,
    })
    for (let index = 0; index < 12; index += 1) {
      await services.events.create(NEW_EVENT)
    }
    expect((await services.events.list()).length).toBeGreaterThan(
      DEMO_LIMITS.events,
    )
  })
})
