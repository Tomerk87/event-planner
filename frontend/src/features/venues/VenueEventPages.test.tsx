import { fireEvent, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { Services } from '../../services/contracts/index.ts'
import { createTestServices, renderApp } from '../../test/renderApp.tsx'

const withVenues = () => createTestServices({ venues: true })

async function eventWith(services: Services, status: string) {
  const events = await services.venues!.listEvents('org-1')
  return events.find((summary) => summary.status === status)!.event.id
}

describe('a venue event, as the venue sees it (Phase 29a)', () => {
  it('opens from the venue’s card, without RSVP or Messages', async () => {
    const services = withVenues()
    renderApp('/venues/org-1/events', services)
    const card = (await screen.findAllByRole('article'))[0]!
    fireEvent.click(within(card).getByRole('link', { name: /^Open Event/ }))
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Dashboard' }),
    ).toBeVisible()
    const nav = screen.getByRole('navigation', { name: 'Event navigation' })
    expect(within(nav).getByRole('link', { name: 'Guests' })).toBeVisible()
    expect(within(nav).queryByRole('link', { name: 'RSVP' })).toBeNull()
    expect(within(nav).queryByRole('link', { name: 'Messages' })).toBeNull()
    expect(within(nav).getByRole('link', { name: 'Permissions' })).toBeVisible()
    expect(
      screen.getByRole('link', { name: 'Back to My Events' }),
    ).toHaveAttribute('href', '/venues/org-1/events')
    // Roles come from the venue here, so the demo's switcher is hidden.
    expect(screen.queryByRole('combobox', { name: /Role/ })).toBeNull()
  })

  it('shows the venue’s warnings, actions and privacy note', async () => {
    const services = withVenues()
    renderApp(
      `/events/${await eventWith(services, 'CLIENT_JOINED')}/dashboard`,
      services,
    )
    const warnings = await screen.findByRole('region', { name: /Warnings/ })
    expect(within(warnings).getByText(/Tables over capacity/)).toBeVisible()
    expect(
      within(warnings).getByRole('link', { name: 'Open Event Layout' }),
    ).toBeVisible()
    expect(screen.getByText('Client joined')).toBeVisible()
    expect(screen.getByRole('link', { name: /Manage Client/ })).toHaveAttribute(
      'href',
      expect.stringMatching(/\/permissions$/),
    )
    expect(screen.getByRole('button', { name: /Seating Export/ })).toBeVisible()
    expect(screen.getByText(/aren’t shown to Grand Garden Hall/)).toBeVisible()
    expect(screen.queryByRole('link', { name: /Send WhatsApp/ })).toBeNull()
  })

  it('warns while the event waits for its client', async () => {
    const services = withVenues()
    renderApp(
      `/events/${await eventWith(services, 'AWAITING_CLIENT')}/dashboard`,
      services,
    )
    const warnings = await screen.findByRole('region', { name: /Warnings/ })
    expect(within(warnings).getByText('Waiting for the client')).toBeVisible()
    expect(
      within(warnings).getByRole('link', { name: 'Manage Client' }),
    ).toBeVisible()
  })

  it('lists the client’s guests read-only, without phones', async () => {
    const services = withVenues()
    renderApp(
      `/events/${await eventWith(services, 'CLIENT_JOINED')}/guests`,
      services,
    )
    expect(
      await screen.findByText('The guest list is managed by the client'),
    ).toBeVisible()
    expect(
      screen.getByText('Phone numbers are hidden from Grand Garden Hall'),
    ).toBeVisible()
    const table = screen.getByRole('table', { name: /Guests/ })
    const headers = within(table)
      .getAllByRole('columnheader')
      .map((header) => header.textContent)
    expect(headers.join(' ')).not.toMatch(/Phone|Sent/)
    expect(headers.join(' ')).toMatch(/Group/)
    expect(screen.queryByRole('button', { name: /Add Guest/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /Import/ })).toBeNull()
    expect(screen.queryByRole('tab', { name: /Unknown/ })).toBeNull()
    expect(screen.queryByRole('checkbox')).toBeNull()
    expect(screen.getByRole('button', { name: 'Seating Export' })).toBeVisible()
  })

  it('shows the client card on the event’s Permissions page', async () => {
    const services = withVenues()
    renderApp(
      `/events/${await eventWith(services, 'INVITATION_SENT')}/permissions`,
      services,
    )
    const client = await screen.findByRole('region', { name: 'Client' })
    expect(within(client).getByRole('button', { name: 'Resend' })).toBeVisible()
    expect(screen.getByRole('region', { name: 'Venue Team' })).toBeVisible()
    expect(screen.queryByText('Event Members')).toBeNull()
  })

  it('keeps the personal pages as they were for a personal event', async () => {
    renderApp('/events/evt-1/dashboard', withVenues())
    await screen.findByRole('heading', { level: 1, name: 'Dashboard' })
    const nav = screen.getByRole('navigation', { name: 'Event navigation' })
    expect(within(nav).getByRole('link', { name: 'RSVP' })).toBeVisible()
    expect(within(nav).getByRole('link', { name: 'Messages' })).toBeVisible()
    expect(screen.queryByRole('region', { name: /Warnings/ })).toBeNull()
  })
})
