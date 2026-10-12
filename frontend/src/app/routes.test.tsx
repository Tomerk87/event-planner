import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { RouteError } from '../shared/RouteError.tsx'
import { routes } from './routes.tsx'

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(<RouterProvider router={router} />)
  return router
}

describe('routes', () => {
  it.each([
    ['/', 'My Events'],
    ['/events/e1/dashboard', 'Dashboard'],
    ['/events/e1/guests', 'Guests'],
    ['/events/e1/messages', 'Messages'],
    ['/events/e1/rsvp', 'RSVP Settings'],
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

  it('redirects an event root to its dashboard', async () => {
    const router = renderAt('/events/e1')

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Dashboard' }),
    ).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/events/e1/dashboard')
  })

  it('shows event navigation inside an event', async () => {
    renderAt('/events/e1/guests')
    expect(
      await screen.findByRole('navigation', { name: 'Event' }),
    ).toBeInTheDocument()
  })

  it('does not show event navigation on the public RSVP page', async () => {
    renderAt('/rsvp/abc123')

    await screen.findByRole('heading', { level: 1, name: 'RSVP' })
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
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
