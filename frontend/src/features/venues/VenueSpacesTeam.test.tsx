import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { chooseOption } from '../../test/controls.ts'
import { setViewportWidth } from '../../test/matchMedia.ts'
import { createTestServices, renderApp } from '../../test/renderApp.tsx'

const withVenues = () => createTestServices({ venues: true })

function spaceCard(name: string) {
  const article = screen
    .getByRole('heading', { level: 2, name })
    .closest('article')
  if (!article) {
    throw new Error(`no card for ${name}`)
  }
  return within(article)
}

describe('My Spaces (mockup #3)', () => {
  it('lists the active spaces with their figures, and the archived ones apart', async () => {
    renderApp('/venues/org-1/spaces', withVenues())
    await screen.findByRole('list', { name: 'Spaces' })

    expect(screen.getByRole('tab', { name: /^Active\s*3$/ })).toBeVisible()
    expect(
      spaceCard('Main Hall').getByText(/Dana & Yossi’s Wedding/),
    ).toBeVisible()
    expect(spaceCard('Rooftop Lounge').getByText('Not set')).toBeVisible()
    expect(
      spaceCard('Rooftop Lounge').getByText(/No layouts yet/),
    ).toBeVisible()

    fireEvent.click(screen.getByRole('tab', { name: /^Archived\s*1$/ }))
    expect(
      await screen.findByRole('heading', { level: 2, name: 'Winter Pavilion' }),
    ).toBeVisible()
  })

  it('creates a space, checking the fields first', async () => {
    renderApp('/venues/org-1/spaces', withVenues())
    await screen.findByRole('list', { name: 'Spaces' })
    fireEvent.click(screen.getByRole('button', { name: 'Create Space' }))
    const dialog = within(screen.getByRole('dialog', { name: 'Create Space' }))

    fireEvent.click(dialog.getByRole('button', { name: 'Create Space' }))
    expect(dialog.getByText(/Enter a name/)).toBeVisible()
    expect(dialog.getByText('Enter the address')).toBeVisible()

    fireEvent.change(dialog.getByRole('textbox', { name: /Space Name/ }), {
      target: { value: 'main hall' },
    })
    expect(dialog.queryByText('Another space already has this name')).toBeNull()
    fireEvent.click(dialog.getByRole('button', { name: 'Create Space' }))
    expect(
      dialog.getByText('Another space already has this name'),
    ).toBeVisible()

    fireEvent.change(dialog.getByRole('textbox', { name: /Space Name/ }), {
      target: { value: 'Sky Terrace' },
    })
    fireEvent.change(dialog.getByRole('textbox', { name: /Address/ }), {
      target: { value: '12 Orchard Lane' },
    })
    fireEvent.change(dialog.getByRole('textbox', { name: /Maximum People/ }), {
      target: { value: '150' },
    })
    fireEvent.click(dialog.getByRole('button', { name: 'Create Space' }))

    expect(
      await screen.findByRole('heading', { level: 2, name: 'Sky Terrace' }),
    ).toBeVisible()
    expect(screen.getByRole('tab', { name: /^Active\s*4$/ })).toBeVisible()
  })

  it('archives a space from its menu', async () => {
    renderApp('/venues/org-1/spaces', withVenues())
    await screen.findByRole('list', { name: 'Spaces' })
    fireEvent.click(
      screen.getByRole('button', { name: 'Actions for Rooftop Lounge' }),
    )
    fireEvent.click(screen.getByRole('menuitem', { name: 'Archive' }))

    await waitFor(() =>
      expect(screen.getByRole('tab', { name: /^Archived\s*2$/ })).toBeVisible(),
    )
  })
})

