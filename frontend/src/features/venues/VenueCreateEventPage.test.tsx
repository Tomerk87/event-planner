import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import {
  createTestServices,
  renderApp,
  TEST_NOW,
} from '../../test/renderApp.tsx'

const withVenues = () => createTestServices({ venues: true })
const WIZARD = '/venues/org-1/events/new'

/** A date well ahead of the demo's clock, as the date field types it. */
function futureDate(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10)
}

async function toDetails(path = WIZARD) {
  renderApp(path, withVenues())
  fireEvent.click(await screen.findByRole('button', { name: /Main Hall/ }))
  fireEvent.click(screen.getByRole('button', { name: 'Next' }))
  fireEvent.click(await screen.findByRole('button', { name: /Wedding Rounds/ }))
  fireEvent.click(screen.getByRole('button', { name: 'Next' }))
  return screen.findByRole('textbox', { name: /Event Name/ })
}

function fillDetails(name: string, date: string, time = '19:00') {
  fireEvent.change(screen.getByRole('textbox', { name: /Event Name/ }), {
    target: { value: name },
  })
  fireEvent.change(screen.getByLabelText(/^Date/), { target: { value: date } })
  fireEvent.change(screen.getByLabelText(/^Start Time/), {
    target: { value: time },
  })
}

describe('creating a venue event (Phase 27, mockup #9)', () => {
  it('opens from My Events for the venue', async () => {
    renderApp('/venues/org-1/events', withVenues())
    fireEvent.click(await screen.findByRole('link', { name: 'Create Event' }))
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Create Event' }),
    ).toBeVisible()
    expect(screen.getByRole('list', { name: 'Steps' })).toBeVisible()
  })

  it('needs a choice before moving on, and skips spaces with no layouts', async () => {
    renderApp(WIZARD, withVenues())
    const rooftop = await screen.findByRole('button', {
      name: /Rooftop Lounge/,
    })
    expect(rooftop).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: /Main Hall/ }))
    expect(screen.getByRole('button', { name: /Main Hall/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled()
  })

  it('lists only the space’s active layouts', async () => {
    renderApp(WIZARD, withVenues())
    fireEvent.click(await screen.findByRole('button', { name: /Main Hall/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(
      await screen.findByRole('button', { name: /Wedding Rounds/ }),
    ).toBeVisible()
    expect(screen.queryByRole('button', { name: /Classic Rounds/ })).toBeNull()
  })

  it('checks the name, date and time before the review', async () => {
    await toDetails()
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(
      await screen.findByText('Enter a name of up to 120 characters'),
    ).toBeVisible()

    fillDetails('Past Party', '2020-01-01')
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(
      await screen.findByText('Choose a date and time that haven’t passed'),
    ).toBeVisible()
  })

  it('warns about another event that day in the space', async () => {
    await toDetails()
    // Dana & Yossi's Wedding is in Main Hall 20 days after the demo's clock.
    const sameDay = new Date(TEST_NOW.getTime() + 20 * 86_400_000)
    fillDetails('Maya & Daniel’s Wedding', sameDay.toISOString().slice(0, 10))
    expect(await screen.findByText('Same-day booking')).toBeVisible()
    expect(screen.getByText(/already has Dana & Yossi/)).toBeVisible()
  })

  it('creates the event, invites the client, and lists it', async () => {
    await toDetails()
    fillDetails('Maya & Daniel’s Wedding', futureDate(60))
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    await screen.findByRole('heading', { name: 'Review and Create' })
    expect(screen.queryByText('Same-day booking')).toBeNull()

    const email = screen.getByRole('textbox', { name: /Client Email/ })
    fireEvent.change(email, { target: { value: 'not an email' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create Event' }))
    expect(
      await screen.findByText('Enter an email address, or leave it empty'),
    ).toBeVisible()

    fireEvent.change(email, { target: { value: 'maya.cohen@example.com' } })
    expect(
      screen.getByText(/An invitation will be emailed to the client/),
    ).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Create Event' }))
    expect(await screen.findByText('Event created')).toBeVisible()
    expect(
      screen.getByText(/An invitation is waiting for maya.cohen@example.com/),
    ).toBeVisible()

    fireEvent.click(screen.getByRole('link', { name: 'Back to My Events' }))
    const card = await screen.findByRole('heading', {
      level: 2,
      name: 'Maya & Daniel’s Wedding',
    })
    expect(
      within(card.closest('li')!).getByText('Invitation sent'),
    ).toBeVisible()
  })

  it('goes back to a step from the review to change it', async () => {
    await toDetails()
    fillDetails('Edit Me', futureDate(60))
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    await screen.findByRole('heading', { name: 'Review and Create' })
    fireEvent.click(screen.getByRole('button', { name: 'Edit: Event Name' }))
    expect(screen.getByRole('textbox', { name: /Event Name/ })).toHaveValue(
      'Edit Me',
    )
  })

  it('starts at the details when opened from a layout card', async () => {
    renderApp('/venues/org-1/spaces/spc-1-1', withVenues())
    fireEvent.click(
      await screen.findByRole('link', {
        name: 'Create Event from This Layout: Wedding Rounds',
      }),
    )
    expect(
      await screen.findByRole('textbox', { name: /Event Name/ }),
    ).toBeVisible()
    expect(screen.getByText(/Main Hall · Wedding Rounds/)).toBeVisible()
  })

  it('is not found for a venue the person isn’t in', async () => {
    renderApp('/venues/org-9/events/new', withVenues())
    await waitFor(() =>
      expect(
        screen.getAllByRole('heading', { name: 'Page not found' }),
      ).not.toHaveLength(0),
    )
  })
})
