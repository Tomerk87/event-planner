import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { Services } from '../../services/contracts/index.ts'
import { change } from '../../test/controls.ts'
import {
  createTestServices,
  DEMO_EVENTS,
  renderApp,
} from '../../test/renderApp.tsx'

const MAIN = DEMO_EVENTS.owner

async function openPublic(
  eventId: string = MAIN,
  services: Services = createTestServices(),
  session: 'demo' | 'none' = 'none',
) {
  const { event } = await services.events.get(eventId)
  const view = renderApp(`/rsvp/${event.rsvpSlug}`, services, { session })
  await screen.findByRole('heading', { level: 1 })
  return { ...view, event }
}

function fill(name: string, phone: string, attendees: string | null) {
  change(screen.getByRole('textbox', { name: 'Full Name' }), {
    target: { value: name },
  })
  change(screen.getByRole('textbox', { name: 'Phone Number' }), {
    target: { value: phone },
  })
  if (attendees !== null) {
    change(screen.getByRole('combobox', { name: 'Number of Attendees' }), {
      target: { value: attendees },
    })
  }
}

const press = (name: string) =>
  fireEvent.click(screen.getByRole('button', { name }))

describe('Public RSVP page', () => {
  it('shows the event and the organizer’s welcome, with no application frame', async () => {
    const { event, services } = await openPublic()
    const settings = await services.rsvp.getSettings(MAIN)

    expect(
      screen.getByRole('heading', { level: 1, name: event.rsvpTitle ?? '' }),
    ).toBeInTheDocument()
    expect(screen.getByText(settings.welcomeMessage)).toBeInTheDocument()
    expect(screen.getByText(event.location ?? '')).toBeInTheDocument()
    // The location opens in the guest's maps, in a new tab.
    const query = encodeURIComponent(event.location ?? '')
    expect(
      screen.getByRole('link', { name: 'Open in Google Maps' }),
    ).toHaveAttribute(
      'href',
      `https://www.google.com/maps/search/?api=1&query=${query}`,
    )
    expect(
      screen.getByRole('link', { name: 'Navigate with Waze' }),
    ).toHaveAttribute('target', '_blank')
    expect(
      screen.getByText(
        'From outside Israel, start with + and your country code.',
      ),
    ).toBeInTheDocument()
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
    expect(document.title).toBe(`${event.rsvpTitle} · Event Planner`)
  })

  it('asks for every field before a response is sent', async () => {
    const { services } = await openPublic()
    const before = await services.unknownGuests.list(MAIN)

    press("I won't be able to attend")

    expect(screen.getByText('Enter your name.')).toBeInTheDocument()
    expect(screen.getByText('Enter a valid phone number.')).toBeInTheDocument()
    expect(
      screen.getByText('Choose the number of attendees.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Full Name' })).toHaveFocus()
    expect(await services.unknownGuests.list(MAIN)).toEqual(before)
  })

  it('records a known guest’s approval, shows the approved message, and lets them change it', async () => {
    const { services } = await openPublic()
    const guest = (await services.guests.list(MAIN)).find(
      (candidate) => candidate.allowedAttendees >= 2,
    )!
    const settings = await services.rsvp.getSettings(MAIN)

    fill('The Guests', guest.phone, '2')
    press("I'll be there!")

    expect(await screen.findByRole('status')).toHaveTextContent(
      settings.approvedMessage,
    )
    expect(screen.getByText('Attendees confirmed: 2')).toBeInTheDocument()
    const saved = (await services.guests.list(MAIN)).find(
      (candidate) => candidate.id === guest.id,
    )
    expect(saved).toMatchObject({
      rsvpStatus: 'APPROVED',
      confirmedAttendees: 2,
      invitationName: 'The Guests',
      firstName: guest.firstName,
    })

    press('Change My Response')
    expect(screen.getByRole('textbox', { name: 'Full Name' })).toHaveValue(
      'The Guests',
    )
    press('Not sure yet')
    expect(await screen.findByRole('status')).toHaveTextContent(
      settings.notSureMessage,
    )
    expect(
      (await services.guests.list(MAIN)).find(
        (candidate) => candidate.id === guest.id,
      ),
    ).toMatchObject({ rsvpStatus: 'NOT_SURE', confirmedAttendees: null })
  })

  it('refuses more attendees than the invitation allows, and a phone it cannot read', async () => {
    const { services } = await openPublic()
    const guest = (await services.guests.list(MAIN)).find(
      (candidate) => candidate.allowedAttendees < 10,
    )!

    fill('Too Many', guest.phone, '10')
    press("I'll be there!")
    expect(
      await screen.findByText(
        `Your invitation is for up to ${guest.allowedAttendees} attendees. To bring more, please contact the organizer.`,
      ),
    ).toBeInTheDocument()

    fill('Too Many', '12', '1')
    press("I'll be there!")
    expect(
      await screen.findByText('Enter a valid phone number.'),
    ).toBeInTheDocument()
  })

  it('keeps a response from an unknown phone for the organizer to review', async () => {
    const { services } = await openPublic()

    fill('Stranger Danger', '050-000-9999', '1')
    press("I won't be able to attend")

    await screen.findByRole('status')
    expect(await services.unknownGuests.list(MAIN)).toContainEqual(
      expect.objectContaining({
        name: 'Stranger Danger',
        rsvpStatus: 'DECLINED',
        confirmedAttendees: 0,
      }),
    )
  })

  it('offers the calendar and YouTube links after approval when they are switched on', async () => {
    const services = createTestServices()
    const { eventId: _eventId, ...settings } =
      await services.rsvp.getSettings(MAIN)
    await services.rsvp.updateSettings(MAIN, {
      ...settings,
      approvedMessage: '',
      calendar: { ...settings.calendar, enabled: true },
      youtube: { enabled: true, url: 'https://youtu.be/abc' },
    })
    await openPublic(MAIN, services)

    const promised = screen.getByRole('list')
    expect(within(promised).getByText('Add to Calendar')).toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: 'Add to Calendar' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: 'Watch on YouTube' }),
    ).not.toBeInTheDocument()

    fill('Link Lover', '050-000-9998', '1')
    press("I'll be there!")

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Thank you for confirming! We look forward to seeing you.',
    )
    const calendar = screen.getByRole('link', { name: 'Add to Calendar' })
    expect(calendar.getAttribute('href')).toContain(
      'https://calendar.google.com/calendar/render?action=TEMPLATE',
    )
    expect(calendar).toHaveAttribute('target', '_blank')
    expect(calendar).toHaveAttribute('rel', 'noopener noreferrer')
    expect(
      screen.getByRole('link', { name: 'Watch on YouTube' }),
    ).toHaveAttribute('href', 'https://youtu.be/abc')
  })

  it('opens in the event’s language and lets the guest switch', async () => {
    await openPublic(DEMO_EVENTS.hebrew)

    expect(screen.getByRole('button', { name: 'אגיע!' })).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'אגיע!' }).closest('[dir]'),
    ).toHaveAttribute('dir', 'rtl')

    press('English')

    expect(
      screen.getByRole('button', { name: "I'll be there!" }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'עברית' })).toBeInTheDocument()
  })

  it('is closed once the event has started', async () => {
    await openPublic(DEMO_EVENTS.past)

    expect(screen.getByText('RSVP is closed')).toBeInTheDocument()
    expect(
      screen.getByText(
        'The event has started, so responses can no longer be sent or changed.',
      ),
    ).toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: "I'll be there!" }),
    ).not.toBeInTheDocument()
  })

  it('says so when the link leads nowhere, or the page cannot be loaded', async () => {
    const first = renderApp('/rsvp/no-such-link', createTestServices(), {
      session: 'none',
    })
    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'This RSVP page is not available',
      }),
    ).toBeInTheDocument()
    expect(
      screen.queryByText(/opens only in the browser/),
    ).not.toBeInTheDocument()
    first.unmount()

    const services = createTestServices({
      failOperations: new Set(['rsvp.getPublicEvent']),
    })
    renderApp('/rsvp/anything', services, { session: 'none' })
    expect(
      await screen.findByRole('button', { name: 'Try again' }),
    ).toBeInTheDocument()
  })

  it('tells the guest when the response could not be sent', async () => {
    const services = createTestServices({
      failOperations: new Set(['rsvp.submit']),
    })
    await openPublic(MAIN, services)

    fill('Unlucky', '050-000-9997', '1')
    press('Not sure yet')

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Your response could not be sent. Please try again.',
    )
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Not sure yet' }),
      ).toBeEnabled(),
    )
  })
})
