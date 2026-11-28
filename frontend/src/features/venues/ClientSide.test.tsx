import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { Services } from '../../services/contracts/index.ts'
import { generateDemoState } from '../../services/mock/generator.ts'
import {
  createTestServices,
  renderApp,
  TEST_NOW,
} from '../../test/renderApp.tsx'

const withVenues = () => createTestServices({ venues: true })

/** The demo switched to the client before the page opens (#23). */
async function asClient(): Promise<{ services: Services; eventId: string }> {
  const services = withVenues()
  const view = (await services.demo!.getViewAs())!
  await services.demo!.setViewAs('CLIENT')
  return { services, eventId: view.client.eventId }
}

describe('the venue/client switcher (#23, Phase 29b)', () => {
  it('switches to the client and back, staying on the shared event', async () => {
    const services = withVenues()
    const view = (await services.demo!.getViewAs())!
    const { router } = renderApp(
      `/events/${view.client.eventId}/dashboard`,
      services,
    )
    expect(
      await screen.findByText('You’re viewing as the venue owner'),
    ).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'View as Dana Levi' }))
    expect(
      await screen.findByText('You’re viewing as the client (Dana Levi)'),
    ).toBeVisible()
    expect(router.state.location.pathname).toBe(
      `/events/${view.client.eventId}/dashboard`,
    )
    const nav = screen.getByRole('navigation', { name: 'Event navigation' })
    expect(within(nav).getByRole('link', { name: 'RSVP' })).toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: 'View as venue owner' }))
    expect(
      await screen.findByText('You’re viewing as the venue owner'),
    ).toBeVisible()
  })

  it('takes the client to their event from a venue page', async () => {
    const services = withVenues()
    const view = (await services.demo!.getViewAs())!
    const { router } = renderApp('/venues/org-1/events', services)
    const select = await screen.findByRole('combobox', {
      name: 'View the venue demo as',
    })
    fireEvent.click(select)
    fireEvent.click(
      await screen.findByRole('option', { name: 'View as Dana Levi (client)' }),
    )
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(
        `/events/${view.client.eventId}/dashboard`,
      ),
    )
  })

  it('shows no banner on the demo user’s personal pages', async () => {
    renderApp('/events', withVenues())
    await screen.findByRole('heading', { level: 1, name: 'My Events' })
    expect(screen.queryByText(/You’re viewing as/)).toBeNull()
  })
})

describe('the client’s side of the event (Phase 29b)', () => {
  it('lists their event as managed by the venue (#13)', async () => {
    const { services } = await asClient()
    renderApp('/events', services)
    const card = (await screen.findAllByRole('article'))[0]!
    expect(within(card).getByText('Managed by Grand Garden Hall')).toBeVisible()
    expect(within(card).getByText('Main Hall, Grand Garden Hall')).toBeVisible()
    expect(within(card).getByText('Client Lead')).toBeVisible()
  })

  it('shows the venue’s details as text with its contacts (#14)', async () => {
    const { services, eventId } = await asClient()
    renderApp(`/events/${eventId}/settings`, services)
    expect(
      await screen.findByText(
        'Maintained by Grand Garden Hall. Contact them to change it.',
      ),
    ).toBeVisible()
    expect(
      screen.getByRole('link', { name: /events@grandgardenhall/ }),
    ).toHaveAttribute('href', expect.stringMatching(/^mailto:/))
    expect(screen.getByText('350 people')).toBeVisible()
    expect(screen.queryByLabelText(/^Event Date/)).toBeNull()
    expect(screen.getByRole('textbox', { name: /Event Name/ })).toBeEnabled()
  })

  it('seats guests on a room the venue arranged (#16)', async () => {
    const { services, eventId } = await asClient()
    renderApp(`/events/${eventId}/layout`, services)
    expect(
      await screen.findByText(
        'The room and tables are arranged by Grand Garden Hall.',
      ),
    ).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Add Table' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Edit Layout' })).toBeNull()
  })

  it('lets the lead invite to their team, with the venue team read-only (#15)', async () => {
    const { services, eventId } = await asClient()
    renderApp(`/events/${eventId}/permissions`, services)
    const yours = await screen.findByRole('region', { name: 'Your Team' })
    expect(within(yours).getByText('You')).toBeVisible()
    expect(
      screen.getByRole('region', { name: 'Grand Garden Hall Team' }),
    ).toBeVisible()
    expect(screen.getByText(/never see phone numbers/)).toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: 'Invite User' }))
    const dialog = within(
      screen.getByRole('dialog', { name: 'Invite to Your Team' }),
    )
    fireEvent.change(dialog.getByRole('textbox', { name: /Email/ }), {
      target: { value: 'planner@example.com' },
    })
    fireEvent.click(dialog.getByRole('button', { name: 'Send Invitation' }))
    expect(await within(yours).findByText('planner@example.com')).toBeVisible()

    fireEvent.click(
      within(yours).getByRole('button', {
        name: 'Remove: planner@example.com',
      }),
    )
    fireEvent.click(
      within(
        screen.getByRole('dialog', { name: 'Remove planner@example.com?' }),
      ).getByRole('button', { name: 'Remove' }),
    )
    await waitFor(() =>
      expect(within(yours).queryByText('planner@example.com')).toBeNull(),
    )
  })

  it('shows the sidebar line naming the venue', async () => {
    const { services, eventId } = await asClient()
    renderApp(`/events/${eventId}/dashboard`, services)
    expect(
      await screen.findAllByText('Managed by Grand Garden Hall'),
    ).not.toHaveLength(0)
  })
})