describe('a space (mockups #4, #5)', () => {
  it('shows its layouts and upcoming events', async () => {
    renderApp('/venues/org-1/spaces/spc-1-1', withVenues())
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Main Hall' }),
    ).toBeVisible()
    const layouts = within(screen.getByRole('list', { name: 'Layouts' }))
    expect(
      layouts.getAllByRole('heading', { level: 3 }).map((h) => h.textContent),
    ).toEqual(['Bar Mitzvah Mixed', 'Gala Long Tables', 'Wedding Rounds'])
    const upcoming = screen.getByRole('table', {
      name: 'Upcoming events in this space',
    })
    expect(within(upcoming).getByText('Dana & Yossi’s Wedding')).toBeVisible()
    expect(within(upcoming).getByText('No client yet')).toBeVisible()
  })

  it('duplicates a layout and archives it', async () => {
    renderApp('/venues/org-1/spaces/spc-1-1', withVenues())
    await screen.findByRole('list', { name: 'Layouts' })
    const card = screen
      .getByRole('heading', { level: 3, name: 'Wedding Rounds' })
      .closest('article')!
    fireEvent.click(within(card).getByRole('button', { name: 'Duplicate' }))

    expect(
      await screen.findByRole('heading', {
        level: 3,
        name: 'Wedding Rounds (2)',
      }),
    ).toBeVisible()
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Archive layout Wedding Rounds (2)',
      }),
    )
    await waitFor(() =>
      expect(
        screen.queryByRole('heading', { level: 3, name: 'Wedding Rounds (2)' }),
      ).toBeNull(),
    )
    expect(screen.getByRole('tab', { name: /^Archived\s*2$/ })).toBeVisible()
  })

  it('edits the space for new events only', async () => {
    renderApp('/venues/org-1/spaces/spc-1-1', withVenues())
    await screen.findByRole('heading', { level: 1, name: 'Main Hall' })
    fireEvent.click(screen.getByRole('button', { name: 'Edit Space' }))
    const dialog = within(screen.getByRole('dialog', { name: 'Edit Space' }))
    expect(dialog.getByText('Changes apply to new events')).toBeVisible()
    fireEvent.change(dialog.getByRole('textbox', { name: /Maximum People/ }), {
      target: { value: '380' },
    })
    fireEvent.click(dialog.getByRole('button', { name: 'Save Changes' }))

    expect(await screen.findByText('380')).toBeVisible()
  })

  it('is not found for a space of another venue', async () => {
    renderApp('/venues/org-1/spaces/spc-2-1', withVenues())
    expect(
      await screen.findByRole('heading', { name: 'Page not found' }),
    ).toBeVisible()
  })
})

describe('Team and Settings (mockups #7, #8)', () => {
  it('lets the Owner invite, change a role and remove a member', async () => {
    renderApp('/venues/org-1/team', withVenues())
    const table = await screen.findByRole('table', { name: 'Venue members' })
    expect(within(table).getByText('You')).toBeVisible()
    expect(within(table).getByText('daniel.mor@example.com')).toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: 'Invite Member' }))
    const invite = within(screen.getByRole('dialog', { name: 'Invite Member' }))
    fireEvent.change(invite.getByRole('textbox', { name: /Email/ }), {
      target: { value: 'new.person@example.com' },
    })
    fireEvent.click(invite.getByRole('button', { name: 'Send Invitation' }))
    expect(await screen.findByText('new.person@example.com')).toBeVisible()

    fireEvent.click(
      screen.getByRole('button', { name: 'Change role of Noa Barak' }),
    )
    const role = within(screen.getByRole('dialog', { name: 'Change Role' }))
    chooseOption(
      role.getByRole('combobox', { name: 'Role for Noa Barak' }),
      'VENUE_OWNER',
    )
    fireEvent.click(role.getByRole('button', { name: 'Save Role' }))
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Change Role' })).toBeNull(),
    )

    fireEvent.click(screen.getByRole('button', { name: 'Remove Eitan Shalev' }))
    fireEvent.click(
      within(screen.getByRole('dialog', { name: 'Remove member' })).getByRole(
        'button',
        { name: 'Remove' },
      ),
    )
    await waitFor(() => expect(screen.queryByText('Eitan Shalev')).toBeNull())
  })

  it('shows a Manager the team read-only, without Settings', async () => {
    renderApp('/venues/org-2/team', withVenues())
    await screen.findByRole('table', { name: 'Venue members' })

    expect(
      screen.getByText('Only the venue owner can manage the team.'),
    ).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Invite Member' })).toBeNull()
    expect(screen.queryByRole('button', { name: /^Change role/ })).toBeNull()
    expect(screen.queryByRole('link', { name: 'Settings' })).toBeNull()

    renderApp('/venues/org-2/settings', withVenues())
    expect(
      await screen.findByRole('heading', { name: 'Page not found' }),
    ).toBeVisible()
  })

  it('saves the venue’s settings, checking the contact email', async () => {
    renderApp('/venues/org-1/settings', withVenues())
    const email = await screen.findByRole('textbox', { name: 'Contact Email' })
    fireEvent.change(email, { target: { value: 'not an email' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }))
    expect(
      await screen.findByText('Enter an email address, or leave it empty'),
    ).toBeVisible()

    fireEvent.change(email, { target: { value: 'hello@example.com' } })
    fireEvent.change(screen.getByRole('textbox', { name: /Venue Name/ }), {
      target: { value: 'Grand Garden Hall & Gardens' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }))
    expect(await screen.findByText('Settings saved.')).toBeVisible()
  })
})

