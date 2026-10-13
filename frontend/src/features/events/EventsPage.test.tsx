import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { changeLanguage } from '../../i18n/i18n.ts'
import { setViewportWidth } from '../../test/matchMedia.ts'
import {
  createTestServices,
  DEMO_EVENTS,
  renderApp,
} from '../../test/renderApp.tsx'

const WEDDING = 'Maya & Daniel’s Wedding'

async function openEvents(path = '/events', services = createTestServices()) {
  const view = renderApp(path, services)
  await screen.findByRole('list', { name: 'Events' })
  return view
}

function tabName(label: string, count: number) {
  return new RegExp(`^${label}\\s*${count}$`)
}

function cards() {
  return within(
    screen.getByRole('list', { name: /^(Events|אירועים)$/ }),
  ).getAllByRole('article')
}

function card(name: string) {
  const heading = screen.getByRole('heading', { level: 2, name })
  const article = heading.closest('article')
  if (!article) {
    throw new Error(`no card for ${name}`)
  }
  return article
}

function names() {
  return cards().map(
    (article) => within(article).getByRole('heading', { level: 2 }).textContent,
  )
}

function openMenu(name: string) {
  fireEvent.click(
    within(card(name)).getByRole('button', { name: `Actions for ${name}` }),
  )
  return within(card(name)).getByRole('menu')
}

function fillEventForm(
  dialog: HTMLElement,
  values: { name?: string; date?: string; time?: string },
) {
  const fields = within(dialog)
  if (values.name !== undefined) {
    fireEvent.change(fields.getByLabelText(/Event Name/), {
      target: { value: values.name },
    })
  }
  if (values.date !== undefined) {
    fireEvent.change(fields.getByLabelText(/^Date/), {
      target: { value: values.date },
    })
  }
  if (values.time !== undefined) {
    fireEvent.change(fields.getByLabelText(/^Time \*/), {
      target: { value: values.time },
    })
  }
}

