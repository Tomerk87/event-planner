import { describe, expect, it, vi } from 'vitest'
import { DomainError, type DomainErrorCode } from '../../domain/errors.ts'
import type { Session } from '../contracts/index.ts'
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
