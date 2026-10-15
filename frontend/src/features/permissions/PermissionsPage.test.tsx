import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ltr } from '../../shared/ltr.ts'
import { changeLanguage } from '../../i18n/i18n.ts'
import type { Services } from '../../services/contracts/index.ts'
import { change, optionLabels } from '../../test/controls.ts'
import { setViewportWidth } from '../../test/matchMedia.ts'
import {
  createTestServices,
  DEMO_EVENTS,
  renderApp,
} from '../../test/renderApp.tsx'

const MAIN = DEMO_EVENTS.owner

async function openPermissions(
  eventId: string = MAIN,
  services: Services = createTestServices(),
  query = '',
) {
  const view = renderApp(`/events/${eventId}/permissions${query}`, services)
  await screen.findByRole('region', { name: 'Members by role' })
  return view
}

function membersTable() {
  return screen.getByRole('table', { name: 'Event members' })
}

function rows() {
  return within(membersTable()).getAllByRole('row').slice(1)
}

function rowOf(text: string) {
  const row = within(membersTable()).getByText(text).closest('tr')
  if (!row) {
    throw new Error(`no row for ${text}`)
  }
  return row
}

function shownEmails() {
  return rows().map(
    (row) => within(row).getAllByRole('cell')[1]?.textContent ?? '',
  )
}

function kpi(label: string) {
  const figures = screen.getByRole('region', { name: 'Members by role' })
  return within(figures)
    .getByText(label)
    .parentElement?.querySelectorAll('p')[1]?.textContent
}

function dialog() {
  return within(screen.getByRole('dialog'))
}

async function invite(email: string, role?: string) {
  fireEvent.click(screen.getByRole('button', { name: 'Invite User' }))
  change(dialog().getByLabelText(/^Email/), { target: { value: email } })
  if (role) {
    change(dialog().getByRole('combobox', { name: 'Permission Type' }), {
      target: { value: role },
    })
  }
  fireEvent.click(dialog().getByRole('button', { name: 'Invite' }))
}

