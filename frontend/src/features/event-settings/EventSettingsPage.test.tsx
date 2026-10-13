import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { changeLanguage } from '../../i18n/i18n.ts'
import type { Services } from '../../services/contracts/index.ts'
import {
  createTestServices,
  DEMO_EVENTS,
  renderApp,
} from '../../test/renderApp.tsx'
import { toDateAndTime } from '../events/eventForm.ts'
import { change } from '../../test/controls.ts'

const MAIN = DEMO_EVENTS.owner

async function openSettings(
  eventId: string = MAIN,
  services: Services = createTestServices(),
) {
  const view = renderApp(`/events/${eventId}/settings`, services)
  await screen.findByRole('heading', { name: 'General Information' })
  return view
}

function field(name: string): HTMLInputElement {
  return screen.getByLabelText(new RegExp(`^${name}`))
}

function type(name: string, value: string) {
  change(field(name), { target: { value } })
}

function save() {
  fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }))
}

async function savedEvent(services: Services, eventId: string = MAIN) {
  return (await services.events.get(eventId)).event
}

describe('Event Settings', () => {
  it('shows the saved event, with nothing to save until something changes', async () => {
    const { services } = await openSettings()
    const event = await savedEvent(services)
    const start = toDateAndTime(new Date(event.startsAt), event.timeZone)

    expect(field('Event Name')).toHaveValue('Maya & Daniel’s Wedding')
    expect(field('Location')).toHaveValue('Seaside Hall, Tel Aviv')
    expect(field('Maximum Attendees')).toHaveValue(300)
    expect(field('Event Date')).toHaveValue(start.date)
    expect(field('Event Time')).toHaveValue('18:30')
    expect(field('Timezone')).toHaveValue(event.timeZone)
    expect(field('Default Maximum Attendees per Guest')).toHaveValue(5)
    expect(screen.getByText('Upcoming')).toBeInTheDocument()
    expect(
      screen.getByText('RSVP remains open until the event start time.'),
    ).toBeInTheDocument()
    expect(screen.queryByLabelText(/RSVP language/i)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save Changes' })).toBeDisabled()

    type('Event Name', 'Changed')
    expect(screen.getByRole('button', { name: 'Save Changes' })).toBeEnabled()
    type('Event Name', 'Maya & Daniel’s Wedding')
    expect(screen.getByRole('button', { name: 'Save Changes' })).toBeDisabled()
  })

  it('shows the same capacity figures as the Dashboard', async () => {
    const { services } = await openSettings()
    const { metrics } = await services.dashboard.get(MAIN)

    const label = await screen.findByText('Seating Capacity')
    const card = label.closest('div')?.parentElement as HTMLElement
    expect(
      within(card).getByText(String(metrics.seatingCapacity)),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Confirmed Attendees').nextElementSibling,
    ).toHaveTextContent(String(metrics.confirmedAttendees))
    expect(
      screen.getByText('Unassigned Confirmed Attendees').nextElementSibling,
    ).toHaveTextContent(String(metrics.unassignedConfirmedAttendees))
  })

  it.each([
    ['Maximum Attendees', '49', 'Enter a whole number between 50 and 3000.'],
    ['Maximum Attendees', '3001', 'Enter a whole number between 50 and 3000.'],
    ['Maximum Attendees', '120.5', 'Enter a whole number between 50 and 3000.'],
    [
      'Default Maximum Attendees per Guest',
      '0',
      'Enter a whole number between 1 and 10.',
    ],
    [
      'Default Maximum Attendees per Guest',
      '11',
      'Enter a whole number between 1 and 10.',
    ],
    ['Event Name', '   ', 'Enter the event name.'],
    ['Event Date', '', 'Choose the date and time of the event.'],
    ['Event Date', '2020-01-01', 'Choose a date and time in the future.'],
  ])('refuses %s "%s" and saves nothing', async (name, value, message) => {
    const { services } = await openSettings()
    const before = await savedEvent(services)

    type(name, value)
    save()

    expect(await screen.findByText(message)).toBeInTheDocument()
    expect(field(name)).toHaveFocus()
    expect(await savedEvent(services)).toEqual(before)
  })

  it('saves valid changes and shows them across the event', async () => {
    const { services } = await openSettings()
    const before = await savedEvent(services)
    const { metrics } = await services.dashboard.get(MAIN)

    type('Event Name', 'Our Big Day')
    type('Location', '')
    type('Maximum Attendees', '3000')
    type('Default Maximum Attendees per Guest', '2')
    save()

    expect(await screen.findByText('Event settings saved.')).toBeInTheDocument()
    expect(await savedEvent(services)).toEqual({
      ...before,
      name: 'Our Big Day',
      location: null,
      maxAttendees: 3000,
      defaultAllowedAttendees: 2,
    })
    expect(screen.getByRole('button', { name: 'Save Changes' })).toBeDisabled()
    // The sidebar's event selector follows.
    expect(
      await screen.findByRole('button', { name: /Our Big Day/ }),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Seating capacity below event capacity'),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        new RegExp(`^${metrics.seatingCapacity} seats are configured`),
      ),
    ).toBeInTheDocument()
  })

  it('warns, without refusing, when the maximum is set below the confirmed count', async () => {
    const { services } = await openSettings()
    const { metrics } = await services.dashboard.get(MAIN)
    expect(metrics.confirmedAttendees).toBeGreaterThan(50)

    type('Maximum Attendees', '50')
    save()

    expect(await screen.findByText('Event over capacity')).toBeInTheDocument()
    expect((await savedEvent(services)).maxAttendees).toBe(50)
  })

  it('keeps the typed date and time when the time zone changes', async () => {
    const { services } = await openSettings()
    const before = await savedEvent(services)
    const start = toDateAndTime(new Date(before.startsAt), before.timeZone)

    change(field('Timezone'), {
      target: { value: 'America/New_York' },
    })
    save()

    await screen.findByText('Event settings saved.')
    const after = await savedEvent(services)
    expect(after.timeZone).toBe('America/New_York')
    expect(after.startsAt).not.toBe(before.startsAt)
    expect(toDateAndTime(new Date(after.startsAt), after.timeZone)).toEqual(
      start,
    )
    expect(field('Event Time')).toHaveValue('18:30')
  })

  it('reports a save that fails and keeps what was typed', async () => {
    await openSettings(
      MAIN,
      createTestServices({ failOperations: new Set(['events.update']) }),
    )

    type('Event Name', 'Not Saved')
    save()

    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(field('Event Name')).toHaveValue('Not Saved')
    expect(screen.getByRole('button', { name: 'Save Changes' })).toBeEnabled()
  })

  it.each([
    [DEMO_EVENTS.viewer, 'View-only access'],
    [DEMO_EVENTS.past, 'This event has ended'],
  ])('is read-only for %s', async (eventId, notice) => {
    await openSettings(eventId)

    expect(screen.getByText(notice)).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Save Changes' }),
    ).not.toBeInTheDocument()
    for (const name of [
      'Event Name',
      'Location',
      'Maximum Attendees',
      'Event Date',
      'Event Time',
      'Timezone',
      'Default Maximum Attendees per Guest',
    ]) {
      expect(field(name)).toBeDisabled()
    }
  })

  it('says RSVP is closed and the event is locked once it has started', async () => {
    await openSettings(DEMO_EVENTS.past)

    expect(screen.getByText('Past')).toBeInTheDocument()
    expect(screen.getByText('RSVP is closed.')).toBeInTheDocument()
    expect(screen.getByText(/and is locked/)).toBeInTheDocument()
  })

  it('opens the event rules', async () => {
    await openSettings()

    fireEvent.click(screen.getByRole('button', { name: 'View Event Rules' }))

    const dialog = await screen.findByRole('dialog', { name: 'Event Rules' })
    expect(within(dialog).getAllByRole('listitem')).toHaveLength(8)
    expect(
      within(dialog).getByText(
        'Maximum attendees is a whole number from 50 to 3000.',
      ),
    ).toBeInTheDocument()
  })

  it('leaves freely when nothing changed', async () => {
    const { router } = await openSettings()

    fireEvent.click(screen.getByRole('link', { name: 'Guests' }))

    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`/events/${MAIN}/guests`),
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('asks before leaving with unsaved changes', async () => {
    const { router } = await openSettings()
    type('Event Name', 'Half Done')

    fireEvent.click(screen.getByRole('link', { name: 'Guests' }))
    const dialog = await screen.findByRole('dialog', {
      name: 'Leave without saving?',
    })
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Keep Editing' }),
    )

    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    )
    expect(router.state.location.pathname).toBe(`/events/${MAIN}/settings`)
    expect(field('Event Name')).toHaveValue('Half Done')

    fireEvent.click(screen.getByRole('link', { name: 'Guests' }))
    fireEvent.click(
      within(
        await screen.findByRole('dialog', { name: 'Leave without saving?' }),
      ).getByRole('button', { name: 'Leave' }),
    )

    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`/events/${MAIN}/guests`),
    )
  })

  it('is translated to Hebrew', async () => {
    await openSettings()

    await changeLanguage('he')

    expect(
      await screen.findByRole('heading', { name: 'מידע כללי' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'שמירת שינויים' }),
    ).toBeInTheDocument()
    expect(screen.getByText(/הטווח המותר: בין 50 ל־3000/)).toBeInTheDocument()
    await changeLanguage('en')
  })
})
