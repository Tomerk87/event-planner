import { fireEvent, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { changeLanguage } from '../../i18n/i18n.ts'
import { chooseOption, optionLabels } from '../../test/controls.ts'
import { setViewportWidth } from '../../test/matchMedia.ts'
import { createTestServices, renderApp } from '../../test/renderApp.tsx'

const withVenues = () => createTestServices({ venues: true })

async function openVenueEvents(path = '/venues/org-1/events') {
  const view = renderApp(path, withVenues())
  await screen.findByRole('list', { name: 'Events' })
  return view
}

function cards() {
  return within(screen.getByRole('list', { name: 'Events' })).getAllByRole(
    'article',
  )
}

function card(name: string) {
  const article = screen
    .getByRole('heading', { level: 2, name })
    .closest('article')
  if (!article) {
    throw new Error(`no card for ${name}`)
  }
  return within(article)
}

function switcher() {
  return screen.getByRole('button', { name: /^Workspace: / })
}

describe('the workspace switcher (mockup #1)', () => {
  it('is not shown while venues are off, and a venue address is not found', async () => {
    renderApp('/events')
    await screen.findByRole('list', { name: 'Events' })
    expect(screen.queryByRole('button', { name: /^Workspace: / })).toBeNull()

    renderApp('/venues/org-1/events')
    expect(
      await screen.findByRole('heading', { name: 'Page not found' }),
    ).toBeInTheDocument()
  })

  it('offers Personal and each venue with the user’s role', async () => {
    renderApp('/events', withVenues())
    await screen.findByRole('list', { name: 'Events' })

    expect(switcher()).toHaveAccessibleName(
      'Workspace: Personal. Switch workspace',
    )
    fireEvent.click(switcher())
    const links = screen
      .getAllByRole('link')
      .filter((link) => link.getAttribute('href')?.match(/^\/(events|venues)/))
      .map((link) => [link.textContent, link.getAttribute('href')])
    expect(links).toEqual(
      expect.arrayContaining([
        ['PersonalYour own events', '/events'],
        ['Grand Garden HallOwner', '/venues/org-1/events'],
        ['Seaside TerraceManager', '/venues/org-2/events'],
      ]),
    )
    expect(
      screen.getByRole('link', { name: /Personal/, current: true }),
    ).toBeInTheDocument()
  })

  it('opens a venue’s My Events and marks it as the current workspace', async () => {
    renderApp('/events', withVenues())
    await screen.findByRole('list', { name: 'Events' })
    fireEvent.click(switcher())
    fireEvent.click(screen.getByRole('link', { name: /Seaside Terrace/ }))

    expect(
      await screen.findByRole('heading', {
        level: 2,
        name: 'Ofir & Lior’s Wedding',
      }),
    ).toBeInTheDocument()
    expect(switcher()).toHaveAccessibleName(
      'Workspace: Seaside Terrace. Switch workspace',
    )
    expect(screen.getByText('Venue · Manager')).toBeInTheDocument()
  })
})

describe('a venue’s My Events (mockup #2)', () => {
  it('lists every event of the venue with its status (D115)', async () => {
    await openVenueEvents()

    expect(cards()).toHaveLength(7)
    expect(
      card('Dana & Yossi’s Wedding').getByText('Client joined'),
    ).toBeVisible()
    expect(card('Cohen Bar Mitzvah').getByText('Invitation sent')).toBeVisible()
    expect(
      card('Peretz Engagement Party').getByText('Invitation expired'),
    ).toBeVisible()
    expect(
      card('Noa & Amit’s Wedding').getAllByText('Awaiting client'),
    ).toHaveLength(2)
    expect(card('Shira & Ben’s Wedding').getByText('Past')).toBeVisible()
  })

  it('shows attendance once the client joined, and a note before', async () => {
    await openVenueEvents()

    expect(
      card('Dana & Yossi’s Wedding').getByRole('progressbar'),
    ).toBeInTheDocument()
    expect(
      card('Cohen Bar Mitzvah').getByText(
        /Guests appear once the client accepts/,
      ),
    ).toBeInTheDocument()
    expect(
      card('Peretz Engagement Party').getByText(/Resend it from the event’s/),
    ).toBeInTheDocument()
    expect(
      card('Noa & Amit’s Wedding').getByText(/No client invited yet/),
    ).toBeInTheDocument()
  })

  it('filters by Upcoming and Past with their counts', async () => {
    await openVenueEvents()

    expect(screen.getByRole('tab', { name: /^All Events\s*7$/ })).toBeVisible()
    fireEvent.click(screen.getByRole('tab', { name: /^Past\s*2$/ }))
    expect(cards()).toHaveLength(2)
    expect(
      card('Miriam’s 60th Birthday').getByRole('button'),
    ).toHaveTextContent('View Event')
  })

  it('filters by space and searches names and clients', async () => {
    await openVenueEvents()
    const space = screen.getByRole('combobox', { name: 'Space' })

    expect(optionLabels(space)).toEqual(['All spaces', 'Garden', 'Main Hall'])
    chooseOption(space, 'spc-1-2')
    expect(cards()).toHaveLength(4)

    chooseOption(space, 'all')
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search events' }), {
      target: { value: 'tal miz' },
    })
    expect(cards()).toHaveLength(1)
    expect(card('Brightline Year-End Party')).toBeTruthy()
  })

  it('keeps opening an event for its own phase (Phase 29)', async () => {
    await openVenueEvents()
    expect(
      card('Dana & Yossi’s Wedding').getByRole('button', {
        name: 'Open Event: Dana & Yossi’s Wedding',
      }),
    ).toBeDisabled()
  })

  it('is not found for a venue the user does not belong to', async () => {
    renderApp('/venues/org-404/events', withVenues())
    expect(
      await screen.findByRole('heading', { name: 'Page not found' }),
    ).toBeInTheDocument()
  })

  it('uses the list layout on a phone', async () => {
    setViewportWidth(390)
    await openVenueEvents()
    expect(
      screen.getByRole('button', { name: 'List view', pressed: true }),
    ).toBeInTheDocument()
  })

  it('is translated into Hebrew', async () => {
    await changeLanguage('he')
    renderApp('/venues/org-1/events', withVenues())
    expect(await screen.findAllByText('הלקוח הצטרף')).not.toHaveLength(0)
    expect(screen.getAllByText('ממתין ללקוח').length).toBeGreaterThan(0)
    await changeLanguage('en')
  })
})