describe('Permissions page', () => {
  it('lists members with role counts, the user’s own line and a pending invitation', async () => {
    await openPermissions()

    expect(kpi('Owners')).toBe('1')
    expect(kpi('Admins')).toBe('2')
    expect(kpi('Viewers')).toBe('3')
    expect(rows()).toHaveLength(7)
    expect(
      within(membersTable())
        .getAllByRole('columnheader')
        .map((heading) => heading.textContent),
    ).toEqual(['Name', 'Email', 'Permission Type', 'Actions'])

    const own = within(rowOf('Alex Morgan'))
    expect(own.getByText('You')).toBeInTheDocument()
    expect(own.getByText('Owner')).toBeInTheDocument()
    expect(own.queryByRole('button')).not.toBeInTheDocument()

    const pending = within(rowOf('morgan.reed@example.com'))
    expect(pending.getByText('Pending')).toBeInTheDocument()
    expect(pending.getByText('No account yet')).toBeInTheDocument()
    expect(
      pending.getByRole('button', {
        name: 'Cancel the invitation of morgan.reed@example.com',
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/A Viewer can view the event and download exports/),
    ).toBeInTheDocument()
  })

  it('searches by name or email and filters by role, kept in the address', async () => {
    const { router } = await openPermissions()

    change(screen.getByRole('searchbox', { name: 'Search members' }), {
      target: { value: 'KELLER' },
    })
    await waitFor(() =>
      expect(shownEmails()).toEqual(['sam.keller@example.com']),
    )
    expect(router.state.location.search).toBe('?q=KELLER')

    change(screen.getByRole('searchbox', { name: 'Search members' }), {
      target: { value: '' },
    })
    change(screen.getByRole('combobox', { name: 'Role' }), {
      target: { value: 'VIEWER' },
    })
    await waitFor(() => expect(rows()).toHaveLength(4))
    expect(router.state.location.search).toBe('?role=VIEWER')

    change(screen.getByRole('searchbox', { name: 'Search members' }), {
      target: { value: 'nobody at all' },
    })
    expect(await screen.findByText('No members match')).toBeInTheDocument()
  })

  it('reads the search and role from the address', async () => {
    await openPermissions(MAIN, undefined, '?role=ADMIN&q=jordan')

    expect(shownEmails()).toEqual(['jordan.hale@example.com'])
  })

  it('gives an existing account access at once', async () => {
    await openPermissions()

    await invite('jamie.rhodes@example.com', 'ADMIN')

    expect(
      await screen.findByText('Jamie Rhodes now has access to the event.'),
    ).toBeInTheDocument()
    await waitFor(() => expect(kpi('Admins')).toBe('3'))
    expect(within(rowOf('Jamie Rhodes')).getByText('Admin')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('keeps an unknown email as a pending invitation, which can be changed and cancelled', async () => {
    await openPermissions()

    await invite('New.Person@Example.com')

    expect(
      await screen.findByText(
        `${ltr('new.person@example.com')} is invited and will get access after signing up.`,
      ),
    ).toBeInTheDocument()
    await waitFor(() => expect(rows()).toHaveLength(8))
    const row = () => within(rowOf('new.person@example.com'))
    expect(row().getByText('Pending')).toBeInTheDocument()
    expect(row().getByText('Viewer')).toBeInTheDocument()
    // A pending invitation is not a member.
    expect(kpi('Viewers')).toBe('3')

    fireEvent.click(
      row().getByRole('button', {
        name: 'Change role of new.person@example.com',
      }),
    )
    change(dialog().getByRole('combobox', { name: 'Permission Type' }), {
      target: { value: 'OWNER' },
    })
    fireEvent.click(dialog().getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(row().getByText('Owner')).toBeInTheDocument())
    expect(kpi('Owners')).toBe('1')

    fireEvent.click(
      row().getByRole('button', {
        name: 'Cancel the invitation of new.person@example.com',
      }),
    )
    expect(dialog().getByText('Cancel invitation?')).toBeInTheDocument()
    fireEvent.click(dialog().getByRole('button', { name: 'Cancel Invitation' }))
    await waitFor(() => expect(rows()).toHaveLength(7))
  })

  it('explains an email that is not valid, already a member or already invited', async () => {
    await openPermissions()

    await invite('not an email')
    expect(
      await dialog().findByText('Enter a valid email address.'),
    ).toBeInTheDocument()

    const email = dialog().getByLabelText(/^Email/)
    change(email, { target: { value: '' } })
    fireEvent.click(dialog().getByRole('button', { name: 'Invite' }))
    expect(dialog().getByText('Enter a valid email address.')).toBeVisible()

    change(email, { target: { value: 'jordan.hale@example.com' } })
    fireEvent.click(dialog().getByRole('button', { name: 'Invite' }))
    expect(
      await dialog().findByText('This person already has access to the event.'),
    ).toBeInTheDocument()

    change(email, { target: { value: 'morgan.reed@example.com' } })
    fireEvent.click(dialog().getByRole('button', { name: 'Invite' }))
    expect(
      await dialog().findByText('This email has already been invited.'),
    ).toBeInTheDocument()
    expect(rows()).toHaveLength(7)
  })

  it('changes a member’s role and removes a member after confirmation', async () => {
    await openPermissions()

    fireEvent.click(
      within(rowOf('Casey Owens')).getByRole('button', {
        name: 'Change role of Casey Owens',
      }),
    )
    expect(
      dialog().getByText('Can view the event and download exports.'),
    ).toBeInTheDocument()
    change(dialog().getByRole('combobox', { name: 'Permission Type' }), {
      target: { value: 'ADMIN' },
    })
    fireEvent.click(dialog().getByRole('button', { name: 'Save' }))

    expect(
      await screen.findByText('Casey Owens is now Admin.'),
    ).toBeInTheDocument()
    await waitFor(() => expect(kpi('Admins')).toBe('3'))
    expect(kpi('Viewers')).toBe('2')

    fireEvent.click(
      within(rowOf('Casey Owens')).getByRole('button', {
        name: 'Remove Casey Owens',
      }),
    )
    expect(
      dialog().getByText(
        'Casey Owens will no longer be able to open this event.',
      ),
    ).toBeInTheDocument()
    fireEvent.click(dialog().getByRole('button', { name: 'Cancel' }))
    expect(rows()).toHaveLength(7)

    fireEvent.click(
      within(rowOf('Casey Owens')).getByRole('button', {
        name: 'Remove Casey Owens',
      }),
    )
    fireEvent.click(dialog().getByRole('button', { name: 'Remove' }))
    await waitFor(() => expect(rows()).toHaveLength(6))
    expect(kpi('Admins')).toBe('2')
  })

  it('closes the role dialog without a request when nothing changed', async () => {
    await openPermissions()

    fireEvent.click(
      within(rowOf('Casey Owens')).getByRole('button', {
        name: 'Change role of Casey Owens',
      }),
    )
    fireEvent.click(dialog().getByRole('button', { name: 'Save' }))

    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    )
    expect(screen.queryByText(/is now/)).not.toBeInTheDocument()
  })

  it('limits an Admin to Admins and Viewers', async () => {
    await openPermissions(DEMO_EVENTS.admin)

    const owner = rows().find((row) => within(row).queryByText('Owner'))
    const viewer = rows().find((row) => within(row).queryByText('Viewer'))
    expect(within(owner!).queryByRole('button')).not.toBeInTheDocument()
    expect(within(viewer!).getAllByRole('button')).toHaveLength(2)
    expect(within(rowOf('Alex Morgan')).getByText('You')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Invite User' }))
    expect(
      optionLabels(dialog().getByRole('combobox', { name: 'Permission Type' })),
    ).toEqual(['Admin', 'Viewer'])
  })

  it('shows a failure of the change inside the dialog', async () => {
    const services = createTestServices({
      failOperations: new Set(['permissions.revoke', 'permissions.changeRole']),
    })
    await openPermissions(MAIN, services)

    fireEvent.click(
      within(rowOf('Casey Owens')).getByRole('button', {
        name: 'Remove Casey Owens',
      }),
    )
    fireEvent.click(dialog().getByRole('button', { name: 'Remove' }))
    expect(await dialog().findByRole('alert')).toHaveTextContent(
      'The service is not available right now.',
    )
    fireEvent.click(dialog().getByRole('button', { name: 'Cancel' }))

    fireEvent.click(
      within(rowOf('Casey Owens')).getByRole('button', {
        name: 'Change role of Casey Owens',
      }),
    )
    change(dialog().getByRole('combobox', { name: 'Permission Type' }), {
      target: { value: 'ADMIN' },
    })
    fireEvent.click(dialog().getByRole('button', { name: 'Save' }))
    expect(await dialog().findByRole('alert')).toHaveTextContent(
      'The service is not available right now.',
    )
    expect(rows()).toHaveLength(7)
  })

  it('shows an error with a retry when the list cannot be loaded', async () => {
    const services = createTestServices({
      failOperations: new Set(['permissions.list']),
    })
    renderApp(`/events/${MAIN}/permissions`, services)

    expect(
      await screen.findByText(
        'The service is not available right now. Please try again.',
      ),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Invite User' })).toBeDisabled()
  })
})

describe('Permissions page: who may do what', () => {
  it('refuses a Viewer who opens the address', async () => {
    renderApp(`/events/${DEMO_EVENTS.viewer}/permissions`)

    expect(
      await screen.findByText('You cannot open this page'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Invite User' }),
    ).not.toBeInTheDocument()
  })

  it('lets an Owner manage a past event', async () => {
    await openPermissions(DEMO_EVENTS.past)

    expect(
      screen.getByRole('button', { name: 'Invite User' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByText(/Only an Owner can change the permissions/),
    ).not.toBeInTheDocument()
    expect(
      rows().some((row) => within(row).queryAllByRole('button').length === 2),
    ).toBe(true)
  })

  it('shows a past event read-only to an Admin', async () => {
    const services = createTestServices()
    await services.demo?.setRole('ADMIN')
    await openPermissions(DEMO_EVENTS.past, services)

    expect(
      screen.getByText(/Only an Owner can change the permissions/),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Invite User' }),
    ).not.toBeInTheDocument()
    expect(within(membersTable()).queryByRole('button')).not.toBeInTheDocument()
    expect(rows().length).toBeGreaterThan(0)
  })

  it('says when a role is simulated, and follows it', async () => {
    const services = createTestServices()
    await services.demo?.setRole('ADMIN')
    await openPermissions(MAIN, services)

    expect(screen.getByText('Demo: Simulate Admin')).toBeInTheDocument()
    // The stored permission is shown; the simulated one decides the actions.
    expect(within(rowOf('Alex Morgan')).getByText('Owner')).toBeInTheDocument()
    expect(within(rowOf('Jordan Hale')).getAllByRole('button')).toHaveLength(2)
  })

  it('lets a simulated Super User manage an event they only view', async () => {
    const services = createTestServices()
    await services.demo?.setRole('SUPER_USER')
    await openPermissions(DEMO_EVENTS.viewer, services)

    const owner = rows().find((row) => within(row).queryByText('Owner'))
    expect(within(owner!).getAllByRole('button')).toHaveLength(2)

    // The only Owner cannot be removed, whoever asks.
    fireEvent.click(within(owner!).getByRole('button', { name: /^Remove/ }))
    fireEvent.click(dialog().getByRole('button', { name: 'Remove' }))
    expect(await dialog().findByRole('alert')).toHaveTextContent(
      'An event must keep at least one Owner.',
    )
  })
})

describe('Permissions page: phone and Hebrew', () => {
  it('shows members as cards with the same actions on a phone', async () => {
    setViewportWidth(400)
    await openPermissions()

    const list = screen.getByRole('list', { name: 'Event members' })
    const cards = within(list).getAllByRole('listitem')
    expect(cards).toHaveLength(7)
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(within(cards[0]!).getByText('You')).toBeInTheDocument()

    const casey = cards.find((card) => within(card).queryByText('Casey Owens'))
    fireEvent.click(
      within(casey!).getByRole('button', { name: 'Remove Casey Owens' }),
    )
    fireEvent.click(dialog().getByRole('button', { name: 'Remove' }))
    await waitFor(() =>
      expect(within(list).getAllByRole('listitem')).toHaveLength(6),
    )
  })

  it('is translated to Hebrew', async () => {
    await changeLanguage('he')
    renderApp(`/events/${MAIN}/permissions`)

    expect(
      await screen.findByRole('heading', { name: 'הרשאות', level: 1 }),
    ).toBeInTheDocument()
    expect(
      await screen.findByRole('button', { name: 'הזמנת משתמש' }),
    ).toBeInTheDocument()
    expect(await screen.findByText('ממתין')).toBeInTheDocument()
    expect(document.documentElement.dir).toBe('rtl')
  })
})
