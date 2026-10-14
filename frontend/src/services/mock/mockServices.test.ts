import { afterEach, describe, expect, it, vi } from 'vitest'
import { DomainError, type DomainErrorCode } from '../../domain/errors.ts'
import { describeServicesContract } from '../contracts/servicesContract.ts'
import { generateDemoState } from './generator.ts'
import { createMockServices, type MockOptions } from './mockServices.ts'
import {
  createBrowserPersistence,
  createMemoryPersistence,
  DEMO_STORAGE_KEY,
  type DemoPersistence,
} from './persistence.ts'
import { DATASET_VERSION, type StoredDemo } from './state.ts'

const NOW = new Date('2026-10-12T09:00:00.000Z')
const EVENTS = {
  owner: 'evt-1',
  admin: 'evt-3',
  viewer: 'evt-4',
  past: 'evt-5',
}

function create(
  persistence: DemoPersistence = createMemoryPersistence(),
  options: Partial<MockOptions> = {},
) {
  return createMockServices({ persistence, now: () => NOW, ...options })
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

const newGuest = {
  firstName: 'Persisted',
  lastName: 'Guest',
  phone: '+972 00-777-0009',
  allowedAttendees: 2,
}

describeServicesContract('mock provider', () => {
  let now = NOW
  return {
    services: createMockServices({
      persistence: createMemoryPersistence(),
      now: () => now,
      baseUrl: 'https://demo.example.com',
    }),
    events: EVENTS,
    setNow: (next) => {
      now = next
    },
  }
})

describe('demo persistence', () => {
  afterEach(() => {
    window.localStorage.clear()
  })

  it('generates data on first use with no setup, and does not report it as a refresh', async () => {
    const persistence = createMemoryPersistence()

    const services = create(persistence)

    expect(await services.events.list()).toHaveLength(6)
    expect(services.demo?.consumeRegeneratedNotice()).toBe(false)
    expect((persistence.load() as StoredDemo).version).toBe(DATASET_VERSION)
  })

  it('keeps changes across a reload', async () => {
    const persistence = createMemoryPersistence()
    const first = create(persistence)
    const guest = await first.guests.create(EVENTS.owner, newGuest)
    await first.messages.send(EVENTS.owner, guest.id)
    await first.demo?.setRole('ADMIN')
    const dashboard = await first.dashboard.get(EVENTS.owner)

    const reloaded = create(persistence)

    expect(
      (await reloaded.guests.list(EVENTS.owner)).find(
        (candidate) => candidate.id === guest.id,
      ),
    ).toMatchObject({ firstName: 'Persisted', invitationSentCount: 1 })
    expect(await reloaded.dashboard.get(EVENTS.owner)).toEqual(dashboard)
    expect(await reloaded.demo?.getRole()).toBe('ADMIN')
    expect(reloaded.demo?.consumeRegeneratedNotice()).toBe(false)
  })

  it('gives new records ids that stay unique across reloads', async () => {
    const persistence = createMemoryPersistence()
    const first = await create(persistence).guests.create(
      EVENTS.owner,
      newGuest,
    )

    const second = await create(persistence).guests.create(EVENTS.owner, {
      ...newGuest,
      phone: '+972 00-777-0010',
    })

    expect(second.id).not.toBe(first.id)
  })

  it('does not share changes between two visitors', async () => {
    const mine = create(createMemoryPersistence())
    const theirs = create(createMemoryPersistence())

    await mine.guests.create(EVENTS.owner, newGuest)
    await mine.demo?.setRole('VIEWER')

    expect((await theirs.guests.list(EVENTS.owner)).length).toBe(
      (await mine.guests.list(EVENTS.owner)).length - 1,
    )
    expect(await theirs.demo?.getRole()).toBeNull()
  })

  it.each([
    [
      'an older dataset version',
      { version: DATASET_VERSION - 1, state: generateDemoState(NOW) },
    ],
    [
      'a newer dataset version',
      { version: DATASET_VERSION + 1, state: generateDemoState(NOW) },
    ],
    ['unreadable data', undefined],
    ['a value of the wrong type', 'not an object'],
    [
      'a state missing its collections',
      {
        version: DATASET_VERSION,
        state: { currentUserId: 'usr-1', nextId: 1 },
      },
    ],
    [
      'a state whose user does not exist',
      {
        version: DATASET_VERSION,
        state: { ...generateDemoState(NOW), currentUserId: 'ghost' },
      },
    ],
  ])('regenerates cleanly from %s and says so once', async (_label, stored) => {
    const persistence = createMemoryPersistence(stored)

    const services = create(persistence)

    expect(await services.events.list()).toHaveLength(6)
    expect((await services.session.getCurrentUser()).id).toBe('usr-1')
    expect(services.demo?.consumeRegeneratedNotice()).toBe(true)
    expect(services.demo?.consumeRegeneratedNotice()).toBe(false)
    expect((persistence.load() as StoredDemo).version).toBe(DATASET_VERSION)
  })

  it('restores the exact initial dataset on reset', async () => {
    const persistence = createMemoryPersistence()
    const services = create(persistence)
    const initial = structuredClone(persistence.load())
    await services.guests.create(EVENTS.owner, newGuest)
    await services.tables.remove(EVENTS.owner, 'tbl-1-01')
    await services.demo?.setRole('VIEWER')
    expect(persistence.load()).not.toEqual(initial)

    await services.demo?.reset()

    expect(persistence.load()).toEqual(initial)
    expect(await services.demo?.getRole()).toBeNull()
    expect((await services.events.get(EVENTS.owner)).role).toBe('OWNER')
    expect(services.demo?.consumeRegeneratedNotice()).toBe(false)
  })

  it('stores the demo in the browser under one key and reads it back', async () => {
    const persistence = createBrowserPersistence(window.localStorage)
    const guest = await create(persistence).guests.create(
      EVENTS.owner,
      newGuest,
    )

    const reloaded = create(createBrowserPersistence(window.localStorage))

    expect(Object.keys(window.localStorage)).toEqual([DEMO_STORAGE_KEY])
    expect(
      (await reloaded.guests.list(EVENTS.owner)).some(
        (candidate) => candidate.id === guest.id,
      ),
    ).toBe(true)

    persistence.clear()
    expect(window.localStorage.getItem(DEMO_STORAGE_KEY)).toBeNull()
  })

  it('recovers from corrupted browser data', async () => {
    window.localStorage.setItem(DEMO_STORAGE_KEY, '{ not json')

    const services = create(createBrowserPersistence(window.localStorage))

    expect(await services.events.list()).toHaveLength(6)
    expect(services.demo?.consumeRegeneratedNotice()).toBe(true)
  })

  it('keeps working for the visit when browser storage is unavailable', async () => {
    const blocked = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('quota exceeded')
      },
      removeItem: () => {
        throw new Error('blocked')
      },
    } as unknown as Storage

    const services = create(createBrowserPersistence(blocked))
    const guest = await services.guests.create(EVENTS.owner, newGuest)

    expect(
      (await services.guests.list(EVENTS.owner)).some(
        (candidate) => candidate.id === guest.id,
      ),
    ).toBe(true)
    expect(await codeOf(services.demo!.reset())).toBe('NO_ERROR')
  })
})

