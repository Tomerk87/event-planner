import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { DomainError } from '../domain/errors.ts'
import { createServices } from '../services/createServices.ts'
import { generateDemoState } from '../services/mock/generator.ts'
import { createMemoryPersistence } from '../services/mock/persistence.ts'
import { DATASET_VERSION } from '../services/mock/state.ts'
import { describeError } from '../shared/errorMessage.ts'
import { setViewportWidth } from '../test/matchMedia.ts'
import {
  createTestServices,
  DEMO_EVENTS,
  renderApp,
  TEST_NOW,
} from '../test/renderApp.tsx'
import { change, optionLabels } from '../test/controls.ts'

async function openEvent(eventId: string, page = 'layout') {
  const view = renderApp(`/events/${eventId}/${page}`)
  await screen.findByText('This page is not implemented yet.')
  return view
}

function navLinks() {
  const nav = screen.getByRole('navigation', { name: 'Event navigation' })
  return within(nav)
    .getAllByRole('link')
    .map((link) => link.textContent)
}

function roleSelect() {
  return screen.getByRole('combobox', { name: 'Simulated role' })
}

describe('application frame on demo data', () => {
  it('shows the generated event, the other events and the user, with no setup', async () => {
    await openEvent(DEMO_EVENTS.owner)

    const selector = screen.getByRole('button', {
      name: 'Current event: Maya & Daniel’s Wedding. Switch event',
    })
    fireEvent.click(selector)
    const list = screen.getByRole('list', { name: 'Your events' })

    expect(within(list).getAllByRole('link')).toHaveLength(5)
    expect(
      within(list).getByRole('link', { name: 'Levi Family Birthday' }),
    ).toHaveAttribute('href', '/events/evt-3/dashboard')
    expect(screen.getByText('Alex Morgan')).toBeInTheDocument()
    expect(
      screen.getByText('Your role in this event: Owner'),
    ).toBeInTheDocument()
  })

  it.each([
    [DEMO_EVENTS.owner, 'Owner', true],
    [DEMO_EVENTS.admin, 'Admin', true],
    [DEMO_EVENTS.viewer, 'Viewer', false],
  ] as const)(
    'reflects the user’s role in %s: %s',
    async (eventId, role, seesPermissions) => {
      await openEvent(eventId)

      expect(
        screen.getByText(`Your role in this event: ${role}`),
      ).toBeInTheDocument()
      expect(navLinks().includes('Permissions')).toBe(seesPermissions)
    },
  )

  it('explains view-only access to a Viewer and nothing to an Owner', async () => {
    const { unmount } = await openEvent(DEMO_EVENTS.viewer)
    expect(screen.getByText('View-only access')).toBeInTheDocument()
    unmount()

    await openEvent(DEMO_EVENTS.owner)
    expect(screen.queryByText('View-only access')).not.toBeInTheDocument()
    expect(screen.queryByText('This event has ended')).not.toBeInTheDocument()
  })

  it('marks a past event as read-only even for its Owner', async () => {
    await openEvent(DEMO_EVENTS.past)

    expect(
      screen.getByText('Your role in this event: Owner'),
    ).toBeInTheDocument()
    expect(screen.getByText('This event has ended')).toBeInTheDocument()
  })

  it('shows no role on the homepage', async () => {
    renderApp('/')

    expect(await screen.findByText('Alex Morgan')).toBeInTheDocument()
    expect(
      screen.queryByText(/Your role in this event/),
    ).not.toBeInTheDocument()
  })

  it('shows the not-found page for an event that does not exist', async () => {
    renderApp('/events/no-such-event/guests')

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Page not found' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
  })

  it('shows a loading state while the event loads, without Permissions', async () => {
    renderApp(
      `/events/${DEMO_EVENTS.owner}/guests`,
      createTestServices({ delayMs: 40 }),
    )

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Loading…' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Loading…')
    expect(navLinks()).not.toContain('Permissions')

    await screen.findByRole('heading', { level: 1, name: 'Guests' })
    expect(navLinks()).toContain('Permissions')
  })

  it('shows an error with a retry when the event cannot be loaded', async () => {
    const services = createTestServices({
      failOperations: new Set(['events.get']),
    })
    renderApp(`/events/${DEMO_EVENTS.owner}/guests`, services)

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(
      'The service is not available right now. Please try again.',
    )
    expect(
      screen.getByRole('heading', { level: 1, name: 'Something went wrong' }),
    ).toBeInTheDocument()

    fireEvent.click(within(alert).getByRole('button', { name: 'Try again' }))

    expect(await screen.findByRole('alert')).toBeInTheDocument()
  })
})

