import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { changeLanguage } from '../i18n/i18n.ts'
import { RouteError } from '../shared/RouteError.tsx'
import { renderApp } from '../test/renderApp.tsx'

describe('routes', () => {
  it.each([
    ['/events/evt-1/rsvp', 'RSVP Settings'],
    ['/events/evt-1/messages', 'WhatsApp Messages'],
    ['/events/evt-1/layout', 'Event Layout'],
    ['/events/evt-1/settings', 'Event Settings'],
    ['/events/evt-1/permissions', 'Permissions'],
    ['/rsvp/abc123', 'RSVP'],
  ])('renders a placeholder at %s', async (path, title) => {
    renderApp(path)

    expect(
      await screen.findByRole('heading', { level: 1, name: title }),
    ).toBeInTheDocument()
    expect(
      screen.getByText('This page is not implemented yet.'),
    ).toBeInTheDocument()
  })

  it.each([
    ['/events', 'My Events · Event Planner'],
    ['/events/evt-1/messages', 'WhatsApp Messages · Event Planner'],
    ['/rsvp/abc123', 'RSVP · Event Planner'],
    ['/showcase', 'Design System · Event Planner'],
    ['/nope', 'Page not found · Event Planner'],
  ])('sets the browser tab title at %s', async (path, title) => {
    renderApp(path)

    await waitFor(() => expect(document.title).toBe(title))
  })

  it('translates the browser tab title', async () => {
    renderApp('/events/evt-1/guests')
    await screen.findByRole('heading', { level: 1 })

    await changeLanguage('he')

    await screen.findByRole('heading', { level: 1, name: 'אורחים' })
    expect(document.title).toBe('אורחים · Event Planner')
  })

  it('moves focus to the main content after navigating, but not on first load', async () => {
    renderApp('/events/evt-1/guests')
    await screen.findByRole('heading', { level: 1, name: 'Guests' })
    expect(screen.getByRole('main')).not.toHaveFocus()

    fireEvent.click(screen.getByRole('link', { name: 'Dashboard' }))

    await screen.findByRole('heading', { level: 1, name: 'Dashboard' })
    expect(screen.getByRole('main')).toHaveFocus()
    expect(document.title).toBe('Dashboard · Event Planner')
  })

  it('moves focus to the main content when navigating to a page outside the shell', async () => {
    const { router } = renderApp('/events/evt-1/guests')
    await screen.findByRole('heading', { level: 1, name: 'Guests' })

    await router.navigate('/rsvp/abc123')

    await screen.findByRole('heading', { level: 1, name: 'RSVP' })
    expect(screen.getByRole('main')).toHaveFocus()
  })

  it('redirects an event root to its dashboard', async () => {
    const { router } = renderApp('/events/evt-1')

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Dashboard' }),
    ).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/events/evt-1/dashboard')
  })

  it('shows the event navigation inside an event', async () => {
    renderApp('/events/evt-1/guests')
    await screen.findByRole('heading', { level: 1, name: 'Guests' })

    const nav = screen.getByRole('navigation', { name: 'Event navigation' })
    expect(within(nav).getAllByRole('link')).toHaveLength(7)
    expect(
      screen.getByRole('link', { name: 'Back to My Events' }),
    ).toHaveAttribute('href', '/events')
  })

  it('shows the main navigation on the homepage', async () => {
    renderApp('/events')

    const nav = await screen.findByRole('navigation', {
      name: 'Main navigation',
    })
    expect(
      within(nav).getByRole('link', { name: 'My Events' }),
    ).toHaveAttribute('aria-current', 'page')
  })

  it('does not show navigation on the public RSVP page', async () => {
    renderApp('/rsvp/abc123')

    await screen.findByRole('heading', { level: 1, name: 'RSVP' })
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
  })

  it('renders the design-system showcase inside the frame, with the demo events', async () => {
    renderApp('/showcase')

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Design System' }),
    ).toBeInTheDocument()
    expect(
      await screen.findByRole('button', { name: /Current event: / }),
    ).toBeInTheDocument()
  })

  it('shows a working menu and event covers in the showcase', async () => {
    renderApp('/showcase')
    await screen.findByRole('heading', { level: 1, name: 'Design System' })

    fireEvent.click(screen.getByRole('button', { name: 'Sample actions' }))
    const menu = screen.getByRole('menu', { name: 'Sample actions' })
    expect(
      within(menu)
        .getAllByRole('menuitem')
        .map((item) => item.textContent),
    ).toEqual(['Open', 'Duplicate', 'Delete'])

    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Duplicate' }))

    expect(await screen.findByText('Action chosen.')).toBeInTheDocument()
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Sample actions' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' }))
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('renders the not-found page at an unknown address', async () => {
    renderApp('/nope')

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Page not found' }),
    ).toBeInTheDocument()
  })

  it('renders the not-found page at an unknown page of a real event', async () => {
    renderApp('/events/evt-1/nope')

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Page not found' }),
    ).toBeInTheDocument()
  })

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
