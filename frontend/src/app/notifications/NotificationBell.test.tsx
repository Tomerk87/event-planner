import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { changeLanguage } from '../../i18n/i18n.ts'
import {
  createTestServices,
  DEMO_EVENTS,
  renderApp,
} from '../../test/renderApp.tsx'
import { isolate } from '../../shared/ltr.ts'

async function openBell() {
  const bell = await screen.findByRole('button', {
    name: /^Notifications, \d+ unread$/,
  })
  fireEvent.click(bell)
  return screen.getByRole('group', { name: bell.getAttribute('aria-label')! })
}

describe('notification bell (D95)', () => {
  it('lists the visitor’s notices, newest first, with the unread count', async () => {
    const services = createTestServices()
    const { items, unread } = await services.notifications.list()
    expect(unread).toBeGreaterThan(0)
    renderApp('/events', services)

    const panel = await openBell()
    expect(
      screen.getByRole('button', { name: `Notifications, ${unread} unread` }),
    ).toHaveAttribute('aria-expanded', 'true')
    expect(within(panel).getAllByRole('listitem')).toHaveLength(items.length)
    // Access given to an event the visitor does not own, by its Owner.
    const { event } = await services.events.get(DEMO_EVENTS.admin)
    expect(
      within(panel).getByText(
        new RegExp(`gave you Admin access to ${isolate(event.name)}\\.$`),
      ),
    ).toBeInTheDocument()
    // Answers from unknown phones on an event the visitor manages.
    const main = (await services.events.get(DEMO_EVENTS.owner)).event
    expect(
      within(panel).getByRole('link', {
        name: new RegExp(`wait for review in ${isolate(main.name)}`),
      }),
    ).toHaveAttribute('href', `/events/${DEMO_EVENTS.owner}/guests?tab=unknown`)
  })

  it('opens a notice, marking it read, and marks the rest read at once', async () => {
    const services = createTestServices()
    const { unread } = await services.notifications.list()
    const { router } = renderApp('/events', services)
    const main = (await services.events.get(DEMO_EVENTS.owner)).event

    const panel = await openBell()
    fireEvent.click(
      within(panel).getByRole('link', {
        name: new RegExp(`wait for review in ${isolate(main.name)}`),
      }),
    )

    await waitFor(() =>
      expect(router.state.location.pathname).toBe(
        `/events/${DEMO_EVENTS.owner}/guests`,
      ),
    )
    expect(screen.queryByRole('group', { name: /^Notifications/ })).toBeNull()
    expect(
      await screen.findByRole('button', {
        name:
          unread === 1
            ? 'Notifications'
            : `Notifications, ${unread - 1} unread`,
      }),
    ).toBeInTheDocument()

    if (unread > 1) {
      fireEvent.click(
        within(await openBell()).getByRole('button', {
          name: 'Mark all as read',
        }),
      )
    }
    expect(
      await screen.findByRole('button', { name: 'Notifications' }),
    ).toBeInTheDocument()
    expect((await services.notifications.list()).unread).toBe(0)
  })

  it('keeps read notices, says when there are none, and is translated', async () => {
    const services = createTestServices()
    await services.notifications.markRead()
    renderApp('/events', services)

    fireEvent.click(
      await screen.findByRole('button', { name: 'Notifications' }),
    )
    expect((await screen.findAllByRole('listitem')).length).toBeGreaterThan(0)
    expect(screen.queryByText('No notifications yet.')).toBeNull()
    expect(
      screen.queryByRole('button', { name: 'Mark all as read' }),
    ).toBeNull()

    await changeLanguage('he')
    expect(
      await screen.findByRole('heading', { name: 'התראות' }),
    ).toBeInTheDocument()
    await changeLanguage('en')
  })

  it('says so when the account has no notices', async () => {
    const services = createTestServices()
    services.notifications.list = () =>
      Promise.resolve({ items: [], unread: 0 })
    renderApp('/events', services)

    fireEvent.click(
      await screen.findByRole('button', { name: 'Notifications' }),
    )
    expect(await screen.findByText('No notifications yet.')).toBeInTheDocument()
  })
})
