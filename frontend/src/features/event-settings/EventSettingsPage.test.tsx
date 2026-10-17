import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
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
  // The label may end with the required mark.
  return screen.getByLabelText(new RegExp(`^${name}( \\*)?$`))
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

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

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
    expect(field('Timezone')).toHaveValue('Asia/Jerusalem · Israel')
    expect(field('Maximum Attendees per Guest')).toHaveValue(5)
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
    [
      'Maximum Attendees per Guest',
      '0',
      'Enter a whole number between 1 and 10.',
    ],
    [
      'Maximum Attendees per Guest',
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
    type('Maximum Attendees per Guest', '2')
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
    expect(screen.getByText('Not enough seats')).toBeInTheDocument()
    expect(
      screen.getByText(
        `${metrics.confirmedAttendees} confirmed attendees and ${metrics.seatingCapacity} seats: ${metrics.confirmedAttendees - metrics.seatingCapacity} more seats are needed.`,
      ),
    ).toBeInTheDocument()
  })

  it.each(['49', 'below', '3001', '120.5'])(
    'refuses Maximum Attendees "%s", never below the attendees already confirmed',
    async (value) => {
      const { services } = await openSettings()
      const before = await savedEvent(services)
      const confirmed = (await services.dashboard.get(MAIN)).metrics
        .confirmedAttendees
      expect(confirmed).toBeGreaterThan(50)
      expect(
        await screen.findByText(
          `Between ${confirmed} and 3000: ${confirmed} attendees have already confirmed.`,
        ),
      ).toBeInTheDocument()

      type(
        'Maximum Attendees',
        value === 'below' ? String(confirmed - 1) : value,
      )
      save()

      expect(
        await screen.findByText(
          `Enter a whole number between ${confirmed} and 3000.`,
        ),
      ).toBeInTheDocument()
      expect(await savedEvent(services)).toEqual(before)
    },
  )

  it('changes the country by which local phone numbers are read (D103)', async () => {
    const { services } = await openSettings()

    expect(field('Phone Number Country')).toHaveValue('IL')
    type('Phone Number Country', 'BR')
    save()

    expect(await screen.findByText('Event settings saved.')).toBeInTheDocument()
    expect((await savedEvent(services)).country).toBe('BR')
  })

  it('brings a maximum typed outside its range back within it when the field is left', async () => {
    const { services } = await openSettings()
    const confirmed = (await services.dashboard.get(MAIN)).metrics
      .confirmedAttendees
    await screen.findByText(/attendees have already confirmed/)

    type('Maximum Attendees', '10')
    fireEvent.blur(field('Maximum Attendees'))
    expect(field('Maximum Attendees')).toHaveValue(confirmed)

    type('Maximum Attendees', '5000')
    fireEvent.blur(field('Maximum Attendees'))
    expect(field('Maximum Attendees')).toHaveValue(3000)
  })

  it('adds an event photo, shown in the event selector, and removes it again', async () => {
    const { services } = await openSettings()
    const photo = 'data:image/jpeg;base64,BBBB'
    vi.stubGlobal('createImageBitmap', () =>
      Promise.resolve({ width: 3000, height: 2000, close: () => undefined }),
    )
    const drawImage = vi.fn()
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage,
    } as unknown as CanvasRenderingContext2D)
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(photo)

    fireEvent.change(screen.getByTestId('cover-file'), {
      target: {
        files: [new File(['x'], 'photo.jpg', { type: 'image/jpeg' })],
      },
    })

    expect(
      await screen.findByRole('button', { name: 'Change Photo' }),
    ).toBeInTheDocument()
    expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 1200, 800)
    save()
    await screen.findByText('Event settings saved.')
    expect((await savedEvent(services)).coverImage).toBe(photo)
    await waitFor(() =>
      expect(
        screen
          .getByRole('button', { name: /Current event:/ })
          .querySelector('img'),
      ).toHaveAttribute('src', photo),
    )

    fireEvent.click(screen.getByRole('button', { name: 'Remove Photo' }))
    save()
    await screen.findByRole('button', { name: 'Upload Photo' })
    await waitFor(async () =>
      expect((await savedEvent(services)).coverImage).toBeNull(),
    )
  })

  it('refuses a file that is not a JPG or PNG picture', async () => {
    await openSettings()

    fireEvent.change(screen.getByTestId('cover-file'), {
      target: { files: [new File(['x'], 'photo.gif', { type: 'image/gif' })] },
    })

    expect(
      await screen.findByText('Choose a JPG or PNG image.'),
    ).toBeInTheDocument()
  })

  it('finds a time zone by typing part of its name, or its country in any language (D104)', async () => {
    await openSettings()
    const zone = field('Timezone')
    const shown = () =>
      screen.getAllByRole('option').map((option) => option.textContent)

    fireEvent.click(zone)
    fireEvent.change(zone, { target: { value: 'jerus' } })
    expect(shown()).toEqual(['Asia/Jerusalem · Israel'])

    fireEvent.change(zone, { target: { value: 'new york' } })
    expect(shown()).toEqual(['America/New York · United States'])

    fireEvent.change(zone, { target: { value: 'sao paulo' } })
    expect(shown()).toEqual(['America/Sao Paulo · Brazil'])

    fireEvent.change(zone, { target: { value: 'brazil' } })
    expect(shown()).toContain('America/Sao Paulo · Brazil')
    expect(shown().every((option) => option?.endsWith('· Brazil'))).toBe(true)

    fireEvent.change(zone, { target: { value: 'no such place' } })
    expect(screen.getByText('No time zone matches')).toBeInTheDocument()
  })

  it('finds a time zone by its country’s name in Portuguese and Hebrew too', async () => {
    await openSettings()
    await changeLanguage('pt')
    const zone = await screen.findByLabelText(/^Fuso horário/)

    fireEvent.click(zone)
    fireEvent.change(zone, { target: { value: 'Brasil' } })
    expect(
      screen.getAllByRole('option').map((option) => option.textContent),
    ).toContain('America/Sao Paulo · Brasil')

    await changeLanguage('he')
    fireEvent.change(await screen.findByLabelText(/^אזור זמן/), {
      target: { value: 'ברזיל' },
    })
    expect(
      screen.getAllByRole('option').map((option) => option.textContent),
    ).toContain('America/Sao Paulo · ברזיל')
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
      'Maximum Attendees per Guest',
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
    expect(screen.getByText(/משתתפים כבר אישרו הגעה/)).toBeInTheDocument()
    await changeLanguage('en')
  })
})