describe('demo controls', () => {
  it('labels the application as a demo on every framed page', async () => {
    const { unmount } = renderApp('/')
    expect(await screen.findByText('Demo Mode')).toBeInTheDocument()
    unmount()

    await openEvent(DEMO_EVENTS.owner)
    expect(screen.getByText('Demo Mode')).toBeInTheDocument()
    expect(
      screen.getByRole('group', { name: 'Demo controls' }),
    ).toBeInTheDocument()
  })

  it('shows no demo label or controls when the provider is not a demo', async () => {
    renderApp('/', { ...createTestServices(), demo: null })

    expect(await screen.findByText('Alex Morgan')).toBeInTheDocument()
    expect(screen.queryByText('Demo Mode')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('group', { name: 'Demo controls' }),
    ).not.toBeInTheDocument()
  })

  it('simulates a Viewer, hiding Permissions and editing, then returns to the real role', async () => {
    const { services } = await openEvent(DEMO_EVENTS.owner)
    expect(roleSelect()).toHaveValue('OWN')

    change(roleSelect(), { target: { value: 'VIEWER' } })

    expect(
      await screen.findByText('Your role in this event: Viewer'),
    ).toBeInTheDocument()
    expect(navLinks()).not.toContain('Permissions')
    expect(screen.getByText('View-only access')).toBeInTheDocument()
    expect(roleSelect()).toHaveValue('VIEWER')
    expect(await services.demo?.getRole()).toBe('VIEWER')

    change(roleSelect(), { target: { value: 'OWN' } })

    expect(
      await screen.findByText('Your role in this event: Owner'),
    ).toBeInTheDocument()
    expect(navLinks()).toContain('Permissions')
  })

  it('simulates a Super User as Owner on an event where the user is a Viewer', async () => {
    await openEvent(DEMO_EVENTS.viewer)

    change(roleSelect(), { target: { value: 'SUPER_USER' } })

    expect(
      await screen.findByText('Your role in this event: Owner'),
    ).toBeInTheDocument()
    expect(navLinks()).toContain('Permissions')
  })

  it('offers every simulated role, each labelled as a simulation', async () => {
    await openEvent(DEMO_EVENTS.owner)

    expect(optionLabels(roleSelect())).toEqual([
      'Role: my own',
      'Simulate Owner',
      'Simulate Admin',
      'Simulate Viewer',
      'Simulate Super User',
    ])
  })

  it('resets the demo only after confirmation', async () => {
    const { services } = await openEvent(DEMO_EVENTS.owner)
    const added = await services.guests.create(DEMO_EVENTS.owner, {
      firstName: 'Temporary',
      lastName: 'Guest',
      phone: '+972 00-777-0001',
      allowedAttendees: 2,
    })
    change(roleSelect(), { target: { value: 'ADMIN' } })
    await screen.findByText('Your role in this event: Admin')

    fireEvent.click(screen.getByRole('button', { name: 'Reset Demo' }))
    const dialog = screen.getByRole('dialog', { name: 'Reset the demo?' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(await services.demo?.getRole()).toBe('ADMIN')

    fireEvent.click(screen.getByRole('button', { name: 'Reset Demo' }))
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Reset Demo',
      }),
    )

    expect(
      await screen.findByText('The demo was reset to its original data.'),
    ).toBeInTheDocument()
    expect(
      await screen.findByText('Your role in this event: Owner'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(roleSelect()).toHaveValue('OWN')
    expect(
      (await services.guests.list(DEMO_EVENTS.owner)).some(
        (guest) => guest.id === added.id,
      ),
    ).toBe(false)
  })

  it('reports a failed reset and leaves the data alone', async () => {
    const services = createTestServices({
      failOperations: new Set(['demo.reset']),
    })
    renderApp(`/events/${DEMO_EVENTS.owner}/layout`, services)
    await screen.findByText('This page is not implemented yet.')

    fireEvent.click(screen.getByRole('button', { name: 'Reset Demo' }))
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Reset Demo',
      }),
    )

    expect(
      await screen.findByText(
        'The service is not available right now. Please try again.',
      ),
    ).toBeInTheDocument()
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    )
  })

  it('tells the visitor once when stored demo data was refreshed', async () => {
    const stale = {
      version: DATASET_VERSION - 1,
      state: generateDemoState(TEST_NOW),
    }
    renderApp(
      '/',
      createTestServices({ persistence: createMemoryPersistence(stale) }),
    )

    expect(
      await screen.findByText(
        'The demo was updated, so its sample data was refreshed.',
      ),
    ).toBeInTheDocument()
  })

  it('says nothing about a refresh on a normal first visit', async () => {
    renderApp('/')
    await screen.findByText('Alex Morgan')

    expect(
      screen.queryByText(/sample data was refreshed/),
    ).not.toBeInTheDocument()
  })

  it('moves the controls into the menu drawer on a phone, keeping the demo label visible', async () => {
    setViewportWidth(400)
    await openEvent(DEMO_EVENTS.owner)

    expect(screen.getByText('Demo Mode')).toBeInTheDocument()
    expect(
      screen.queryByRole('group', { name: 'Demo controls' }),
    ).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }))
    const drawer = screen.getByRole('dialog', { name: 'Menu' })

    expect(
      within(drawer).getByRole('group', { name: 'Demo controls' }),
    ).toBeInTheDocument()
    expect(
      within(drawer).getByRole('button', { name: 'Reset Demo' }),
    ).toBeInTheDocument()
  })
})