describe('the client lead’s team page, more (#15)', () => {
  it('changes a role, searches and filters', async () => {
    const { services, eventId } = await asClient()
    renderApp(`/events/${eventId}/permissions`, services)
    const yours = await screen.findByRole('region', { name: 'Your Team' })

    fireEvent.click(
      within(yours).getByRole('button', { name: 'Change Role: Yossi Cohen' }),
    )
    const dialog = within(
      screen.getByRole('dialog', { name: 'Change the role of Yossi Cohen' }),
    )
    fireEvent.click(dialog.getByRole('combobox', { name: 'Role' }))
    fireEvent.click(await screen.findByRole('option', { name: 'Viewer' }))
    fireEvent.click(dialog.getByRole('button', { name: 'Save Role' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    const yossi = within(yours).getByText('Yossi Cohen').closest('tr')!
    expect(within(yossi).getByText('Viewer')).toBeVisible()

    fireEvent.change(within(yours).getByRole('searchbox'), {
      target: { value: 'miriam' },
    })
    expect(within(yours).getAllByRole('row')).toHaveLength(2)
    fireEvent.change(within(yours).getByRole('searchbox'), {
      target: { value: 'nobody' },
    })
    expect(within(yours).getByText('No one matches this search.')).toBeVisible()
  })

  it('explains a refused invitation', async () => {
    const { services, eventId } = await asClient()
    renderApp(`/events/${eventId}/permissions`, services)
    await screen.findByRole('region', { name: 'Your Team' })
    for (const [email, message] of [
      ['yossi.cohen@example.com', 'This person is already on your team'],
      ['orly.events@example.com', 'This address is already invited'],
      ['alex.morgan@example.com', /on the venue’s team/],
      ['not an email', /valid email/i],
    ] as const) {
      fireEvent.click(screen.getByRole('button', { name: 'Invite User' }))
      const dialog = within(
        screen.getByRole('dialog', { name: 'Invite to Your Team' }),
      )
      fireEvent.change(dialog.getByRole('textbox', { name: /Email/ }), {
        target: { value: email },
      })
      fireEvent.click(dialog.getByRole('button', { name: 'Send Invitation' }))
      expect(await dialog.findByText(message)).toBeVisible()
      fireEvent.click(dialog.getByRole('button', { name: 'Cancel' }))
    }
  })

  it('shows an Editor the team without changing it', async () => {
    const state = generateDemoState(TEST_NOW)
    const probe = createTestServices({ venues: true })
    const eventId = (await probe.demo!.getViewAs())!.client.eventId
    const editor = state.clientTeam!.find(
      (member) => member.eventId === eventId && member.role === 'CLIENT_EDITOR',
    )!
    const services = createTestServices({
      venues: true,
      actingUserId: editor.userId,
    })
    renderApp(`/events/${eventId}/permissions`, services)
    const yours = await screen.findByRole('region', { name: 'Your Team' })
    expect(
      within(yours).getByText(/The Client Lead decides who joins/),
    ).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Invite User' })).toBeNull()
    expect(
      within(yours).queryByRole('button', { name: /Change Role/ }),
    ).toBeNull()
  })
})
