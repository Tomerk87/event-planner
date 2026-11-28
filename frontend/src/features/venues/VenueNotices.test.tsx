import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { Services } from '../../services/contracts/index.ts'
import { createTestServices, renderApp } from '../../test/renderApp.tsx'

const withVenues = () => createTestServices({ venues: true })

/** The client's event and its busiest table, as the venue owner sees them. */
async function setup() {
  const services = withVenues()
  const eventId = (await services.demo!.getViewAs())!.client.eventId
  const tables = await services.tables.list(eventId)
  const busiest = [...tables].sort((a, b) => b.assigned - a.assigned)[0]!
  return { services, eventId, busiest }
}

async function shrink(services: Services, eventId: string, tableId: string) {
  const row = (await services.tables.list(eventId)).find(
    (item) => item.table.id === tableId,
  )!
  await services.tables.update(
    eventId,
    tableId,
    { ...row.table, capacity: 2 },
    { acknowledgeSeated: true, note: 'We need the dance floor.' },
  )
}

describe('the venue changes a table under seated guests (Phase 30, #20)', () => {
  it('warns before fewer chairs, and saves only once it’s understood', async () => {
    const { services, eventId, busiest } = await setup()
    renderApp(`/events/${eventId}/layout?view=tables`, services)
    const name = `Table ${busiest.table.number}`
    fireEvent.click(await screen.findByRole('button', { name: `Edit ${name}` }))
    const dialog = within(screen.getByRole('dialog', { name: `Edit ${name}` }))
    fireEvent.change(dialog.getByRole('spinbutton', { name: /Capacity/ }), {
      target: { value: '2' },
    })
    expect(dialog.getByText(/Nobody loses a seat/)).toBeVisible()
    expect(
      dialog.getByRole('list', { name: /^Guests Seated at This Table/ }),
    ).toBeVisible()
    const save = dialog.getByRole('button', { name: 'Save Changes' })
    expect(save).toBeDisabled()

    fireEvent.change(
      dialog.getByRole('textbox', { name: /Note to the client/ }),
      {
        target: { value: 'We need the dance floor.' },
      },
    )
    fireEvent.click(dialog.getByRole('checkbox', { name: /I understand/ }))
    fireEvent.click(save)
    expect(await screen.findByText(/Dana Levi was notified/)).toBeVisible()
    const [notice] = await services.venues!.listNotices(eventId)
    expect(notice).toMatchObject({
      kind: 'TABLE_OVER_CAPACITY',
      note: 'We need the dance floor.',
    })
  })

  it('warns before deleting a table with guests, listing who loses a seat', async () => {
    const { services, eventId, busiest } = await setup()
    renderApp(`/events/${eventId}/layout?view=tables`, services)
    const name = `Table ${busiest.table.number}`
    fireEvent.click(await screen.findByRole('button', { name: `Edit ${name}` }))
    fireEvent.click(
      within(screen.getByRole('dialog', { name: `Edit ${name}` })).getByRole(
        'button',
        { name: /Delete/ },
      ),
    )
    const dialog = within(
      await screen.findByRole('dialog', { name: /^Delete/ }),
    )
    expect(
      dialog.getByRole('list', { name: /^Guests Who Will Lose Their Seats/ }),
    ).toBeVisible()
    const remove = dialog.getByRole('button', { name: /Delete Table/ })
    expect(remove).toBeDisabled()
    expect(dialog.getByText('Check the box to delete.')).toBeVisible()
    fireEvent.click(dialog.getByRole('checkbox', { name: /I understand/ }))
    fireEvent.click(remove)
    expect(await screen.findByText(/are now unassigned/)).toBeVisible()
  })

  it('shows the venue the client was told, on the table', async () => {
    const { services, eventId, busiest } = await setup()
    await shrink(services, eventId, busiest.table.id)
    renderApp(`/events/${eventId}/layout?table=${busiest.table.id}`, services)
    expect(
      await screen.findByText('Client notified · waiting for a fix'),
    ).toBeVisible()
  })
})

describe('the client is told to act (Phase 30, #21)', () => {
  it('shows the action on the Dashboard until it is done, with the note', async () => {
    const { services, eventId, busiest } = await setup()
    await shrink(services, eventId, busiest.table.id)
    await services.demo!.setViewAs('CLIENT')
    renderApp(`/events/${eventId}/dashboard`, services)
    const banners = await screen.findByRole('list', {
      name: 'Changes by the venue',
    })
    expect(within(banners).getByText(/Action needed in/)).toBeVisible()
    expect(within(banners).getByText('We need the dance floor.')).toBeVisible()
    expect(
      within(banners).getByRole('link', { name: 'Fix Seating' }),
    ).toHaveAttribute(
      'href',
      `/events/${eventId}/layout?table=${busiest.table.id}`,
    )
  })

  it('pins the action in the bell, counted until it is done', async () => {
    const { services, eventId, busiest } = await setup()
    await shrink(services, eventId, busiest.table.id)
    await services.demo!.setViewAs('CLIENT')
    renderApp('/events', services)
    const bell = await screen.findByRole('button', {
      name: /Notifications.*1 unread/,
    })
    fireEvent.click(bell)
    const list = await screen.findByRole('list', {
      name: 'Changes by the venue',
    })
    expect(within(list).getByText('Action needed')).toBeVisible()
  })

  it('lets the client close a removed table’s notice, and read news', async () => {
    const { services, eventId, busiest } = await setup()
    await services.tables.remove(eventId, busiest.table.id, {
      acknowledgeSeated: true,
    })
    const { event } = await services.events.get(eventId)
    await services.events.update(eventId, {
      ...event,
      location: '14 Orchard Lane, Ramat Gan',
    })
    await services.demo!.setViewAs('CLIENT')
    renderApp(`/events/${eventId}/dashboard`, services)
    const banners = await screen.findByRole('list', {
      name: 'Changes by the venue',
    })
    expect(within(banners).getByText(/They changed the address/)).toBeVisible()
    fireEvent.click(
      within(banners).getByRole('button', { name: 'Mark as Read' }),
    )
    fireEvent.click(
      within(banners).getByRole('button', { name: 'I’ve Handled It' }),
    )
    await waitFor(() =>
      expect(
        screen.queryByRole('list', { name: 'Changes by the venue' }),
      ).toBeNull(),
    )
  })

  it('opens the table from the Layout page’s banner', async () => {
    const { services, eventId, busiest } = await setup()
    await shrink(services, eventId, busiest.table.id)
    await services.demo!.setViewAs('CLIENT')
    renderApp(`/events/${eventId}/layout?view=tables`, services)
    fireEvent.click(await screen.findByRole('button', { name: 'Fix Seating' }))
    expect(
      await screen.findByText(`Table ${busiest.table.number}`, {
        selector: 'p',
      }),
    ).toBeVisible()
  })
})