describe('createServices', () => {
  const DEMO = { workspace: 'demo' } as const
  const location = { search: '', origin: 'https://demo.example.com' }

  it('creates the demo provider for "mock", stored in the given browser storage', async () => {
    const services = createServices(
      'mock',
      location,
      window.localStorage,
    ).servicesFor(DEMO)

    expect(await services.events.list()).toHaveLength(6)
    expect(services.demo).not.toBeNull()
    expect(Object.keys(window.localStorage)).toContain('event-planner.demo')
  })

  it('refuses the "api" provider until it exists', () => {
    expect(() => createServices('api', location, window.localStorage)).toThrow(
      DomainError,
    )
  })

  it('reads forced failures from the address', async () => {
    const services = createServices(
      'mock',
      { ...location, search: '?demoDelay=0&demoFail=events.list,guests.list' },
      window.localStorage,
    ).servicesFor(DEMO)

    await expect(services.events.list()).rejects.toMatchObject({
      code: 'UNAVAILABLE',
    })
    await expect(services.events.get('evt-1')).resolves.toBeDefined()
  })

  it.each(['abc', '-5', ''])(
    'ignores an invalid delay of %j',
    async (value) => {
      const services = createServices(
        'mock',
        { ...location, search: `?demoDelay=${value}` },
        window.localStorage,
      ).servicesFor(DEMO)

      await expect(services.events.list()).resolves.toHaveLength(6)
    },
  )
})

describe('describeError', () => {
  const t = ((key: string, values?: Record<string, unknown>) =>
    `${key}${values ? JSON.stringify(values) : ''}`) as never

  it('uses the error code and its details', () => {
    expect(
      describeError(
        t,
        new DomainError('TABLE_FULL', { available: 2, needed: 5 }),
      ),
    ).toBe('errors.TABLE_FULL{"available":2,"needed":5}')
  })

  it('falls back to a generic message for anything else', () => {
    expect(describeError(t, new Error('boom'))).toBe('errors.UNKNOWN')
    expect(describeError(t, 'boom')).toBe('errors.UNKNOWN')
  })
})
