import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { changeLanguage } from '../i18n/i18n.ts'
import { setViewportWidth } from '../test/matchMedia.ts'
import { createTestBackend, renderApp } from '../test/renderApp.tsx'
import { change } from '../test/controls.ts'

const HEADLINE = 'Plan every guest. Manage every detail.'

function renderSignedOut(
  path = '/',
  backend = createTestBackend({ session: 'none' }),
) {
  return renderApp(path, undefined, { backend })
}

async function landing() {
  return screen.findByRole('heading', { level: 1, name: HEADLINE })
}

function fill(label: RegExp | string, value: string) {
  change(screen.getByLabelText(label), { target: { value } })
}

function signUpAs(name: string, email: string, password = 'long-enough') {
  fill(/Full name/, name)
  fill(/Email/, email)
  fill(/Password/, password)
  fireEvent.click(screen.getByRole('button', { name: 'Sign Up' }))
}

async function myEvents() {
  return screen.findByRole('heading', { level: 1, name: 'My Events' })
}

describe('landing page', () => {
  it('presents the product and the three ways in', async () => {
    renderSignedOut()
    await landing()

    const header = screen.getByRole('banner')
    expect(
      within(header).getByRole('link', { name: 'Sign In' }),
    ).toHaveAttribute('href', '/signin')
    expect(
      within(header).getByRole('link', { name: 'Sign Up' }),
    ).toHaveAttribute('href', '/signup')
    expect(
      within(header).getByRole('link', { name: 'Features' }),
    ).toHaveAttribute('href', '#features')
    expect(screen.getAllByRole('button', { name: 'Try Demo' })).toHaveLength(3)
    expect(
      screen.getByText(
        'No account required. Explore fully populated demo events.',
      ),
    ).toBeInTheDocument()
    expect(
      screen
        .getAllByRole('heading', { level: 3 })
        .map((heading) => heading.textContent),
    ).toEqual([
      'Guest Management',
      'RSVP Tracking',
      'WhatsApp Invitations',
      'Seating & Tables',
    ])
    expect(document.title).toBe('Plan every guest · Event Planner')
  })

  it('opens the populated demo with one click and no account', async () => {
    const { router } = renderSignedOut()
    await landing()

    fireEvent.click(screen.getAllByRole('button', { name: 'Try Demo' })[1]!)

    await myEvents()
    expect(router.state.location.pathname).toBe('/events')
    expect(
      await screen.findByRole('heading', {
        level: 2,
        name: 'Maya & Daniel’s Wedding',
      }),
    ).toBeInTheDocument()
    expect(screen.getByText('Demo Mode')).toBeInTheDocument()
    expect(screen.getByText('Alex Morgan')).toBeInTheDocument()
  })

  it('says so when the demo cannot be opened', async () => {
    renderSignedOut(
      '/',
      createTestBackend({
        session: 'none',
        failOperations: new Set(['auth.enterDemo']),
      }),
    )
    await landing()

    fireEvent.click(screen.getAllByRole('button', { name: 'Try Demo' })[0]!)

    expect(
      await screen.findByText(
        'The service is not available right now. Please try again.',
      ),
    ).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Try Demo' })[0]).toBeEnabled()
  })

  it('offers the ways in from a menu on a phone', async () => {
    setViewportWidth(390)
    renderSignedOut()
    await landing()

    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }))
    const menu = screen.getByRole('menu')

    expect(
      within(menu).getByRole('menuitem', { name: 'Sign In' }),
    ).toHaveAttribute('href', '/signin')
    expect(
      within(menu).getByRole('menuitem', { name: 'Sign Up' }),
    ).toHaveAttribute('href', '/signup')
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Try Demo' }))
    await myEvents()
  })

  it('is translated', async () => {
    await changeLanguage('he')
    renderSignedOut()

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'לתכנן כל אורח. לנהל כל פרט.',
      }),
    ).toBeInTheDocument()
    expect(
      screen.getAllByRole('button', { name: 'נסו את הדמו' }).length,
    ).toBeGreaterThan(0)
  })
})