describe('simulated demo role', () => {
  it('changes what the demo allows, without changing memberships', async () => {
    const services = create()

    await services.demo?.setRole('VIEWER')

    expect((await services.events.get(EVENTS.owner)).role).toBe('VIEWER')
    expect(await codeOf(services.guests.create(EVENTS.owner, newGuest))).toBe(
      'FORBIDDEN',
    )
    expect(await codeOf(services.permissions.list(EVENTS.owner))).toBe(
      'FORBIDDEN',
    )
    expect(await codeOf(services.guests.list(EVENTS.owner))).toBe('NO_ERROR')

    await services.demo?.setRole(null)

    expect((await services.events.get(EVENTS.owner)).role).toBe('OWNER')
    expect(
      (await services.permissions.list(EVENTS.owner)).members.find(
        (member) => member.isCurrentUser,
      )?.role,
    ).toBe('OWNER')
  })

  it('applies an Admin simulation to every event the user can reach', async () => {
    const services = create()

    await services.demo?.setRole('ADMIN')
    const roles = (await services.events.list()).map((item) => item.role)

    expect(new Set(roles)).toEqual(new Set(['ADMIN']))
    expect(await codeOf(services.guests.create(EVENTS.viewer, newGuest))).toBe(
      'NO_ERROR',
    )
  })

  it('simulates a Super User as Owner everywhere, still read-only on past events', async () => {
    const services = create()

    await services.demo?.setRole('SUPER_USER')

    expect((await services.events.get(EVENTS.viewer)).role).toBe('OWNER')
    expect(await codeOf(services.permissions.list(EVENTS.viewer))).toBe(
      'NO_ERROR',
    )
    expect(await codeOf(services.guests.create(EVENTS.past, newGuest))).toBe(
      'EVENT_READ_ONLY',
    )
  })

  it('never gives access to an event the user is not a member of, except as a Super User', async () => {
    const state = generateDemoState(NOW)
    const stored: StoredDemo = {
      version: DATASET_VERSION,
      state: {
        ...state,
        demoRole: 'OWNER',
        memberships: state.memberships.filter(
          (membership) =>
            !(
              membership.eventId === EVENTS.admin &&
              membership.userId === state.currentUserId
            ),
        ),
      },
    }
    const services = create(createMemoryPersistence(stored))

    expect(await codeOf(services.events.get(EVENTS.admin))).toBe('NOT_FOUND')
    expect(await codeOf(services.guests.list(EVENTS.admin))).toBe('NOT_FOUND')
    expect(await services.events.list()).toHaveLength(5)

    await services.demo?.setRole('SUPER_USER')

    expect((await services.events.get(EVENTS.admin)).role).toBe('OWNER')
    expect(await services.events.list()).toHaveLength(6)
  })
})

