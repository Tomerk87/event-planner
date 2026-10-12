import { fireEvent, render, screen, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { changeLanguage } from '../i18n/i18n.ts'
import { RouteError } from '../shared/RouteError.tsx'
import { ToastProvider } from '../shared/ui/ToastProvider.tsx'
import { routes } from './routes.tsx'

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(
    <ToastProvider>
      <RouterProvider router={router} />
    </ToastProvider>,
  )
  return router
}

describe('routes', () => {
  it.each([
    ['/', 'My Events'],
    ['/events/e1/dashboard', 'Dashboard'],
    ['/events/e1/guests', 'Guests'],
    ['/events/e1/rsvp', 'RSVP Settings'],
    ['/events/e1/messages', 'WhatsApp Messages'],
    ['/events/e1/layout', 'Event Layout'],
    ['/events/e1/settings', 'Event Settings'],
    ['/events/e1/permissions', 'Permissions'],
    ['/rsvp/abc123', 'RSVP'],
  ])('renders a placeholder at %s', async (path, title) => {
    renderAt(path)

    expect(
      await screen.findByRole('heading', { level: 1, name: title }),
    ).toBeInTheDocument()
    expect(
      screen.getByText('This page is not implemented yet.'),
    ).toBeInTheDocument()
  })

  it.each([
    ['/', 'My Events · Event Planner'],
    ['/events/e1/messages', 'WhatsApp Messages · Event Planner'],
    ['/rsvp/abc123', 'RSVP · Event Planner'],
    ['/showcase', 'Design System · Event Planner'],
    ['/nope', 'Page not found · Event Planner'],
  ])('sets the browser tab title at %s', async (path, title) => {
    renderAt(path)

    await screen.findByRole('heading', { level: 1 })
    expect(document.title).toBe(title)
  })

  it('translates the browser tab title', async () => {
    renderAt('/events/e1/guests')
    await screen.findByRole('heading', { level: 1 })

    await changeLanguage('he')

    await screen.findByRole('heading', { level: 1, name: 'אורחים' })
    expect(document.title).toBe('אורחים · Event Planner')
  })

  it('moves focus to the main content after navigating, but not on first load', async () => {
    renderAt('/events/e1/guests')
    await screen.findByRole('heading', { level: 1, name: 'Guests' })
    expect(screen.getByRole('main')).not.toHaveFocus()

    fireEvent.click(screen.getByRole('link', { name: 'Dashboard' }))

    await screen.findByRole('heading', { level: 1, name: 'Dashboard' })
    expect(screen.getByRole('main')).toHaveFocus()
    expect(document.title).toBe('Dashboard · Event Planner')
  })

  it('moves focus to the main content when navigating to a page outside the shell', async () => {
    const router = renderAt('/events/e1/guests')
    await screen.findByRole('heading', { level: 1, name: 'Guests' })

    await router.navigate('/rsvp/abc123')

    await screen.findByRole('heading', { level: 1, name: 'RSVP' })
    expect(screen.getByRole('main')).toHaveFocus()
  })

  it('redirects an event root to its dashboard', async () => {
    const router = renderAt('/events/e1')

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Dashboard' }),
    ).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/events/e1/dashboard')
  })

  it('shows the event navigation inside an event', async () => {
    renderAt('/events/e1/guests')

    const nav = await screen.findByRole('navigation', {
      name: 'Event navigation',
    })
    expect(within(nav).getAllByRole('link')).toHaveLength(7)
    expect(
      screen.getByRole('link', { name: 'Back to My Events' }),
    ).toHaveAttribute('href', '/')
  })

  it('shows the main navigation on the homepage', async () => {
    renderAt('/')

    const nav = await screen.findByRole('navigation', {
      name: 'Main navigation',
    })
    expect(
      within(nav).getByRole('link', { name: 'My Events' }),
    ).toHaveAttribute('aria-current', 'page')
  })

  it('does not show navigation on the public RSVP page', async () => {
    renderAt('/rsvp/abc123')

    await screen.findByRole('heading', { level: 1, name: 'RSVP' })
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
  })

  it('renders the design-system showcase', async () => {
    renderAt('/showcase')

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Design System' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Garden Celebration/ }),
    ).toBeInTheDocument()
  })

  it.each(['/nope', '/events/e1/nope'])(
    'renders the not-found page at %s',
    async (path) => {
      renderAt(path)

      expect(
        await screen.findByRole('heading', {
          level: 1,
          name: 'Page not found',
        }),
      ).toBeInTheDocument()
    },
  )

  it('renders the error page when a route throws', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    function Broken(): never {
      throw new Error('boom')
    }
    const router = createMemoryRouter([
      { path: '/', element: <Broken />, errorElement: <RouteError /> },
    ])
    render(<RouterProvider router={router} />)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Something went wrong',
    )
  })
})
