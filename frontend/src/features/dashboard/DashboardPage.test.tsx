import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { computeRsvpBreakdown } from '../../domain/metrics.ts'
import { changeLanguage } from '../../i18n/i18n.ts'
import type { Services } from '../../services/contracts/index.ts'
import { setViewportWidth } from '../../test/matchMedia.ts'
import {
  createTestServices,
  DEMO_EVENTS,
  renderApp,
  TEST_NOW,
} from '../../test/renderApp.tsx'

const MAIN = DEMO_EVENTS.owner

afterEach(() => {
  vi.useRealTimers()
})

async function openDashboard(
  eventId: string = MAIN,
  services: Services = createTestServices(),
) {
  const view = renderApp(`/events/${eventId}/dashboard`, services)
  await screen.findByRole('region', { name: 'Key figures' })
  return view
}

/** The figure and unit shown on a KPI card. */
function kpi(label: string): [string, string] {
  const figures = screen.getByRole('region', { name: 'Key figures' })
  const card = within(figures).getByText(label, { selector: 'p' }).parentElement
  const [, value, hint] = Array.from(card?.querySelectorAll('p') ?? [])
  return [value?.textContent ?? '', hint?.textContent ?? '']
}

function warningTitles() {
  const list = screen.queryByRole('list', { name: 'Warnings' })
  return list
    ? within(list)
        .getAllByRole('link')
        .map((link) => link.querySelector('span > span')?.textContent)
    : []
}

function legendRows() {
  const table = screen.getByRole('table', { name: 'RSVP Status' })
  return within(table)
    .getAllByRole('row')
    .slice(1)
    .map((row) =>
      Array.from(row.querySelectorAll('th, td')).map(
        (cell) => cell.textContent,
      ),
    )
}

async function newEmptyEvent(services: Services) {
  return services.events.create({
    name: 'Fresh Start',
    startsAt: '2031-01-01T18:00:00.000Z',
    timeZone: 'Asia/Jerusalem',
    maxAttendees: 100,
    defaultAllowedAttendees: 2,
    rsvpLanguage: 'en',
  })
}