describe('simulated delay and failure', () => {
  it('fails only the named operations, with an UNAVAILABLE error', async () => {
    const services = create(createMemoryPersistence(), {
      failOperations: new Set(['guests.list', 'events.update']),
    })

    expect(await codeOf(services.guests.list(EVENTS.owner))).toBe('UNAVAILABLE')
    expect(await codeOf(services.events.list())).toBe('NO_ERROR')
    expect(await codeOf(services.tables.list(EVENTS.owner))).toBe('NO_ERROR')
  })

  it('changes nothing when a write fails', async () => {
    const persistence = createMemoryPersistence()
    const services = create(persistence, {
      failOperations: new Set(['guests.create']),
    })
    const before = structuredClone(persistence.load())

    expect(await codeOf(services.guests.create(EVENTS.owner, newGuest))).toBe(
      'UNAVAILABLE',
    )
    expect(persistence.load()).toEqual(before)
  })

  it('answers only after the configured delay', async () => {
    vi.useFakeTimers()
    try {
      const services = create(createMemoryPersistence(), { delayMs: 300 })
      const settled = vi.fn()
      void services.events.list().then(settled)

      await vi.advanceTimersByTimeAsync(299)
      expect(settled).not.toHaveBeenCalled()

      await vi.advanceTimersByTimeAsync(1)
      expect(settled).toHaveBeenCalledOnce()
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('side effects', () => {
  it('hands back the WhatsApp link without opening it: opening is the page’s job', async () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)
    const href = window.location.href
    const services = create()
    const [guest] = await services.guests.list(EVENTS.owner)

    const result = await services.messages.send(EVENTS.owner, guest!.id)

    expect(result.launchUrl).toMatch(/^https:\/\/wa\.me\/\d+\?text=/)
    expect(open).not.toHaveBeenCalled()
    expect(window.location.href).toBe(href)
  })

  it('uses the given address for the RSVP link in messages', async () => {
    const services = create(createMemoryPersistence(), {
      baseUrl: 'https://demo.example.com',
    })
    const [guest] = await services.guests.list(EVENTS.owner)
    const { event } = await services.events.get(EVENTS.owner)

    expect(
      (await services.messages.preview(EVENTS.owner, guest!.id)).message,
    ).toContain(`https://demo.example.com/rsvp/${event.rsvpSlug}`)
  })
})

describe('role and action matrix', () => {
  const ROLES = ['VIEWER', 'ADMIN', 'OWNER', 'SUPER_USER'] as const
  const OK = 'NO_ERROR'
  const NO = 'FORBIDDEN'
  const ENDED = 'EVENT_READ_ONLY'

  // Per action: the outcome for Viewer, Admin, Owner and Super User.
  const expected = {
    upcoming: {
      'view guests': [OK, OK, OK, OK],
      'export data (read tables)': [OK, OK, OK, OK],
      'add a guest': [NO, OK, OK, OK],
      'add a table': [NO, OK, OK, OK],
      'save the message': [NO, OK, OK, OK],
      'see permissions': [NO, OK, OK, OK],
      'invite a Viewer': [NO, OK, OK, OK],
      'invite an Owner': [NO, NO, OK, OK],
      'duplicate the event': [NO, NO, OK, OK],
      'delete the event': [NO, NO, OK, OK],
    },
    past: {
      'view guests': [OK, OK, OK, OK],
      'export data (read tables)': [OK, OK, OK, OK],
      'add a guest': [NO, ENDED, ENDED, ENDED],
      'add a table': [NO, ENDED, ENDED, ENDED],
      'save the message': [NO, ENDED, ENDED, ENDED],
      'see permissions': [NO, OK, OK, OK],
      'invite a Viewer': [NO, ENDED, OK, OK],
      'invite an Owner': [NO, ENDED, OK, OK],
      'duplicate the event': [NO, NO, OK, OK],
      'delete the event': [NO, NO, OK, OK],
    },
  } as const

  type Action = keyof typeof expected.upcoming

  function attempt(
    services: ReturnType<typeof create>,
    eventId: string,
    action: Action,
  ): Promise<unknown> {
    switch (action) {
      case 'view guests':
        return services.guests.list(eventId)
      case 'export data (read tables)':
        return services.tables.list(eventId)
      case 'add a guest':
        return services.guests.create(eventId, newGuest)
      case 'add a table':
        return services.tables.create(eventId, {
          number: 900,
          capacity: 8,
          shape: 'CIRCLE',
        })
      case 'save the message':
        return services.messages.updateTemplate(eventId, 'Hello {{rsvp_url}}')
      case 'see permissions':
        return services.permissions.list(eventId)
      case 'invite a Viewer':
        return services.permissions.invite(eventId, 'v@example.org', 'VIEWER')
      case 'invite an Owner':
        return services.permissions.invite(eventId, 'o@example.org', 'OWNER')
      case 'duplicate the event':
        return services.events.duplicate(eventId, {
          name: 'Copy',
          startsAt: '2031-01-01T18:00:00.000Z',
        })
      case 'delete the event':
        return services.events.remove(eventId)
    }
  }

  describe.each([
    ['upcoming', EVENTS.owner],
    ['past', EVENTS.past],
  ] as const)('on an %s event', (when, eventId) => {
    describe.each(ROLES.map((role, index) => [role, index] as const))(
      'as %s',
      (role, index) => {
        it.each(Object.keys(expected[when]) as Action[])(
          '%s',
          async (action) => {
            const services = create()
            await services.demo?.setRole(role)

            expect(await codeOf(attempt(services, eventId, action))).toBe(
              expected[when][action][index],
            )
          },
        )
      },
    )
  })
})
