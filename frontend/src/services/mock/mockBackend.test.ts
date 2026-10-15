import { describe, expect, it, vi } from 'vitest'
import { DomainError, type DomainErrorCode } from '../../domain/errors.ts'
import type { Session } from '../contracts/index.ts'
import type { StoredDemoClock } from './demoClock.ts'
import { createDemoBackend } from './mockBackend.ts'
import {
  createBrowserPersistence,
  createMemoryPersistence,
  DEMO_STORAGE_KEY,
  SESSION_STORAGE_KEY,
} from './persistence.ts'

const NOW = new Date('2026-10-12T09:00:00.000Z')
const DEMO: Session = { workspace: 'demo' }

function createStores() {
  return {
    demoPersistence: createMemoryPersistence(),
    sessionPersistence: createMemoryPersistence<Session>(),
  }
}

function create(stores = createStores(), failOperations?: Set<string>) {
  return createDemoBackend({ ...stores, now: () => NOW, failOperations })
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

describe('demo backend: sessions', () => {
  it('starts with nobody in the demo', async () => {
    expect(await create().auth.getSession()).toBeNull()
  })

  it('opens the demo without an account and remembers it', async () => {
    const stores = createStores()
    const backend = create(stores)

    const session = await backend.auth.enterDemo()

    expect(session).toEqual(DEMO)
    expect(await create(stores).auth.getSession()).toEqual(DEMO)
    expect(await backend.servicesFor(session).events.list()).toHaveLength(6)
    expect(backend.servicesFor(session).demo).not.toBeNull()
  })

  it('leaves the demo on sign-out, keeping its data', async () => {
    const stores = createStores()
    const backend = create(stores)
    await backend.auth.enterDemo()
    await backend.servicesFor(DEMO).events.remove('evt-1')

    await backend.auth.signOut()

    expect(await backend.auth.getSession()).toBeNull()
    expect(await create(stores).servicesFor(DEMO).events.list()).toHaveLength(5)
  })

  it.each([
    ['unreadable', 'not a session'],
    ['of an unknown kind', { workspace: 'admin' }],
    // A preview account from before the backend (D85).
    ['for a preview account', { workspace: 'account', userId: 'usr-n1' }],
  ])('ignores a remembered session that is %s', async (_, stored) => {
    const backend = create({
      ...createStores(),
      sessionPersistence: createMemoryPersistence<Session>(stored),
    })

    expect(await backend.auth.getSession()).toBeNull()
  })

  it('fails an operation named in the forced failures', async () => {
    const backend = create(createStores(), new Set(['auth.enterDemo']))

    expect(await codeOf(backend.auth.enterDemo())).toBe('UNAVAILABLE')
  })

  it('waits for the simulated delay', async () => {
    const backend = createDemoBackend({ ...createStores(), delayMs: 5 })

    expect(await backend.auth.enterDemo()).toEqual(DEMO)
  })

  it('uses ready-made demo services when given', async () => {
    const custom = create().servicesFor(DEMO)
    const wrapped = createDemoBackend({
      ...createStores(),
      demoServices: custom,
    })

    expect(wrapped.servicesFor(DEMO)).toBe(custom)
  })

  it('stores the demo and the session under their own keys', async () => {
    const backend = createDemoBackend({
      demoPersistence: createBrowserPersistence(localStorage, DEMO_STORAGE_KEY),
      sessionPersistence: createBrowserPersistence<Session>(
        localStorage,
        SESSION_STORAGE_KEY,
      ),
      now: () => NOW,
    })

    await backend.auth.enterDemo()
    await backend.servicesFor(DEMO).events.list()

    expect(localStorage.getItem(DEMO_STORAGE_KEY)).toContain('evt-1')
    expect(JSON.parse(localStorage.getItem(SESSION_STORAGE_KEY) ?? '')).toEqual(
      DEMO,
    )
    localStorage.clear()
  })
})

describe('demo backend: public RSVP and other tabs', () => {
  const answer = {
    name: 'Walk In',
    phone: '050-000-7777',
    status: 'DECLINED' as const,
    attendees: 1,
  }

  it('serves an RSVP link of the demo to a visitor with no session', async () => {
    const backend = create()
    const event = (await backend.servicesFor(DEMO).events.list()).find(
      (candidate) => candidate.event.id === 'evt-1',
    )
    const slug = event!.event.rsvpSlug

    expect((await backend.publicRsvp.getPublicEvent(slug)).title).toBeTruthy()
    await backend.publicRsvp.submit(slug, answer)

    expect(
      await backend.servicesFor(DEMO).unknownGuests.list(event!.event.id),
    ).toContainEqual(expect.objectContaining({ name: 'Walk In' }))
  })

  it('reports a link that belongs to no event', async () => {
    expect(await codeOf(create().publicRsvp.getPublicEvent('nothing'))).toBe(
      'NOT_FOUND',
    )
    expect(await codeOf(create().publicRsvp.submit('nothing', answer))).toBe(
      'NOT_FOUND',
    )
  })

  it('passes on other failures of the public page as they are', async () => {
    const backend = create(createStores(), new Set(['rsvp.getPublicEvent']))

    expect(await codeOf(backend.publicRsvp.getPublicEvent('nothing'))).toBe(
      'UNAVAILABLE',
    )
  })

  it('picks up what another tab saved, and tells the page to reload', async () => {
    const changed: (() => void)[] = []
    const demoPersistence = {
      ...createMemoryPersistence(),
      onChange: (listener: () => void) => void changed.push(listener),
    }
    const organizer = create({ ...createStores(), demoPersistence })
    const event = (await organizer.servicesFor(DEMO).events.list()).find(
      (candidate) => candidate.event.id === 'evt-1',
    )
    const notified = vi.fn()
    const stop = organizer.onExternalChange(notified)

    // The guest's tab works on the same stored data.
    const guestTab = create({ ...createStores(), demoPersistence })
    await guestTab.publicRsvp.submit(event!.event.rsvpSlug, answer)
    changed.forEach((listener) => listener())

    expect(notified).toHaveBeenCalled()
    expect(
      await organizer.servicesFor(DEMO).unknownGuests.list(event!.event.id),
    ).toContainEqual(expect.objectContaining({ name: 'Walk In' }))

    stop()
    notified.mockClear()
    changed.forEach((listener) => listener())
    expect(notified).not.toHaveBeenCalled()
  })

  it('hears about a change to its own stored value only, from another tab', () => {
    const listener = vi.fn()
    createBrowserPersistence(window.localStorage, DEMO_STORAGE_KEY).onChange?.(
      listener,
    )
    const announce = (key: string) =>
      window.dispatchEvent(
        new StorageEvent('storage', { key, storageArea: window.localStorage }),
      )

    announce(SESSION_STORAGE_KEY)
    expect(listener).not.toHaveBeenCalled()
    announce(DEMO_STORAGE_KEY)
    expect(listener).toHaveBeenCalledTimes(1)
  })
})

describe('demo backend: time limits (D99)', () => {
  const HOUR = 60 * 60 * 1000

  function timed() {
    const stores = {
      ...createStores(),
      clockPersistence: createMemoryPersistence<StoredDemoClock>(),
    }
    let now = NOW
    const later = (ms: number) => {
      now = new Date(now.getTime() + ms)
    }
    const make = () => createDemoBackend({ ...stores, now: () => now })
    return { stores, later, make, backend: make() }
  }

  it('ends an open demo 12 hours after the last activity, clearing its data', async () => {
    const { backend, later, stores } = timed()
    await backend.auth.enterDemo()
    await backend.servicesFor(DEMO).events.remove('evt-1')

    later(11 * HOUR)
    expect(backend.time.check()).toBeNull()
    backend.time.noteActivity()
    later(11 * HOUR)
    expect(backend.time.check()).toBeNull()

    later(1 * HOUR)
    expect(backend.time.check()).toBe('idle')
    expect(await backend.auth.getSession()).toBeNull()
    expect(stores.demoPersistence.load()).toBeNull()

    // Try Demo starts afresh, with its own time.
    await backend.auth.enterDemo()
    expect(await backend.servicesFor(DEMO).events.list()).toHaveLength(6)
    expect(backend.time.check()).toBeNull()
  })

  it('ends after 3 days even while the demo is used', async () => {
    const { backend, later } = timed()
    await backend.auth.enterDemo()
    for (let hour = 0; hour < 71; hour += 1) {
      later(HOUR)
      backend.time.noteActivity()
      expect(backend.time.check()).toBeNull()
    }
    later(HOUR)
    expect(backend.time.check()).toBe('lifetime')
  })

  it('tells once at start-up that the demo ended, and nothing after a logout', async () => {
    const open = timed()
    await open.backend.auth.enterDemo()
    open.later(13 * HOUR)
    const reopened = open.make()
    expect(await reopened.auth.getSession()).toBeNull()
    expect(reopened.time.consumeEndedAtStart()).toBe('idle')
    expect(reopened.time.consumeEndedAtStart()).toBeNull()

    const left = timed()
    await left.backend.auth.enterDemo()
    await left.backend.auth.signOut()
    left.later(4 * 24 * HOUR)
    const returning = left.make()
    expect(await returning.auth.getSession()).toBeNull()
    expect(returning.time.consumeEndedAtStart()).toBeNull()
    expect(left.stores.demoPersistence.load()).toBeNull()
  })

  it('keeps a demo left and reopened within its time', async () => {
    const { backend, later, make } = timed()
    await backend.auth.enterDemo()
    await backend.servicesFor(DEMO).events.remove('evt-1')
    await backend.auth.signOut()

    later(2 * HOUR)
    const back = make()
    await back.auth.enterDemo()
    expect(await back.servicesFor(DEMO).events.list()).toHaveLength(5)
  })

  it('starts the time again on Reset Demo, and tells when it ends', async () => {
    const { backend, later } = timed()
    await backend.auth.enterDemo()
    later(60 * HOUR)
    backend.time.noteActivity()

    await backend.servicesFor(DEMO).demo!.reset()
    const resetAt = new Date(NOW.getTime() + 60 * HOUR)
    expect(await backend.servicesFor(DEMO).demo!.getEndsAt()).toBe(
      new Date(resetAt.getTime() + 72 * HOUR).toISOString(),
    )
    later(20 * HOUR)
    backend.time.noteActivity()
    expect(backend.time.check()).toBeNull()
  })

  it('notices a demo another tab ended', async () => {
    const { backend, later, make } = timed()
    await backend.auth.enterDemo()
    const otherTab = make()
    later(13 * HOUR)

    expect(otherTab.time.check()).toBe('idle')
    expect(backend.time.check()).toBe('idle')
  })

  it('starts the clock of a demo stored before the time limits existed', async () => {
    const { stores, make } = timed()
    const first = make()
    await first.auth.enterDemo()
    await first.servicesFor(DEMO).events.list()
    stores.clockPersistence.clear()

    make()
    expect(stores.clockPersistence.load()).toMatchObject({
      startedAt: NOW.toISOString(),
    })
  })
})
