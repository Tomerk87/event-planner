import { afterEach, describe, expect, it, vi } from 'vitest'
import { DomainError } from '../domain/errors.ts'
import { createFakeAccountBackend } from '../test/fakeAccountBackend.ts'
import type { Session } from './contracts/index.ts'
import { combineBackends, createServices } from './createServices.ts'
import { createDemoBackend } from './mock/mockBackend.ts'
import {
  createMemoryPersistence,
  LEGACY_ACCOUNTS_STORAGE_KEY,
} from './mock/persistence.ts'

const NOW = new Date('2026-10-12T09:00:00.000Z')
const DEMO: Session = { workspace: 'demo' }
const riley = {
  name: 'Riley Stone',
  email: 'riley@example.com',
  password: 'correct-horse',
}
const answer = {
  name: 'Walk In',
  phone: '050-000-7777',
  status: 'DECLINED' as const,
  attendees: 1,
}

function setUp(options: { demo?: boolean; accounts?: boolean } = {}) {
  const sessionPersistence = createMemoryPersistence<Session>()
  const demo = createDemoBackend({
    demoPersistence: createMemoryPersistence(),
    sessionPersistence,
    now: () => NOW,
  })
  const accounts = createFakeAccountBackend({ now: () => NOW })
  const backend = combineBackends(
    options.demo === false ? null : demo,
    options.accounts === false ? null : accounts,
  )
  return { backend, accounts, sessionPersistence }
}

