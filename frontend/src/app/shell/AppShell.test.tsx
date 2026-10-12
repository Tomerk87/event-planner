import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { CalendarDays } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import type { EventRole } from '../../domain/roles.ts'
import { setViewportWidth } from '../../test/matchMedia.ts'
import { AppShell } from './AppShell.tsx'
import { getEventNavItems } from './eventNav.ts'

const events = [
  { id: 'e1', name: 'Garden Celebration' },
  { id: 'e2', name: 'Autumn Gala' },
]

function EventShell({ role }: { role?: EventRole }) {
  const { t } = useTranslation()
  return (
    <AppShell
      navLabel={t('nav.event')}
      navItems={getEventNavItems(t, 'e1', role)}
      event={events[0]}
      events={events}
      user={{ name: 'Alex Morgan', role }}
    >
      <p>Page content</p>
    </AppShell>
  )
}

function renderEventShell(role?: EventRole, path = '/events/e1/guests') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <EventShell role={role} />
    </MemoryRouter>,
  )
}

function navLabels() {
  const nav = screen.getByRole('navigation', { name: 'Event navigation' })
  return within(nav)
    .getAllByRole('link')
    .map((link) => link.textContent)
}

describe('event navigation', () => {
  it('lists the event pages in the approved order', () => {
    renderEventShell('OWNER')

    expect(navLabels()).toEqual([
      'Dashboard',
      'Guests',
      'RSVP',
      'Messages',
      'Event Layout',
      'Event Settings',
      'Permissions',
    ])
  })

  it('shows Permissions to an Admin', () => {
    renderEventShell('ADMIN')

    expect(navLabels()).toContain('Permissions')
  })

  it('hides Permissions from a Viewer', () => {
    renderEventShell('VIEWER')

    expect(navLabels()).not.toContain('Permissions')
    expect(navLabels()).toHaveLength(6)
  })

  it('marks the current page', () => {
    renderEventShell('OWNER')

    expect(screen.getByRole('link', { name: 'Guests' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(screen.getByRole('link', { name: 'Dashboard' })).not.toHaveAttribute(
      'aria-current',
    )
  })

  it('keeps an entry marked on a page beneath it', () => {
    renderEventShell('OWNER', '/events/e1/guests/unknown')

    expect(screen.getByRole('link', { name: 'Guests' })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })

  it('links each entry to the current event', () => {
    renderEventShell('OWNER')

    expect(screen.getByRole('link', { name: 'RSVP' })).toHaveAttribute(
      'href',
      '/events/e1/rsvp',
    )
  })
})

describe('user role icon', () => {
  it.each([
    ['OWNER', 'Owner'],
    ['ADMIN', 'Admin'],
    ['VIEWER', 'Viewer'],
  ] as const)('describes the %s role beside the avatar', (role, label) => {
    renderEventShell(role)

    expect(
      screen.getByText(`Your role in this event: ${label}`),
    ).toBeInTheDocument()
  })

  it('shows no role outside an event', () => {
    render(
      <MemoryRouter>
        <AppShell
          navLabel="Main navigation"
          navItems={[{ to: '/', label: 'My Events', icon: CalendarDays }]}
          user={{ name: 'Alex Morgan' }}
        >
          <p>Home</p>
        </AppShell>
      </MemoryRouter>,
    )

    expect(screen.getByText('Alex Morgan')).toBeInTheDocument()
    expect(
      screen.queryByText(/Your role in this event/),
    ).not.toBeInTheDocument()
  })
})

describe('event selector', () => {
  it('names the current event and lists the others when opened', () => {
    renderEventShell('OWNER')
    const button = screen.getByRole('button', {
      name: 'Current event: Garden Celebration. Switch event',
    })
    expect(button).toHaveAttribute('aria-expanded', 'false')

    fireEvent.click(button)

    expect(button).toHaveAttribute('aria-expanded', 'true')
    const list = screen.getByRole('list', { name: 'Your events' })
    expect(
      within(list).getByRole('link', { name: 'Autumn Gala' }),
    ).toHaveAttribute('href', '/events/e2/dashboard')
    expect(
      within(list).queryByRole('link', { name: 'Garden Celebration' }),
    ).not.toBeInTheDocument()
  })

  it('closes with Escape', () => {
    renderEventShell('OWNER')
    const button = screen.getByRole('button', { name: /Switch event/ })
    fireEvent.click(button)

    fireEvent.keyDown(button, { key: 'Escape' })

    expect(button).toHaveAttribute('aria-expanded', 'false')
  })

  it('closes when clicking or focusing outside it', () => {
    renderEventShell('OWNER')
    const button = screen.getByRole('button', { name: /Switch event/ })

    fireEvent.click(button)
    fireEvent.pointerDown(screen.getByText('Page content'))
    expect(button).toHaveAttribute('aria-expanded', 'false')

    fireEvent.click(button)
    fireEvent.focusIn(screen.getByRole('link', { name: 'Guests' }))
    expect(button).toHaveAttribute('aria-expanded', 'false')
  })

  it('stays open when interacting inside it', () => {
    renderEventShell('OWNER')
    const button = screen.getByRole('button', { name: /Switch event/ })
    fireEvent.click(button)

    fireEvent.pointerDown(screen.getByRole('link', { name: 'Autumn Gala' }))

    expect(button).toHaveAttribute('aria-expanded', 'true')
  })

  it('is absent when there is no current event', () => {
    render(
      <MemoryRouter>
        <AppShell navLabel="Main navigation" navItems={[]}>
          <p>Home</p>
        </AppShell>
      </MemoryRouter>,
    )

    expect(
      screen.queryByRole('button', { name: /Switch event/ }),
    ).not.toBeInTheDocument()
  })
})

describe('shell chrome', () => {
  it('does not render a notification bell, Profile or account Settings', () => {
    renderEventShell('OWNER')

    expect(screen.queryByText(/notification/i)).not.toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: 'Profile' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: 'Settings' }),
    ).not.toBeInTheDocument()
  })

  it('switches the interface to Hebrew from the language selector', async () => {
    renderEventShell('OWNER')

    fireEvent.change(screen.getByRole('combobox', { name: 'Language' }), {
      target: { value: 'he' },
    })

    expect(
      await screen.findByRole('navigation', { name: 'ניווט באירוע' }),
    ).toBeInTheDocument()
    expect(document.documentElement).toHaveAttribute('dir', 'rtl')
  })

  it('opens the navigation in a drawer from the menu button and closes it on navigation', () => {
    setViewportWidth(400)
    renderEventShell('OWNER')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }))

    const drawer = screen.getByRole('dialog', { name: 'Menu' })
    expect(
      within(drawer).getByRole('link', { name: 'Dashboard' }),
    ).toBeInTheDocument()

    fireEvent.click(within(drawer).getByRole('link', { name: 'Dashboard' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('closes the drawer from its close button', () => {
    setViewportWidth(400)
    renderEventShell('OWNER')
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }))

    fireEvent.click(screen.getByRole('button', { name: 'Close menu' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('closes the drawer when the window widens to the desktop layout', () => {
    setViewportWidth(400)
    renderEventShell('OWNER')
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }))
    expect(screen.getByRole('dialog', { name: 'Menu' })).toBeInTheDocument()

    act(() => setViewportWidth(1024))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('keeps the user name in the page at every width', () => {
    setViewportWidth(400)
    renderEventShell('OWNER')

    expect(screen.getByText('Alex Morgan')).toBeInTheDocument()
  })

  it('marks back-style navigation icons for mirroring in right-to-left layouts', () => {
    render(
      <MemoryRouter>
        <AppShell
          navLabel="Event navigation"
          navItems={[]}
          footerLink={{
            to: '/',
            label: 'Back to My Events',
            icon: CalendarDays,
            directional: true,
            exact: true,
          }}
        >
          <p>Page</p>
        </AppShell>
      </MemoryRouter>,
    )

    const icon = screen
      .getByRole('link', { name: 'Back to My Events' })
      .querySelector('svg')
    expect(icon?.getAttribute('class')).toMatch(/directional/)
  })

  it('provides a skip link to the main content', () => {
    renderEventShell('OWNER')

    expect(
      screen.getByRole('link', { name: 'Skip to content' }),
    ).toHaveAttribute('href', '#main-content')
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main-content')
  })
})