describe('the other states of spaces and the team', () => {
  it('shows an archived space with its notice, and restores it', async () => {
    renderApp('/venues/org-1/spaces/spc-1-4', withVenues())
    expect(await screen.findByText('This space is archived')).toBeVisible()
    expect(
      screen.queryByRole('button', { name: 'Create Event from This Layout' }),
    ).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Restore' }))
    await waitFor(() =>
      expect(screen.queryByText('This space is archived')).toBeNull(),
    )
  })

  it('lists archived layouts apart, and restores one', async () => {
    renderApp('/venues/org-1/spaces/spc-1-1', withVenues())
    await screen.findByRole('list', { name: 'Layouts' })
    fireEvent.click(screen.getByRole('tab', { name: /^Archived\s*1$/ }))
    expect(
      screen.getByRole('heading', { level: 3, name: 'Classic Rounds' }),
    ).toBeVisible()
    fireEvent.click(
      screen.getByRole('button', { name: 'Restore layout Classic Rounds' }),
    )
    await waitFor(() =>
      expect(screen.getByRole('tab', { name: /^Archived\s*0$/ })).toBeVisible(),
    )
    expect(screen.getByText('No archived layouts')).toBeVisible()
  })

  it('shows a space with no layouts and no upcoming events', async () => {
    renderApp('/venues/org-1/spaces/spc-1-3', withVenues())
    expect(await screen.findByText('No layouts yet')).toBeVisible()
    expect(
      screen.getByText('No upcoming events in this space yet.'),
    ).toBeVisible()
  })

  it('lets a Manager change spaces and layouts, as D112 allows', async () => {
    renderApp('/venues/org-2/spaces/spc-2-1', withVenues())
    await screen.findByRole('heading', { level: 1, name: 'Terrace' })
    expect(screen.getByRole('button', { name: 'Edit Space' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Duplicate' })).toBeVisible()
  })

  it('shows spaces, upcoming events and the team as cards on a phone', async () => {
    setViewportWidth(390)
    renderApp('/venues/org-1/spaces/spc-1-1', withVenues())
    const events = await screen.findByRole('list', {
      name: 'Upcoming events in this space',
    })
    expect(within(events).getByText('Dana & Yossi’s Wedding')).toBeVisible()

    renderApp('/venues/org-1/team', withVenues())
    const members = await screen.findByRole('list', { name: 'Venue members' })
    expect(within(members).getByText('daniel.mor@example.com')).toBeVisible()
  })

  it('finds members by name and role, and cancels an invitation', async () => {
    renderApp('/venues/org-1/team', withVenues())
    await screen.findByRole('table', { name: 'Venue members' })
    fireEvent.change(
      screen.getByRole('searchbox', { name: 'Search members' }),
      {
        target: { value: 'noa' },
      },
    )
    expect(screen.getByText('Showing 1 of 4 people')).toBeVisible()
    fireEvent.change(
      screen.getByRole('searchbox', { name: 'Search members' }),
      {
        target: { value: '' },
      },
    )
    chooseOption(screen.getByRole('combobox', { name: 'Role' }), 'VENUE_OWNER')
    expect(screen.getByText('Showing 1 of 4 people')).toBeVisible()
    chooseOption(screen.getByRole('combobox', { name: 'Role' }), 'all')

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Resend the invitation to daniel.mor@example.com',
      }),
    )
    expect(
      await screen.findByText(
        'Invitation sent again to daniel.mor@example.com.',
      ),
    ).toBeVisible()
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Cancel the invitation to daniel.mor@example.com',
      }),
    )
    fireEvent.click(
      within(
        screen.getByRole('dialog', { name: 'Cancel invitation' }),
      ).getByRole('button', { name: 'Cancel Invitation' }),
    )
    await waitFor(() =>
      expect(screen.queryByText('daniel.mor@example.com')).toBeNull(),
    )
  })

  it('refuses an invitation to someone already on the team', async () => {
    renderApp('/venues/org-1/team', withVenues())
    await screen.findByRole('table', { name: 'Venue members' })
    fireEvent.click(screen.getByRole('button', { name: 'Invite Member' }))
    const invite = within(screen.getByRole('dialog', { name: 'Invite Member' }))
    fireEvent.change(invite.getByRole('textbox', { name: /Email/ }), {
      target: { value: 'noa.barak@example.com' },
    })
    fireEvent.click(invite.getByRole('button', { name: 'Send Invitation' }))
    expect(
      await invite.findByText('This person is already on the venue’s team.'),
    ).toBeVisible()
    expect(screen.getByRole('dialog', { name: 'Invite Member' })).toBeVisible()
  })

  it('changes the venue’s default language', async () => {
    renderApp('/venues/org-1/settings', withVenues())
    const language = await screen.findByRole('combobox', {
      name: /Default Language/,
    })
    chooseOption(language, 'pt')
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }))
    expect(await screen.findByText('Settings saved.')).toBeVisible()
  })
})
