import { describe, expect, it, vi } from 'vitest'
import { DomainError, type DomainErrorCode } from '../../domain/errors.ts'
import type { Session } from '../contracts/index.ts'
import { createMockBackend } from './mockBackend.ts'
import {
  ACCOUNTS_STORAGE_KEY,
  createBrowserPersistence,
  createMemoryPersistence,
  DEMO_STORAGE_KEY,
  SESSION_STORAGE_KEY,
} from './persistence.ts'
import type { StoredDemo } from './state.ts'

const NOW = new Date('2026-10-12T09:00:00.000Z')
const DEMO: Session = { workspace: 'demo' }
const riley = {
  name: 'Riley Stone',
  email: 'riley@example.com',
  password: 'correct-horse',
}
const newEvent = {
  name: 'Housewarming',
  startsAt: '2031-01-01T18:00:00.000Z',
  timeZone: 'Asia/Jerusalem',
  maxAttendees: 80,
  defaultAllowedAttendees: 2,
  rsvpLanguage: 'en' as const,
}

function createStores() {
  return {
    demoPersistence: createMemoryPersistence(),
    accountsPersistence: createMemoryPersistence(),
    sessionPersistence: createMemoryPersistence<Session>(),
  }
}

function create(stores = createStores(), failOperations?: Set<string>) {
  return createMockBackend({ ...stores, now: () => NOW, failOperations })
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

describe('mock backend: sessions', () => {
  it('starts with nobody signed in', async () => {
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

  it('signs up a new account with no events and no demo controls', async () => {
    const backend = create()

    const session = await backend.auth.signUp(riley)
    const services = backend.servicesFor(session)

    expect(session.workspace).toBe('account')
    expect(await services.session.getCurrentUser()).toMatchObject({
      name: 'Riley Stone',
      email: 'riley@example.com',
      isSuperUser: false,
    })
    expect(await services.events.list()).toEqual([])
    expect(services.demo).toBeNull()
  })

  it('never stores the password', async () => {
    const stores = createStores()
    const backend = create(stores)

    await backend.auth.signUp(riley)
    await backend.auth.signIn(riley)

    for (const store of Object.values(stores)) {
      expect(JSON.stringify(store.load())).not.toContain(riley.password)
    }
  })

  it('refuses a second account with the same email', async () => {
    const backend = create()
    await backend.auth.signUp(riley)

    expect(
      await codeOf(
        backend.auth.signUp({ ...riley, email: 'RILEY@example.com' }),
      ),
    ).toBe('EMAIL_TAKEN')
  })

  it('signs in an existing account by email and refuses an unknown one', async () => {
    const stores = createStores()
    const first = create(stores)
    const created = await first.auth.signUp(riley)
    await first.auth.signOut()
    expect(await first.auth.getSession()).toBeNull()

    const later = create(stores)
    const session = await later.auth.signIn({
      email: 'Riley@Example.com',
      password: 'anything',
    })

    expect(session).toEqual(created)
    expect(await later.auth.getSession()).toEqual(created)
    expect(
      await codeOf(
        later.auth.signIn({ email: 'nobody@example.com', password: 'x' }),
      ),
    ).toBe('ACCOUNT_NOT_FOUND')
    expect(
      await codeOf(later.auth.signIn({ email: 'riley', password: 'x' })),
    ).toBe('VALIDATION')
  })

  it.each([
    ['unreadable', 'not a session'],
    ['of an unknown kind', { workspace: 'admin' }],
    [
      'for an account that no longer exists',
      { workspace: 'account', userId: 'usr-n9' },
    ],
    ['missing its account', { workspace: 'account' }],
  ])('ignores a remembered session that is %s', async (_, stored) => {
    const backend = create({
      ...createStores(),
      sessionPersistence: createMemoryPersistence<Session>(stored),
    })

    expect(await backend.auth.getSession()).toBeNull()
  })

  it('starts again from no accounts when the stored accounts are damaged', async () => {
    const backend = create({
      ...createStores(),
      accountsPersistence: createMemoryPersistence('damaged'),
    })

    const session = await backend.auth.signUp(riley)

    expect(await backend.servicesFor(session).events.list()).toEqual([])
  })

  it('fails an operation named in the forced failures', async () => {
    const backend = create(createStores(), new Set(['auth.enterDemo']))

    expect(await codeOf(backend.auth.enterDemo())).toBe('UNAVAILABLE')
  })

  it('waits for the simulated delay', async () => {
    const backend = createMockBackend({ ...createStores(), delayMs: 5 })

    expect(await backend.auth.enterDemo()).toEqual(DEMO)
  })
})

describe('mock backend: workspaces', () => {
  it('keeps the demo and an account’s events apart', async () => {
    const backend = create()
    const session = await backend.auth.signUp(riley)
    const account = backend.servicesFor(session)
    const demo = backend.servicesFor(DEMO)

    const created = await account.events.create(newEvent)

    expect(await account.events.list()).toHaveLength(1)
    expect(await demo.events.list()).toHaveLength(6)
    expect(await codeOf(demo.events.get(created.id))).toBe('NOT_FOUND')
    expect(await codeOf(account.events.get('evt-1'))).toBe('NOT_FOUND')
  })

  it('keeps each account’s events to that account', async () => {
    const backend = create()
    const rileySession = await backend.auth.signUp(riley)
    const created = await backend
      .servicesFor(rileySession)
      .events.create(newEvent)

    const samSession = await backend.auth.signUp({
      ...riley,
      name: 'Sam Field',
      email: 'sam@example.com',
    })
    const sam = backend.servicesFor(samSession)

    expect(await sam.events.list()).toEqual([])
    expect(await codeOf(sam.events.get(created.id))).toBe('NOT_FOUND')
    expect(
      (
        await sam.permissions.listCandidates(
          (await sam.events.create(newEvent)).id,
        )
      ).map((user) => user.email),
    ).toEqual(['riley@example.com'])
    expect(await backend.servicesFor(rileySession).events.list()).toHaveLength(
      1,
    )
  })

  it('leaves accounts untouched when the demo is reset', async () => {
    const backend = create()
    const session = await backend.auth.signUp(riley)
    await backend.servicesFor(session).events.create(newEvent)
    const demo = backend.servicesFor(DEMO)
    await demo.events.remove('evt-1')

    await demo.demo?.reset()

    expect(await demo.events.list()).toHaveLength(6)
    expect(await backend.servicesFor(session).events.list()).toHaveLength(1)
  })

  it('keeps an account’s events between visits', async () => {
    const stores = createStores()
    const first = create(stores)
    const session = await first.auth.signUp(riley)
    await first.servicesFor(session).events.create(newEvent)

    const later = create(stores)
    const remembered = await later.auth.getSession()

    expect(remembered).toEqual(session)
    expect(
      (await later.servicesFor(session).events.list()).map(
        (item) => item.event.name,
      ),
    ).toEqual(['Housewarming'])
  })

  it('uses ready-made demo services when given', async () => {
    const backend = create()
    const custom = backend.servicesFor(DEMO)
    const wrapped = createMockBackend({
      ...createStores(),
      demoServices: custom,
    })

    expect(wrapped.servicesFor(DEMO)).toBe(custom)
  })

  it('stores each workspace and the session under its own key', async () => {
    const backend = createMockBackend({
      demoPersistence: createBrowserPersistence(localStorage, DEMO_STORAGE_KEY),
      accountsPersistence: createBrowserPersistence(
        localStorage,
        ACCOUNTS_STORAGE_KEY,
      ),
      sessionPersistence: createBrowserPersistence<Session>(
        localStorage,
        SESSION_STORAGE_KEY,
      ),
      now: () => NOW,
    })

    await backend.auth.signUp(riley)
    await backend.servicesFor(DEMO).events.list()

    const accounts = JSON.parse(
      localStorage.getItem(ACCOUNTS_STORAGE_KEY) ?? 'null',
    ) as StoredDemo
    expect(accounts.state.users.map((user) => user.email)).toEqual([
      'riley@example.com',
    ])
    expect(localStorage.getItem(DEMO_STORAGE_KEY)).not.toContain(
      'riley@example.com',
    )
    expect(localStorage.getItem(SESSION_STORAGE_KEY)).toContain('account')
  })
})

describe('mock backend: public RSVP and other tabs', () => {
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

  it('serves an RSVP link of a signed-up account’s event, also after a reload', async () => {
    const stores = createStores()
    const backend = create(stores)
    const session = await backend.auth.signUp(riley)
    const created = await backend.servicesFor(session).events.create(newEvent)

    await backend.publicRsvp.submit(created.rsvpSlug, answer)
    expect(
      await backend.servicesFor(session).unknownGuests.list(created.id),
    ).toHaveLength(1)

    // A guest's own tab: a fresh page with nobody signed in.
    const guestTab = create(stores)
    expect(
      (await guestTab.publicRsvp.getPublicEvent(created.rsvpSlug)).title,
    ).toBe('Housewarming')
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

    announce(ACCOUNTS_STORAGE_KEY)
    expect(listener).not.toHaveBeenCalled()
    announce(DEMO_STORAGE_KEY)
    expect(listener).toHaveBeenCalledTimes(1)
  })
})