describe('access without a session', () => {
  it.each(['/events', '/events/evt-1/guests', '/showcase'])(
    'sends a signed-out visitor from %s to the landing page',
    async (path) => {
      const { router } = renderSignedOut(path)

      await landing()
      expect(router.state.location.pathname).toBe('/')
    },
  )

  it('keeps the public RSVP page open to everyone', async () => {
    renderSignedOut('/rsvp/abc123')

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'This RSVP page is not available',
      }),
    ).toBeInTheDocument()
  })

  it.each(['/', '/signin', '/signup'])(
    'sends a visitor who is already in from %s to My Events',
    async (path) => {
      const { router } = renderApp(path)

      await myEvents()
      expect(router.state.location.pathname).toBe('/events')
    },
  )
})

describe('sign up, log out and sign in', () => {
  it('creates an account that starts with no events, and can add the first', async () => {
    renderSignedOut('/signup')
    await screen.findByRole('heading', {
      level: 1,
      name: 'Create your account',
    })
    expect(screen.getByText('Preview version')).toBeInTheDocument()

    signUpAs('Riley Stone', 'riley@example.com')

    await myEvents()
    expect(await screen.findByText('No events yet')).toBeInTheDocument()
    expect(screen.getByText('Riley Stone')).toBeInTheDocument()
    expect(screen.queryByText('Demo Mode')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Reset Demo' }),
    ).not.toBeInTheDocument()

    fireEvent.click(
      screen.getByRole('button', { name: 'Create your first event' }),
    )
    const dialog = screen.getByRole('dialog', { name: 'Create event' })
    change(within(dialog).getByLabelText(/Event Name/), {
      target: { value: 'Housewarming' },
    })
    change(within(dialog).getByLabelText(/^Date/), {
      target: { value: '2031-02-02' },
    })
    change(within(dialog).getByLabelText(/^Time \*/), {
      target: { value: '18:00' },
    })
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Create Event' }),
    )

    expect(
      await screen.findByRole('heading', { level: 2, name: 'Housewarming' }),
    ).toBeInTheDocument()
  })

  it('returns to the same account and its events after logging out and signing in', async () => {
    const backend = createTestBackend({ session: 'none' })
    const session = await backend.auth.signUp({
      name: 'Riley Stone',
      email: 'riley@example.com',
      password: 'long-enough',
    })
    await backend.servicesFor(session).events.create({
      name: 'Housewarming',
      startsAt: '2031-02-02T16:00:00.000Z',
      timeZone: 'Asia/Jerusalem',
      maxAttendees: 60,
      defaultAllowedAttendees: 2,
      rsvpLanguage: 'en',
    })
    const { router } = renderApp('/events', undefined, { backend })
    await screen.findByRole('heading', { level: 2, name: 'Housewarming' })

    fireEvent.click(
      screen.getByRole('button', { name: 'Account menu for Riley Stone' }),
    )
    fireEvent.click(screen.getByRole('menuitem', { name: 'Log out' }))

    await landing()
    expect(router.state.location.pathname).toBe('/')
    expect(await backend.auth.getSession()).toBeNull()

    fireEvent.click(
      within(screen.getByRole('banner')).getByRole('link', { name: 'Sign In' }),
    )
    await screen.findByRole('heading', { level: 1, name: 'Sign in' })
    fill(/Email/, 'Riley@Example.com')
    fill(/Password/, 'whatever')
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }))

    expect(
      await screen.findByRole('heading', { level: 2, name: 'Housewarming' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { level: 2, name: 'Levi Family Birthday' }),
    ).not.toBeInTheDocument()
  })

  it('logs out from the homepage sidebar, keeping the demo data', async () => {
    const { backend, services } = renderApp('/events')
    await screen.findByRole('list', { name: 'Events' })
    await services.events.remove('evt-5')

    fireEvent.click(
      within(screen.getByRole('complementary')).getByRole('button', {
        name: 'Log out',
      }),
    )

    await landing()
    fireEvent.click(screen.getAllByRole('button', { name: 'Try Demo' })[0]!)
    await screen.findByRole('list', { name: 'Events' })
    expect(
      screen.queryByRole('heading', { level: 2, name: 'Spring Garden Party' }),
    ).not.toBeInTheDocument()
    expect(await backend.auth.getSession()).toEqual({ workspace: 'demo' })
  })

  it('offers log out from the user menu inside an event', async () => {
    renderApp('/events/evt-1/guests')
    await screen.findByRole('heading', { level: 1, name: 'Guests' })

    fireEvent.click(
      screen.getByRole('button', { name: 'Account menu for Alex Morgan' }),
    )
    fireEvent.click(screen.getByRole('menuitem', { name: 'Log out' }))

    await landing()
  })

  it('explains each invalid sign-up field and a taken email', async () => {
    const backend = createTestBackend({ session: 'none' })
    await backend.auth.signUp({
      name: 'Dana',
      email: 'dana@example.com',
      password: 'long-enough',
    })
    await backend.auth.signOut()
    renderSignedOut('/signup', backend)
    await screen.findByRole('heading', {
      level: 1,
      name: 'Create your account',
    })

    fireEvent.click(screen.getByRole('button', { name: 'Sign Up' }))
    expect(screen.getByText('Enter your name.')).toBeInTheDocument()

    signUpAs('Riley', 'riley', 'long-enough')
    expect(screen.getByText('Enter a valid email address.')).toBeInTheDocument()

    signUpAs('Riley', 'riley@example.com', 'short')
    expect(screen.getByText('Use at least 8 characters.')).toBeInTheDocument()
    expect(screen.getByLabelText(/Password/)).toHaveAttribute(
      'aria-invalid',
      'true',
    )

    signUpAs('Dana Again', 'DANA@example.com')
    expect(
      await screen.findByText(
        'An account with this email already exists. Sign in instead.',
      ),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sign Up' })).toBeEnabled()
  })

  it('refuses to sign in an unknown email, and explains missing details', async () => {
    renderSignedOut('/signin')
    await screen.findByRole('heading', { level: 1, name: 'Sign in' })

    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }))
    expect(screen.getByText('Enter a valid email address.')).toBeInTheDocument()

    fill(/Email/, 'nobody@example.com')
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }))
    expect(screen.getByText('Enter your password.')).toBeInTheDocument()

    fill(/Password/, 'whatever')
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No account with this email was found in this browser. Sign up, or try the demo.',
    )
    expect(screen.getByRole('link', { name: 'Sign Up' })).toHaveAttribute(
      'href',
      '/signup',
    )
  })

  it('shows a failed sign-up as a message, not as a field error', async () => {
    renderSignedOut(
      '/signup',
      createTestBackend({
        session: 'none',
        failOperations: new Set(['auth.signUp']),
      }),
    )
    await screen.findByRole('heading', {
      level: 1,
      name: 'Create your account',
    })

    signUpAs('Riley Stone', 'riley@example.com')

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The service is not available right now. Please try again.',
    )
  })

  it('lets a visitor open the demo from either form', async () => {
    renderSignedOut('/signin')
    await screen.findByRole('heading', { level: 1, name: 'Sign in' })

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Or explore the demo without an account',
      }),
    )

    await myEvents()
    await waitFor(() =>
      expect(screen.getByText('Demo Mode')).toBeInTheDocument(),
    )
  })

  it('says so when logging out fails, and stays signed in', async () => {
    renderApp('/events', undefined, {
      backend: createTestBackend({ failOperations: new Set(['auth.signOut']) }),
    })
    await screen.findByRole('list', { name: 'Events' })

    fireEvent.click(
      within(screen.getByRole('complementary')).getByRole('button', {
        name: 'Log out',
      }),
    )

    expect(
      await screen.findByText(
        'The service is not available right now. Please try again.',
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { level: 1, name: 'My Events' }),
    ).toBeInTheDocument()
  })
})