describe('Dashboard', () => {
  it('shows every key figure, calculated from the event’s data, with what it counts', async () => {
    const { services } = await openDashboard()
    const { metrics } = await services.dashboard.get(MAIN)

    expect(kpi('Total Guests')).toEqual([
      String(metrics.totalGuests),
      'invitations',
    ])
    expect(kpi('Invitations Sent')).toEqual([
      String(metrics.invitationsSent),
      'invitations',
    ])
    expect(kpi('Invitations Not Sent')).toEqual([
      String(metrics.invitationsNotSent),
      'invitations',
    ])
    expect(kpi('Awaiting Response')).toEqual([
      String(metrics.awaitingResponse),
      'invitations',
    ])
    expect(kpi('RSVP Approved')).toEqual([
      String(metrics.rsvpApproved),
      'invitations',
    ])
    expect(kpi('RSVP Not Sure')).toEqual([
      String(metrics.rsvpNotSure),
      'invitations',
    ])
    expect(kpi('RSVP Declined')).toEqual([
      String(metrics.rsvpDeclined),
      'invitations',
    ])
    expect(kpi('Confirmed Attendees')).toEqual([
      String(metrics.confirmedAttendees),
      'people',
    ])
    expect(kpi('Seating Capacity')).toEqual([
      String(metrics.seatingCapacity),
      'chairs',
    ])
    expect(kpi('Unassigned Confirmed Attendees')).toEqual([
      String(metrics.unassignedConfirmedAttendees),
      'people',
    ])
    // Approved parties and the people they bring are different figures.
    expect(metrics.confirmedAttendees).toBeGreaterThan(metrics.rsvpApproved)
    expect(metrics.totalGuests).toBe(
      metrics.invitationsSent + metrics.invitationsNotSent,
    )
  })

  it('counts a guest who was sent several invitations once', async () => {
    const services = createTestServices()
    const before = (await services.dashboard.get(MAIN)).metrics
    const guest = (await services.guests.list(MAIN)).find(
      (candidate) => candidate.invitationSentCount === 0,
    )
    for (let send = 0; send < 5; send += 1) {
      await services.messages.send(MAIN, guest?.id ?? '')
    }

    await openDashboard(MAIN, services)

    expect(kpi('Invitations Sent')[0]).toBe(String(before.invitationsSent + 1))
    expect(kpi('Invitations Not Sent')[0]).toBe(
      String(before.invitationsNotSent - 1),
    )
    expect(kpi('Awaiting Response')[0]).toBe(
      String(before.awaitingResponse + 1),
    )
    expect(kpi('Total Guests')[0]).toBe(String(before.totalGuests))
  })

  it('leaves soft-deleted guests and Not Sure answers out of the attendee figures', async () => {
    const services = createTestServices()
    const before = (await services.dashboard.get(MAIN)).metrics
    const guests = await services.guests.list(MAIN)
    const approved = guests.filter(
      (guest) => guest.rsvpStatus === 'APPROVED' && guest.tableId === null,
    )
    const [toDelete, toDoubt] = approved
    await services.guests.remove(MAIN, toDelete?.id ?? '')
    await services.guests.setRsvp(MAIN, toDoubt?.id ?? '', {
      status: 'NOT_SURE',
      attendees: 3,
    })

    await openDashboard(MAIN, services)

    expect(kpi('Total Guests')[0]).toBe(String(before.totalGuests - 1))
    expect(kpi('RSVP Approved')[0]).toBe(String(before.rsvpApproved - 2))
    expect(kpi('RSVP Not Sure')[0]).toBe(String(before.rsvpNotSure + 1))
    expect(kpi('Confirmed Attendees')[0]).toBe(
      String(
        before.confirmedAttendees -
          (toDelete?.confirmedAttendees ?? 0) -
          (toDoubt?.confirmedAttendees ?? 0),
      ),
    )
  })

  it('shows the seating, table and unassigned warnings of the main demo event, each leading to where it is fixed', async () => {
    const { services } = await openDashboard()
    const { metrics, warnings } = await services.dashboard.get(MAIN)
    const list = screen.getByRole('list', { name: 'Warnings' })

    expect(warningTitles()).toEqual([
      'Not enough seats',
      `Tables over capacity: ${warnings.tablesOverCapacity.length}`,
      'Confirmed attendees without a table',
    ])
    expect(
      within(list).getByText(
        `${metrics.confirmedAttendees} confirmed attendees and ${metrics.seatingCapacity} seats: ${metrics.confirmedAttendees - metrics.seatingCapacity} more seats are needed.`,
      ),
    ).toBeInTheDocument()
    const [first] = warnings.tablesOverCapacity
    expect(
      within(list).getByText(
        `Table ${first?.tableNumber} is over its capacity by ${first?.over}.`,
      ),
    ).toBeInTheDocument()
    expect(
      within(list).getByText(
        `${metrics.unassignedConfirmedAttendees} confirmed attendees are not assigned to a table yet.`,
      ),
    ).toBeInTheDocument()
    for (const link of within(list).getAllByRole('link')) {
      expect(link).toHaveAttribute('href', `/events/${MAIN}/layout`)
    }
  })

  it('warns when confirmed attendees or seats exceed the event maximum', async () => {
    const services = createTestServices()
    const { event } = await services.events.get(MAIN)
    await services.events.update(MAIN, { ...event, maxAttendees: 50 })
    const { metrics } = await services.dashboard.get(MAIN)

    await openDashboard(MAIN, services)
    const list = screen.getByRole('list', { name: 'Warnings' })

    // People without a seat outweigh having more chairs than the maximum.
    expect(warningTitles().slice(0, 2)).toEqual([
      'Event over capacity',
      'Not enough seats',
    ])
    expect(
      within(list).getByText(
        `Confirmed attendance exceeds the event maximum by ${metrics.confirmedAttendees - 50} (${metrics.confirmedAttendees} / 50).`,
      ),
    ).toBeInTheDocument()
    expect(
      within(list).getByText(
        `${metrics.confirmedAttendees} confirmed attendees and ${metrics.seatingCapacity} seats: ${metrics.confirmedAttendees - metrics.seatingCapacity} more seats are needed.`,
      ),
    ).toBeInTheDocument()
    expect(
      within(list).getByRole('link', { name: /Event over capacity/ }),
    ).toHaveAttribute('href', `/events/${MAIN}/settings`)
    const confirmed = screen.getByRole('progressbar', {
      name: 'Confirmed Attendees',
    })
    expect(confirmed).toHaveAttribute(
      'aria-valuetext',
      `${metrics.confirmedAttendees} / 50`,
    )
    expect(confirmed).toHaveAttribute(
      'aria-valuemax',
      String(metrics.confirmedAttendees),
    )
  })

  it('summarises further tables over capacity instead of listing them all', async () => {
    const services = createTestServices()
    const tables = await services.tables.list(MAIN)
    for (const { table, assigned } of tables
      .filter((item) => item.assigned > 1)
      .slice(0, 4)) {
      await services.tables.update(MAIN, table.id, {
        ...table,
        capacity: assigned - 1,
      })
    }
    const { warnings } = await services.dashboard.get(MAIN)
    expect(warnings.tablesOverCapacity.length).toBeGreaterThan(2)

    await openDashboard(MAIN, services)

    expect(
      screen.getByText(`And ${warnings.tablesOverCapacity.length - 2} more.`),
    ).toBeInTheDocument()
  })

  it('shows no warnings when there is nothing to warn about', async () => {
    const services = createTestServices()
    const event = await newEmptyEvent(services)
    await services.tables.create(event.id, {
      number: 1,
      capacity: 100,
      shape: 'CIRCLE',
    })

    await openDashboard(event.id, services)

    expect(screen.queryByRole('list', { name: 'Warnings' })).toBeNull()
  })

  it('breaks the guests down by RSVP status, as a chart and as a table', async () => {
    const { services } = await openDashboard()
    const { metrics } = await services.dashboard.get(MAIN)
    const shares = computeRsvpBreakdown(metrics)

    expect(
      screen.getByRole('img', {
        name: `Chart of the RSVP status of ${metrics.totalGuests} guests; the figures are in the table that follows.`,
      }),
    ).toBeInTheDocument()
    expect(legendRows()).toEqual(
      ['Approved', 'Declined', 'Not Sure', 'Awaiting Response', 'Not Sent'].map(
        (label, index) => [
          label,
          String(shares[index]?.count),
          `${shares[index]?.percent}%`,
        ],
      ),
    )
    expect(shares.reduce((sum, share) => sum + share.count, 0)).toBe(
      metrics.totalGuests,
    )
  })

  it('compares confirmed attendees and table seats with the event maximum', async () => {
    const { services } = await openDashboard()
    const { metrics } = await services.dashboard.get(MAIN)

    const confirmed = screen.getByRole('progressbar', {
      name: 'Confirmed Attendees',
    })
    const seating = screen.getByRole('progressbar', {
      name: 'Seating Capacity (Tables)',
    })
    expect(confirmed).toHaveAttribute(
      'aria-valuenow',
      String(metrics.confirmedAttendees),
    )
    expect(confirmed).toHaveAttribute('aria-valuemax', '300')
    expect(seating).toHaveAttribute(
      'aria-valuetext',
      `${metrics.seatingCapacity} / 300`,
    )
    expect(
      screen.getByText(
        'The dashed line marks the event maximum of 300 attendees.',
      ),
    ).toBeInTheDocument()
  })

  it('lists the five most recent activities and all of them on request', async () => {
    vi.useFakeTimers({ now: TEST_NOW, toFake: ['Date'] })
    const { services } = await openDashboard()
    const { recentActivity } = await services.dashboard.get(MAIN)
    const card = screen
      .getByRole('heading', { name: 'Recent Guest Activity' })
      .closest('section')!

    const shown = within(card).getAllByRole('listitem')
    expect(shown).toHaveLength(5)
    expect(
      shown.map((item) => item.querySelector('span > span')?.textContent),
    ).toEqual(recentActivity.slice(0, 5).map((item) => item.guestName))
    expect(
      shown.map((item) => item.querySelector('time')?.getAttribute('datetime')),
    ).toEqual(recentActivity.slice(0, 5).map((item) => item.at))
    expect(
      within(card).getAllByText(/^(Today|Yesterday), \d\d:\d\d$/).length,
    ).toBeGreaterThan(0)

    fireEvent.click(within(card).getByRole('button', { name: 'View All' }))
    const dialog = screen.getByRole('dialog', { name: 'Recent Guest Activity' })

    expect(within(dialog).getAllByRole('listitem')).toHaveLength(
      recentActivity.length,
    )
    // The list has nothing to tab to, so it must itself be focusable to scroll.
    expect(dialog.querySelector('[tabindex="0"]')).toContainElement(
      within(dialog).getAllByRole('listitem')[0]!,
    )
    expect(recentActivity.length).toBeGreaterThan(5)
  })

  it('describes each kind of activity', async () => {
    const services = createTestServices()
    const event = await newEmptyEvent(services)
    const add = (firstName: string, phone: string) =>
      services.guests.create(event.id, {
        firstName,
        lastName: 'Example',
        phone,
        allowedAttendees: 4,
      })
    const [yes, no, maybe, invited] = await Promise.all([
      add('Yes', '+972 00-555-0001'),
      add('No', '+972 00-555-0002'),
      add('Maybe', '+972 00-555-0003'),
      add('Invited', '+972 00-555-0004'),
    ])
    await services.guests.setRsvp(event.id, yes.id, {
      status: 'APPROVED',
      attendees: 3,
    })
    await services.guests.setRsvp(event.id, no.id, {
      status: 'DECLINED',
      attendees: null,
    })
    await services.guests.setRsvp(event.id, maybe.id, {
      status: 'NOT_SURE',
      attendees: null,
    })
    await services.messages.send(event.id, invited.id)

    await openDashboard(event.id, services)
    const card = screen
      .getByRole('heading', { name: 'Recent Guest Activity' })
      .closest('section')!

    const lines = within(card)
      .getAllByRole('listitem')
      .map((item) => item.querySelector('span:nth-of-type(2)')?.textContent)
    expect(lines.sort()).toEqual(
      [
        'Yes ExampleRSVP approved, 3 attending',
        'No ExampleRSVP declined',
        'Maybe ExampleRSVP submitted: not sure',
        'Invited ExampleInvitation sent via WhatsApp',
      ].sort(),
    )
    expect(
      within(card).queryByRole('button', { name: 'View All' }),
    ).not.toBeInTheDocument()
  })

  it('shows an organizer’s manual RSVP change as the guest’s latest response', async () => {
    const services = createTestServices()
    const guest = (await services.guests.list(MAIN)).find(
      (candidate) => candidate.rsvpStatus === 'NO_RESPONSE',
    )
    await services.guests.setRsvp(MAIN, guest?.id ?? '', {
      status: 'DECLINED',
      attendees: null,
    })

    await openDashboard(MAIN, services)
    const card = screen
      .getByRole('heading', { name: 'Recent Guest Activity' })
      .closest('section')!
    const [latest] = within(card).getAllByRole('listitem')

    expect(latest).toHaveTextContent(
      `${guest?.firstName} ${guest?.lastName}RSVP declined`,
    )
  })

  it('has an Event Settings button and shortcuts to the event’s other pages', async () => {
    await openDashboard()
    const href = (name: RegExp | string) =>
      screen.getByRole('link', { name }).getAttribute('href')

    expect(
      within(screen.getByRole('main')).getByRole('link', {
        name: 'Event Settings',
      }),
    ).toHaveAttribute('href', `/events/${MAIN}/settings`)
    expect(href(/^Manage Guests/)).toBe(`/events/${MAIN}/guests`)
    expect(href(/^Send WhatsApp Messages/)).toBe(`/events/${MAIN}/messages`)
    expect(href(/^RSVP Settings/)).toBe(`/events/${MAIN}/rsvp`)
    expect(href(/^Manage Tables/)).toBe(`/events/${MAIN}/layout`)
  })

  it('shows empty states for an event with no guests', async () => {
    const services = createTestServices()
    const event = await newEmptyEvent(services)

    await openDashboard(event.id, services)

    expect(kpi('Total Guests')[0]).toBe('0')
    expect(kpi('Confirmed Attendees')[0]).toBe('0')
    expect(screen.getByText('No guests yet')).toBeInTheDocument()
    expect(screen.getByText('No activity yet')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(warningTitles()).toEqual(['Seating capacity below event capacity'])
  })

  it('picks up changes made on other pages when it is opened again', async () => {
    const { services } = await openDashboard()
    const before = (await services.dashboard.get(MAIN)).metrics

    fireEvent.click(screen.getByRole('link', { name: 'Guests' }))
    await screen.findByRole('heading', { level: 1, name: 'Guests' })
    await services.guests.create(MAIN, {
      firstName: 'Late',
      lastName: 'Arrival',
      phone: '+972 00-555-0100',
      allowedAttendees: 2,
    })
    await services.tables.create(MAIN, {
      number: 99,
      capacity: 12,
      shape: 'CIRCLE',
    })
    fireEvent.click(screen.getByRole('link', { name: 'Dashboard' }))
    await screen.findByRole('region', { name: 'Key figures' })

    await waitFor(() =>
      expect(kpi('Total Guests')[0]).toBe(String(before.totalGuests + 1)),
    )
    expect(kpi('Invitations Not Sent')[0]).toBe(
      String(before.invitationsNotSent + 1),
    )
    expect(kpi('Seating Capacity')[0]).toBe(String(before.seatingCapacity + 12))
  })

  it.each([
    [DEMO_EVENTS.viewer, 'View-only access'],
    [DEMO_EVENTS.past, 'This event has ended'],
  ])(
    'is fully visible, and marked read-only, for %s',
    async (eventId, notice) => {
      await openDashboard(eventId)

      expect(screen.getByText(notice)).toBeInTheDocument()
      expect(kpi('Total Guests')[0]).not.toBe('')
      expect(
        screen.getByRole('table', { name: 'RSVP Status' }),
      ).toBeInTheDocument()
    },
  )

  it('shows a loading state, then the figures', async () => {
    renderApp(`/events/${MAIN}/dashboard`, createTestServices({ delayMs: 30 }))

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Dashboard' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Loading…')
    expect(
      await screen.findByRole('region', { name: 'Key figures' }),
    ).toBeInTheDocument()
  })

  it('shows an error that can be retried', async () => {
    renderApp(
      `/events/${MAIN}/dashboard`,
      createTestServices({ failOperations: new Set(['dashboard.get']) }),
    )

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(
      'The service is not available right now. Please try again.',
    )
    expect(
      screen.getByRole('heading', { level: 1, name: 'Dashboard' }),
    ).toBeInTheDocument()
    fireEvent.click(within(alert).getByRole('button', { name: 'Try again' }))
    expect(await screen.findByRole('alert')).toBeInTheDocument()
  })

  it('is translated, with numbers and times in the interface language', async () => {
    vi.useFakeTimers({ now: TEST_NOW, toFake: ['Date'] })
    await changeLanguage('he')
    renderApp(`/events/${MAIN}/dashboard`)
    await screen.findByRole('region', { name: 'נתונים עיקריים' })

    expect(
      screen.getByRole('heading', { level: 1, name: 'לוח בקרה' }),
    ).toBeInTheDocument()
    expect(screen.getByText('סך האורחים')).toBeInTheDocument()
    expect(
      screen.getByRole('table', { name: 'סטטוס אישורי הגעה' }),
    ).toBeInTheDocument()
    expect(
      screen.getAllByText(/^(היום|אתמול), \d\d:\d\d$/).length,
    ).toBeGreaterThan(0)
    expect(
      screen.getByRole('link', { name: /^ניהול שולחנות/ }),
    ).toBeInTheDocument()
  })

  it('keeps every figure on a phone', async () => {
    setViewportWidth(390)
    await openDashboard()

    expect(
      within(screen.getByRole('region', { name: 'Key figures' })).getAllByText(
        /^(invitations|people|chairs)$/,
      ),
    ).toHaveLength(10)
    expect(
      screen.getByRole('table', { name: 'RSVP Status' }),
    ).toBeInTheDocument()
  })
})