describe('combined backend', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
  })

  it('serves the demo session from the browser and an account from the server', async () => {
    const { backend } = setUp()

    const demo = await backend.auth.enterDemo()
    expect(await backend.auth.getSession()).toEqual(DEMO)
    expect(await backend.servicesFor(demo).events.list()).toHaveLength(6)

    const account = await backend.auth.signUp(riley)
    expect(account.workspace).toBe('account')
    expect(await backend.auth.getSession()).toEqual(account)
    expect(await backend.servicesFor(account).events.list()).toEqual([])
    expect(backend.servicesFor(account).demo).toBeNull()
  })

  it('leaves the demo when signing in, and signs out of whichever is open', async () => {
    const { backend, sessionPersistence } = setUp()
    await backend.auth.signUp(riley)
    await backend.auth.signOut()
    await backend.auth.enterDemo()

    const account = await backend.auth.signIn(riley)

    expect(sessionPersistence.load()).toBeNull()
    expect(await backend.auth.getSession()).toEqual(account)
    await backend.auth.signOut()
    expect(await backend.auth.getSession()).toBeNull()
  })

  it('never shows one side’s events on the other', async () => {
    const { backend } = setUp()
    const account = await backend.auth.signUp(riley)
    const created = await backend.servicesFor(account).events.create({
      name: 'Housewarming',
      startsAt: '2031-01-01T18:00:00.000Z',
      timeZone: 'Asia/Jerusalem',
      maxAttendees: 80,
      defaultAllowedAttendees: 2,
      rsvpLanguage: 'en',
    })

    const demoEvents = await backend.servicesFor(DEMO).events.list()
    expect(demoEvents.map((item) => item.event.id)).not.toContain(created.id)
    await expect(
      backend.servicesFor(account).events.get('evt-1'),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('answers a demo RSVP link locally and any other link from the server', async () => {
    const { backend, accounts } = setUp()
    const demoSlug = (await backend.servicesFor(DEMO).events.get('evt-1')).event
      .rsvpSlug
    const server = vi.spyOn(accounts.publicRsvp, 'getPublicEvent')
    const serverSubmit = vi.spyOn(accounts.publicRsvp, 'submit')

    await backend.publicRsvp.getPublicEvent(demoSlug)
    await backend.publicRsvp.submit(demoSlug, answer)
    expect(server).not.toHaveBeenCalled()
    expect(serverSubmit).not.toHaveBeenCalled()

    await expect(
      backend.publicRsvp.getPublicEvent('server-link'),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(
      backend.publicRsvp.submit('server-link', answer),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    expect(server).toHaveBeenCalledWith('server-link')
    expect(serverSubmit).toHaveBeenCalledWith('server-link', answer)
  })

  it('passes on a demo RSVP failure other than an unknown link', async () => {
    const { backend } = setUp()
    const slug = (await backend.servicesFor(DEMO).events.get('evt-1')).event
      .rsvpSlug

    await expect(
      backend.publicRsvp.submit(slug, { ...answer, attendees: 0 }),
    ).rejects.toMatchObject({ code: 'INVALID_ATTENDEE_COUNT' })
  })

  it('tells the application when the server ends the session', async () => {
    const { backend, accounts } = setUp()
    const ended = vi.fn()
    const stop = backend.onSessionEnded(ended)

    accounts.endSession()
    expect(ended).toHaveBeenCalledTimes(1)
    stop()
    accounts.endSession()
    expect(ended).toHaveBeenCalledTimes(1)
  })

  it('offers no demo when it is switched off', async () => {
    const { backend } = setUp({ demo: false })

    expect(backend.demoAvailable).toBe(false)
    await expect(backend.auth.enterDemo()).rejects.toBeInstanceOf(DomainError)
    expect(await backend.auth.getSession()).toBeNull()
    expect(backend.onExternalChange(() => undefined)).toBeTypeOf('function')
    await expect(
      backend.publicRsvp.getPublicEvent('anything'),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('has only the demo on a demo-only site (D102)', async () => {
    const { backend } = setUp({ accounts: false })

    expect(backend.accountsAvailable).toBe(false)
    expect(backend.demoAvailable).toBe(true)
    expect(await backend.auth.getSession()).toBeNull()
    await expect(backend.auth.signUp(riley)).rejects.toMatchObject({
      code: 'UNAVAILABLE',
    })
    await expect(backend.auth.signIn(riley)).rejects.toMatchObject({
      code: 'UNAVAILABLE',
    })
    await expect(
      backend.accountEmail.forgotPassword(riley.email),
    ).rejects.toMatchObject({ code: 'UNAVAILABLE' })
    await expect(
      backend.publicRsvp.submit('server-link', answer),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })

    const demo = await backend.auth.enterDemo()
    expect(await backend.servicesFor(demo).events.list()).toHaveLength(6)
    const slug = (await backend.servicesFor(demo).events.get('evt-1')).event
      .rsvpSlug
    await expect(backend.publicRsvp.getPublicEvent(slug)).resolves.toBeDefined()
    await backend.auth.signOut()
    expect(await backend.auth.getSession()).toBeNull()
  })
})

describe('createServices', () => {
  const location = { search: '', origin: 'https://demo.example.com' }

  afterEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
  })

  it('keeps the demo in this browser and sends nothing to the server', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const backend = createServices({
      demoEnabled: true,
      location,
      storage: localStorage,
    })

    const session = await backend.auth.enterDemo()
    const services = backend.servicesFor(session)
    await services.events.list()
    await services.guests.list('evt-1')
    await services.dashboard.get('evt-1')

    expect(fetchSpy).not.toHaveBeenCalled()
    expect(Object.keys(localStorage)).toContain('event-planner.demo')
    expect(backend.demoAvailable).toBe(true)
  })

  it('asks the server for an account session when no demo is open', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ code: 'UNAUTHENTICATED', details: {} }), {
        status: 401,
      }),
    )
    const backend = createServices({
      demoEnabled: true,
      location,
      storage: localStorage,
    })

    expect(await backend.auth.getSession()).toBeNull()
    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/auth/me',
      expect.objectContaining({ credentials: 'include' }),
    )
  })

  it('removes the preview accounts of the prototype (D85)', () => {
    localStorage.setItem(LEGACY_ACCOUNTS_STORAGE_KEY, '{"version":1}')

    createServices({ demoEnabled: true, location, storage: localStorage })

    expect(localStorage.getItem(LEGACY_ACCOUNTS_STORAGE_KEY)).toBeNull()
  })

  it('reads forced failures from the address', async () => {
    const backend = createServices({
      demoEnabled: true,
      location: {
        ...location,
        search: '?demoDelay=0&demoFail=events.list,guests.list',
      },
      storage: localStorage,
    })
    const services = backend.servicesFor(DEMO)

    await expect(services.events.list()).rejects.toMatchObject({
      code: 'UNAVAILABLE',
    })
    await expect(services.events.get('evt-1')).resolves.toBeDefined()
  })

  it.each(['abc', '-5', ''])(
    'ignores an invalid delay of %j',
    async (value) => {
      const backend = createServices({
        demoEnabled: true,
        location: { ...location, search: `?demoDelay=${value}` },
        storage: localStorage,
      })

      await expect(
        backend.servicesFor(DEMO).events.list(),
      ).resolves.toHaveLength(6)
    },
  )

  it('builds no demo when it is switched off', () => {
    const backend = createServices({
      demoEnabled: false,
      location,
      storage: localStorage,
    })

    expect(backend.demoAvailable).toBe(false)
    expect(backend.accountsAvailable).toBe(true)
  })

  it('sends nothing to the server on a demo-only site (D102)', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const backend = createServices({
      demoEnabled: true,
      accountsEnabled: false,
      location,
      storage: localStorage,
    })

    expect(await backend.auth.getSession()).toBeNull()
    await expect(
      backend.publicRsvp.getPublicEvent('not-a-demo-link'),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await backend.auth.enterDemo()
    expect(await backend.auth.getSession()).toEqual(DEMO)
    await backend.auth.signOut()

    expect(fetchSpy).not.toHaveBeenCalled()
    expect(backend.accountsAvailable).toBe(false)
  })

  it('refuses a site with neither the demo nor accounts', () => {
    expect(() =>
      createServices({
        demoEnabled: false,
        accountsEnabled: false,
        location,
        storage: localStorage,
      }),
    ).toThrow('cannot both be false')
  })
})
