import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { Services } from '../../services/contracts/index.ts'
import { createTestServices, renderApp } from '../../test/renderApp.tsx'

const withVenues = () => createTestServices({ venues: true })

/** The id and open link of the first org-1 event with this status. */
async function eventWith(services: Services, status: string) {
  const venues = services.venues!
  const events = await venues.listEvents('org-1')
  const summary = events.find((candidate) => candidate.status === status)!
  const people = await venues.getEventPeople('org-1', summary.event.id)
  return {
    id: summary.event.id,
    name: summary.event.name,
    token: people.demoLinkToken,
  }
}

const clientSection = () => screen.getByRole('region', { name: 'Client' })

describe('the client card (Phase 28, mockup #10)', () => {
  it('opens from the event card and shows the joined client and both teams', async () => {
    const services = withVenues()
    const { name } = await eventWith(services, 'CLIENT_JOINED')
    renderApp('/venues/org-1/events', services)
    fireEvent.click(
      await screen.findByRole('link', { name: `Client: ${name}` }),
    )

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Permissions' }),
    ).toBeVisible()
    expect(within(clientSection()).getByText('Client joined')).toBeVisible()
    expect(
      within(clientSection()).getByRole('link', { name: 'Email Dana' }),
    ).toHaveAttribute('href', 'mailto:dana.levi@example.com')
    const team = screen.getByRole('table', { name: 'The client’s team' })
    expect(within(team).getAllByRole('row')).toHaveLength(5)
    expect(within(team).getByText('No account yet')).toBeVisible()
    expect(
      screen.getByRole('table', { name: 'The venue’s team' }),
    ).toBeVisible()
    // Nothing on a joined client can be resent or revoked.
    expect(screen.queryByRole('button', { name: 'Resend' })).toBeNull()
    expect(
      screen.queryByRole('button', { name: 'Revoke Invitation' }),
    ).toBeNull()
  })

  it('resends an open invitation', async () => {
    const services = withVenues()
    const { id } = await eventWith(services, 'INVITATION_SENT')
    renderApp(`/venues/org-1/events/${id}`, services)
    const section = within(
      await screen.findByRole('region', { name: 'Client' }),
    )
    expect(section.getByText('Hasn’t accepted yet')).toBeVisible()
    fireEvent.click(section.getByRole('button', { name: 'Resend' }))
    expect(await screen.findByText(/A new link was sent to/)).toBeVisible()
    await waitFor(() =>
      expect(within(clientSection()).getByText('2')).toBeVisible(),
    )
  })

  it('invites a different client in place of one who hasn’t joined', async () => {
    const services = withVenues()
    const { id } = await eventWith(services, 'INVITATION_SENT')
    renderApp(`/venues/org-1/events/${id}`, services)
    fireEvent.click(
      await screen.findByRole('button', { name: 'Invite a Different Client' }),
    )
    const dialog = within(
      screen.getByRole('dialog', { name: 'Invite a Different Client' }),
    )
    expect(dialog.getByText(/stops working/)).toBeVisible()
    const email = dialog.getByRole('textbox', { name: /Client Email/ })
    fireEvent.change(email, { target: { value: 'not an email' } })
    fireEvent.click(dialog.getByRole('button', { name: 'Send Invitation' }))
    expect(await dialog.findByText(/valid email/i)).toBeVisible()

    fireEvent.change(email, { target: { value: 'maya@example.com' } })
    fireEvent.click(dialog.getByRole('button', { name: 'Send Invitation' }))
    expect(
      await within(clientSection()).findByText('maya@example.com'),
    ).toBeVisible()
  })

  it('revokes, then the event waits for a client, who can be invited', async () => {
    const services = withVenues()
    const { id } = await eventWith(services, 'INVITATION_EXPIRED')
    renderApp(`/venues/org-1/events/${id}`, services)
    expect(await screen.findByText('The invitation link expired')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Revoke Invitation' }))
    fireEvent.click(
      within(
        screen.getByRole('dialog', { name: 'Revoke the invitation?' }),
      ).getByRole('button', { name: 'Revoke Invitation' }),
    )
    expect(await screen.findByText('No client yet')).toBeVisible()
    expect(within(clientSection()).getByText('Awaiting client')).toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: 'Invite Client' }))
    const dialog = within(screen.getByRole('dialog', { name: 'Invite Client' }))
    fireEvent.change(dialog.getByRole('textbox', { name: /Client Email/ }), {
      target: { value: 'couple@example.com' },
    })
    fireEvent.click(dialog.getByRole('button', { name: 'Send Invitation' }))
    expect(
      await within(clientSection()).findByText('Invitation sent'),
    ).toBeVisible()
    expect(
      screen.getByRole('link', { name: 'Open Invitation Link' }),
    ).toBeVisible()
  })

  it('is not found under a venue the event isn’t in', async () => {
    const services = withVenues()
    const { id } = await eventWith(services, 'INVITATION_SENT')
    renderApp(`/venues/org-2/events/${id}`, services)
    expect(
      await screen.findByRole('heading', { name: 'Page not found' }),
    ).toBeVisible()
  })
})