describe('My Events', () => {
  it('lists the demo events, upcoming soonest first and then past', async () => {
    await openEvents()

    expect(names()).toEqual([
      'חגיגת בר מצווה לאיתי',
      WEDDING,
      'Levi Family Birthday',
      'Product Launch Evening',
      'Spring Garden Party',
      'Annual Company Gala',
    ])
    expect(
      screen.getByRole('tab', { name: tabName('All Events', 6) }),
    ).toHaveAttribute('aria-selected', 'true')
    expect(
      screen.getByRole('tab', { name: tabName('Upcoming', 4) }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('tab', { name: tabName('Past', 2) }),
    ).toBeInTheDocument()
  })

  it('shows an upcoming event’s details, role, attendance and a way in', async () => {
    await openEvents()
    const wedding = within(card(WEDDING))

    expect(wedding.getByText('Upcoming')).toBeInTheDocument()
    expect(wedding.getByText('Dec 11, 2026')).toBeInTheDocument()
    expect(wedding.getByText('18:30')).toBeInTheDocument()
    expect(wedding.getByText('300 maximum attendees')).toBeInTheDocument()
    expect(wedding.getByText('Owner')).toBeInTheDocument()
    expect(wedding.getByText('300 capacity')).toBeInTheDocument()
    const progress = wedding.getByRole('progressbar', {
      name: `Confirmed attendees of ${WEDDING}`,
    })
    expect(progress).toHaveAttribute('aria-valuemax', '300')
    expect(
      wedding.getByText(`${progress.getAttribute('aria-valuenow')} confirmed`),
    ).toBeInTheDocument()
    expect(
      wedding.getByRole('link', { name: `Open Event: ${WEDDING}` }),
    ).toHaveAttribute('href', `/events/${DEMO_EVENTS.owner}/dashboard`)
  })

  it('offers a past event for viewing', async () => {
    await openEvents()
    const past = within(card('Spring Garden Party'))

    expect(past.getByText('Past')).toBeInTheDocument()
    expect(
      past.getByRole('link', { name: 'View Event: Spring Garden Party' }),
    ).toHaveAttribute('href', `/events/${DEMO_EVENTS.past}/dashboard`)
  })

  it('opens an event from its card, read-only when it is past', async () => {
    await openEvents()

    fireEvent.click(
      screen.getByRole('link', { name: 'View Event: Spring Garden Party' }),
    )

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Dashboard' }),
    ).toBeInTheDocument()
    expect(await screen.findByText('This event has ended')).toBeInTheDocument()
  })

  it('filters by upcoming and past, and keeps the filter in the address', async () => {
    const { router } = await openEvents()

    fireEvent.click(screen.getByRole('tab', { name: tabName('Past', 2) }))

    expect(names()).toEqual(['Spring Garden Party', 'Annual Company Gala'])
    expect(router.state.location.search).toBe('?show=past')

    fireEvent.click(screen.getByRole('tab', { name: tabName('Upcoming', 4) }))
    expect(names()).toHaveLength(4)

    fireEvent.click(screen.getByRole('tab', { name: tabName('All Events', 6) }))
    expect(router.state.location.search).toBe('')
  })

  it('starts from the filter, search and layout given in the address', async () => {
    await openEvents('/events?show=past&q=gala&view=list')

    expect(names()).toEqual(['Annual Company Gala'])
    expect(
      screen.getByRole('searchbox', { name: 'Search events' }),
    ).toHaveValue('gala')
    expect(screen.getByRole('button', { name: 'List view' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('searches by name, updating the counts, and can clear an empty result', async () => {
    await openEvents()
    const search = screen.getByRole('searchbox', { name: 'Search events' })

    fireEvent.change(search, { target: { value: 'LEVI' } })

    expect(names()).toEqual(['Levi Family Birthday'])
    expect(
      screen.getByRole('tab', { name: tabName('All Events', 1) }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('tab', { name: tabName('Past', 0) }),
    ).toBeInTheDocument()

    fireEvent.change(search, { target: { value: 'no such event' } })

    expect(screen.getByText('No events match')).toBeInTheDocument()
    fireEvent.click(
      screen.getByRole('button', { name: 'Clear search and filter' }),
    )
    expect(names()).toHaveLength(6)
  })

  it('switches between the grid and the list layout', async () => {
    await openEvents()
    expect(screen.getByRole('button', { name: 'Grid view' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )

    fireEvent.click(screen.getByRole('button', { name: 'List view' }))

    expect(screen.getByRole('button', { name: 'List view' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(
      within(card(WEDDING)).getByRole('link', { name: WEDDING }),
    ).toHaveAttribute('href', `/events/${DEMO_EVENTS.owner}/dashboard`)
    expect(
      screen.queryByRole('link', { name: `Open Event: ${WEDDING}` }),
    ).not.toBeInTheDocument()
  })

  it('uses the list layout and a search button on a phone', async () => {
    setViewportWidth(390)
    await openEvents()

    expect(screen.getByRole('button', { name: 'List view' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument()
    const toggle = screen.getByRole('button', { name: 'Search events' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')

    fireEvent.click(toggle)

    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search events' }), {
      target: { value: 'gala' },
    })
    expect(names()).toEqual(['Annual Company Gala'])
    expect(
      screen.getByRole('button', { name: 'Create Event' }),
    ).toBeInTheDocument()
  })

  it('offers duplicate and delete to an Owner only', async () => {
    await openEvents()
    const items = (menu: HTMLElement) =>
      within(menu)
        .getAllByRole('menuitem')
        .map((item) => item.textContent)

    expect(items(openMenu(WEDDING))).toEqual([
      'Open Event',
      'Duplicate',
      'Delete',
    ])
    fireEvent.keyDown(card(WEDDING).querySelector('[role="menu"]')!, {
      key: 'Escape',
    })
    expect(items(openMenu('Levi Family Birthday'))).toEqual(['Open Event'])
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' })
    expect(items(openMenu('Product Launch Evening'))).toEqual(['Open Event'])
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' })
    expect(items(openMenu('Spring Garden Party'))).toEqual([
      'View Event',
      'Duplicate',
      'Delete',
    ])
  })

  it('offers duplicate and delete everywhere to a simulated Super User, and nowhere to a Viewer', async () => {
    const services = createTestServices()
    await services.demo?.setRole('SUPER_USER')
    await openEvents('/events', services)

    expect(
      within(openMenu('Product Launch Evening')).getByRole('menuitem', {
        name: 'Delete',
      }),
    ).toBeInTheDocument()

    fireEvent.change(screen.getByRole('combobox', { name: 'Simulated role' }), {
      target: { value: 'VIEWER' },
    })
    await waitFor(() =>
      expect(within(card(WEDDING)).getByText('Viewer')).toBeInTheDocument(),
    )
    expect(
      within(openMenu(WEDDING)).queryByRole('menuitem', { name: 'Delete' }),
    ).not.toBeInTheDocument()
  })

  it('creates an event, which appears in the list', async () => {
    const { services } = await openEvents()
    fireEvent.click(screen.getByRole('button', { name: 'Create Event' }))
    const dialog = screen.getByRole('dialog', { name: 'Create event' })

    expect(within(dialog).getByLabelText(/Maximum Attendees/)).toHaveValue(300)
    expect(
      within(dialog).getByLabelText(/Expected Attendees per Guest/),
    ).toHaveValue(5)

    fillEventForm(dialog, {
      name: 'New Year Dinner',
      date: '2031-01-01',
      time: '20:00',
    })
    fireEvent.change(within(dialog).getByLabelText(/Time Zone/), {
      target: { value: 'Asia/Jerusalem' },
    })
    fireEvent.change(within(dialog).getByLabelText(/Maximum Attendees/), {
      target: { value: '80' },
    })
    fireEvent.change(within(dialog).getByLabelText(/RSVP Language/), {
      target: { value: 'he' },
    })
    fireEvent.change(within(dialog).getByLabelText('Location'), {
      target: { value: 'The Old Mill' },
    })
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Create Event' }),
    )

    expect(
      await screen.findByText('The event was created.'),
    ).toBeInTheDocument()
    await waitFor(() => expect(names()).toContain('New Year Dinner'))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    const created = within(card('New Year Dinner'))
    expect(created.getByText('Jan 1, 2031')).toBeInTheDocument()
    expect(created.getByText('20:00')).toBeInTheDocument()
    expect(created.getByText('80 maximum attendees')).toBeInTheDocument()
    expect(created.getByText('Owner')).toBeInTheDocument()
    expect(created.getByText('0 confirmed')).toBeInTheDocument()
    const stored = (await services.events.list()).find(
      (item) => item.event.name === 'New Year Dinner',
    )
    expect(stored?.event).toMatchObject({
      startsAt: '2031-01-01T18:00:00.000Z',
      rsvpLanguage: 'he',
      location: 'The Old Mill',
      defaultAllowedAttendees: 5,
    })
    expect(
      screen.getByRole('tab', { name: tabName('All Events', 7) }),
    ).toBeInTheDocument()
  })

  it('explains every invalid field before creating', async () => {
    const { services } = await openEvents()
    fireEvent.click(screen.getByRole('button', { name: 'Create Event' }))
    const dialog = screen.getByRole('dialog', { name: 'Create event' })
    const fields = within(dialog)

    fireEvent.change(fields.getByLabelText(/Maximum Attendees/), {
      target: { value: '49' },
    })
    fireEvent.change(fields.getByLabelText(/Expected Attendees per Guest/), {
      target: { value: '2.5' },
    })
    fireEvent.click(fields.getByRole('button', { name: 'Create Event' }))

    expect(fields.getByText('Enter the event name.')).toBeInTheDocument()
    expect(
      fields.getByText('Choose the date and time of the event.'),
    ).toBeInTheDocument()
    expect(
      fields.getByText('Enter a whole number between 50 and 3000.'),
    ).toBeInTheDocument()
    expect(
      fields.getByText('Enter a whole number between 1 and 10.'),
    ).toBeInTheDocument()
    expect(fields.getByLabelText(/Event Name/)).toHaveAttribute(
      'aria-invalid',
      'true',
    )
    expect(fields.getByLabelText(/^Date/)).toHaveAttribute(
      'aria-invalid',
      'true',
    )

    fillEventForm(dialog, { name: 'Late', date: '2020-01-01', time: '10:00' })
    fireEvent.click(fields.getByRole('button', { name: 'Create Event' }))

    expect(
      fields.getByText('Choose a date and time in the future.'),
    ).toBeInTheDocument()
    expect(await services.events.list()).toHaveLength(6)
  })

  it('shows why creating failed and keeps the form open', async () => {
    await openEvents(
      '/events',
      createTestServices({ failOperations: new Set(['events.create']) }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Create Event' }))
    const dialog = screen.getByRole('dialog', { name: 'Create event' })

    fillEventForm(dialog, { name: 'Dinner', date: '2031-01-01', time: '20:00' })
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Create Event' }),
    )

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'The service is not available right now. Please try again.',
    )
    expect(within(dialog).getByLabelText(/Event Name/)).toHaveValue('Dinner')
  })

  it('starts each new form empty and can be cancelled', async () => {
    await openEvents()
    fireEvent.click(screen.getByRole('button', { name: 'Create Event' }))
    fillEventForm(screen.getByRole('dialog'), { name: 'Draft' })

    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Cancel',
      }),
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Create Event' }))
    expect(
      within(screen.getByRole('dialog')).getByLabelText(/Event Name/),
    ).toHaveValue('')
  })

  it('duplicates an event under a new name and date', async () => {
    const { services } = await openEvents()
    fireEvent.click(
      within(openMenu(WEDDING)).getByRole('menuitem', { name: 'Duplicate' }),
    )
    const dialog = screen.getByRole('dialog', { name: 'Duplicate event' })

    expect(within(dialog).getByText('What is copied')).toBeInTheDocument()
    expect(within(dialog).getByLabelText(/Event Name/)).toHaveValue(
      `Copy of ${WEDDING}`,
    )
    expect(
      within(dialog).getByText(/Time zone: Asia\/Jerusalem/),
    ).toBeInTheDocument()
    expect(
      within(dialog).queryByLabelText(/Maximum Attendees/),
    ).not.toBeInTheDocument()

    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Duplicate Event' }),
    )
    expect(
      within(dialog).getByText('Choose the date and time of the event.'),
    ).toBeInTheDocument()

    fillEventForm(dialog, {
      name: 'Anniversary Party',
      date: '2031-06-01',
      time: '19:00',
    })
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Duplicate Event' }),
    )

    expect(
      await screen.findByText('The event was duplicated.'),
    ).toBeInTheDocument()
    await waitFor(() => expect(names()).toContain('Anniversary Party'))
    const copy = (await services.events.list()).find(
      (item) => item.event.name === 'Anniversary Party',
    )
    expect(copy).toMatchObject({ role: 'OWNER', confirmedAttendees: 0 })
    expect(copy?.event.maxAttendees).toBe(300)
    expect(await services.tables.list(copy?.event.id ?? '')).toHaveLength(18)
    expect(names()).toContain(WEDDING)
  })

  it('deletes an event only after its name is typed', async () => {
    const { services } = await openEvents()
    fireEvent.click(
      within(openMenu('Spring Garden Party')).getByRole('menuitem', {
        name: 'Delete',
      }),
    )
    const dialog = screen.getByRole('dialog', { name: 'Delete event' })
    const confirm = within(dialog).getByRole('button', { name: 'Delete Event' })

    expect(
      within(dialog).getByText('Delete “Spring Garden Party” permanently?'),
    ).toBeInTheDocument()
    expect(confirm).toBeDisabled()

    fireEvent.change(within(dialog).getByLabelText('Event Name'), {
      target: { value: 'Spring Garden' },
    })
    expect(confirm).toBeDisabled()
    fireEvent.submit(within(dialog).getByLabelText('Event Name'))
    expect(await services.events.list()).toHaveLength(6)

    fireEvent.change(within(dialog).getByLabelText('Event Name'), {
      target: { value: ' Spring Garden Party ' },
    })
    fireEvent.click(confirm)

    expect(
      await screen.findByText('The event was deleted.'),
    ).toBeInTheDocument()
    await waitFor(() => expect(names()).not.toContain('Spring Garden Party'))
    expect(
      screen.getByRole('tab', { name: tabName('Past', 1) }),
    ).toBeInTheDocument()
    expect(await services.events.list()).toHaveLength(5)
  })

  it('shows why deleting failed', async () => {
    await openEvents(
      '/events',
      createTestServices({ failOperations: new Set(['events.remove']) }),
    )
    fireEvent.click(
      within(openMenu(WEDDING)).getByRole('menuitem', { name: 'Delete' }),
    )
    const dialog = screen.getByRole('dialog', { name: 'Delete event' })
    fireEvent.change(within(dialog).getByLabelText('Event Name'), {
      target: { value: WEDDING },
    })
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Delete Event' }),
    )

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'The service is not available right now. Please try again.',
    )
    expect(names()).toContain(WEDDING)
  })

  it('shows a loading state, then the events', async () => {
    renderApp('/events', createTestServices({ delayMs: 30 }))

    expect(await screen.findByRole('status')).toHaveTextContent('Loading…')
    expect(
      screen.getByRole('heading', { level: 1, name: 'My Events' }),
    ).toBeInTheDocument()
    expect(await screen.findByRole('list', { name: 'Events' })).toBeVisible()
  })

  it('shows an error that can be retried', async () => {
    renderApp(
      '/events',
      createTestServices({ failOperations: new Set(['events.list']) }),
    )

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(
      'The service is not available right now. Please try again.',
    )
    fireEvent.click(within(alert).getByRole('button', { name: 'Try again' }))
    expect(await screen.findByRole('alert')).toBeInTheDocument()
  })

  it('is fully translated, with dates in the interface language', async () => {
    await changeLanguage('he')
    renderApp('/events')
    await screen.findByRole('list', { name: 'אירועים' })

    expect(
      screen.getByRole('heading', { level: 1, name: 'האירועים שלי' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('tab', { name: tabName('שהסתיימו', 2) }),
    ).toBeInTheDocument()
    const wedding = within(card(WEDDING))
    expect(wedding.getByText('קרוב')).toBeInTheDocument()
    expect(wedding.getByText('עד 300 משתתפים')).toBeInTheDocument()
    expect(wedding.getByText('11 בדצמ׳ 2026')).toBeInTheDocument()
    expect(
      wedding.getByRole('link', { name: `פתיחת האירוע: ${WEDDING}` }),
    ).toBeInTheDocument()
  })
})