describe('the accept page (Phase 28, mockup #12)', () => {
  it('explains another email, and the demo accepts as the client', async () => {
    const services = withVenues()
    const { id, token, name } = await eventWith(services, 'INVITATION_SENT')
    renderApp(`/client-invitations/${token}`, services)

    expect(await screen.findByRole('heading', { level: 1, name })).toBeVisible()
    expect(screen.getByText('Managed by Grand Garden Hall')).toBeVisible()
    expect(screen.getByText('Different email')).toBeVisible()
    expect(
      screen.getByText('This invitation is for another email'),
    ).toBeVisible()
    expect(
      screen.queryByRole('button', { name: 'Accept Invitation' }),
    ).toBeNull()

    fireEvent.click(
      screen.getByRole('button', { name: 'Accept as the Client' }),
    )
    expect(
      await screen.findByRole('heading', { name: 'Invitation Accepted' }),
    ).toBeVisible()
    const back = screen.getByRole('link', { name: /Back to Grand Garden Hall/ })
    expect(back).toHaveAttribute('href', `/venues/org-1/events/${id}`)
  })

  it('shows a used link as used', async () => {
    const services = withVenues()
    const { token } = await eventWith(services, 'INVITATION_SENT')
    await services.venues!.acceptClientInvitationAsInvitee!(token!)
    renderApp(`/client-invitations/${token}`, services)
    expect(
      await screen.findByRole('heading', {
        name: 'This Invitation Was Already Used',
      }),
    ).toBeVisible()
  })

  it('shows an expired link with the venue contact', async () => {
    const services = withVenues()
    const { token } = await eventWith(services, 'INVITATION_EXPIRED')
    renderApp(`/client-invitations/${token}`, services)
    expect(
      await screen.findByRole('heading', {
        name: 'This Invitation Has Expired',
      }),
    ).toBeVisible()
    expect(screen.getByText('Your contact at the venue')).toBeVisible()
    expect(
      screen.getByRole('link', { name: 'Email Grand Garden Hall' }),
    ).toHaveAttribute('href', expect.stringMatching(/^mailto:/))
  })

  it('shows a replaced link as no longer valid', async () => {
    const services = withVenues()
    const { id, token } = await eventWith(services, 'INVITATION_SENT')
    await services.venues!.resendClientInvitation('org-1', id)
    renderApp(`/client-invitations/${token}`, services)
    expect(
      await screen.findByRole('heading', {
        name: 'This Invitation Is No Longer Valid',
      }),
    ).toBeVisible()
  })

  it('refuses an unknown link without saying more', async () => {
    renderApp('/client-invitations/not-a-real-token', withVenues())
    expect(
      await screen.findByText(/This invitation link isn’t valid/),
    ).toBeVisible()
  })

  it('offers Accept to the invited address, but a venue member can’t be the client', async () => {
    const services = withVenues()
    const { id } = await eventWith(services, 'AWAITING_CLIENT')
    await services.venues!.inviteClient('org-1', id, 'alex.morgan@example.com')
    const { demoLinkToken } = await services.venues!.getEventPeople('org-1', id)
    renderApp(`/client-invitations/${demoLinkToken}`, services)

    expect(await screen.findByText('Email matches')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Accept Invitation' }))
    expect(
      await screen.findByText(/you can’t be this event’s client too/),
    ).toBeVisible()
  })

  it('asks a signed-out visitor to sign in', async () => {
    renderApp('/client-invitations/abc', withVenues(), { session: 'none' })
    expect(
      await screen.findByRole('heading', { name: 'Sign in to accept' }),
    ).toBeVisible()
    expect(screen.getByRole('link', { name: 'Sign In' })).toHaveAttribute(
      'href',
      '/signin',
    )
  })
})
