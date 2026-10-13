import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { guestFullName } from '../../domain/guestList.ts'
import { renderMessage } from '../../domain/messages.ts'
import { changeLanguage } from '../../i18n/i18n.ts'
import type { Services } from '../../services/contracts/index.ts'
import { setViewportWidth } from '../../test/matchMedia.ts'
import {
  createTestServices,
  DEMO_EVENTS,
  renderApp,
  TEST_NOW,
} from '../../test/renderApp.tsx'
import { change } from '../../test/controls.ts'

const MAIN = DEMO_EVENTS.owner
let open: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  open = vi.spyOn(window, 'open').mockImplementation(() => null)
})

afterEach(() => {
  open.mockRestore()
})

async function openMessages(
  eventId: string = MAIN,
  services: Services = createTestServices(),
) {
  const view = renderApp(`/events/${eventId}/messages`, services)
  await screen.findByRole('heading', { name: 'Message Template' })
  await preview()
  return view
}

function editor(): HTMLTextAreaElement {
  return screen.getByRole('textbox', { name: /^Message/ })
}

function type(text: string) {
  change(editor(), { target: { value: text } })
}

/** The phone preview, once the guest's details have loaded. */
function preview() {
  return screen.findByRole('group', { name: 'WhatsApp preview' })
}

async function firstGuest(services: Services, eventId: string = MAIN) {
  const guests = await services.guests.list(eventId)
  return guests.sort((a, b) =>
    guestFullName(a).localeCompare(guestFullName(b)),
  )[0]!
}

function sentRows() {
  return within(screen.getByRole('table', { name: 'Recent Sent Messages' }))
    .getAllByRole('row')
    .slice(1)
}

describe('WhatsApp Messages', () => {
  it('shows the saved template, its preview for a guest, and what was sent', async () => {
    const { services } = await openMessages()
    const template = await services.messages.getTemplate(MAIN)
    const guest = await firstGuest(services)
    const values = await services.messages.getValues(MAIN, guest.id)
    const sends = await services.messages.listSends(MAIN)

    expect(editor()).toHaveValue(template.body)
    expect(screen.getByLabelText('Preview for')).toHaveValue(
      guestFullName(guest),
    )
    const phone = await preview()
    expect(within(phone).getByText(guestFullName(guest))).toBeInTheDocument()
    expect(phone.querySelector('p[dir="auto"]')).toHaveTextContent(
      renderMessage(template.body, values).replace(/\s+/g, ' ').trim(),
    )
    expect(sentRows()).toHaveLength(10)
    expect(
      within(sentRows()[0]!).getByText(sends[0]!.guestName),
    ).toBeInTheDocument()
    expect(
      within(sentRows()[0]!).getByText('Opened WhatsApp'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save Changes' })).toBeDisabled()
  })

  it('keeps the preview in step with the editor and the chosen guest', async () => {
    const { services } = await openMessages()
    const guests = await services.guests.list(MAIN)
    const other = guests.find((guest) => guest.lastName !== '')!

    type('Dear {{first_name}} {{last_name}}, see {{nothing}}')
    const phone = await preview()
    const first = await firstGuest(services)
    expect(
      within(phone).getByText(
        `Dear ${first.firstName} ${first.lastName}, see {{nothing}}`,
      ),
    ).toBeInTheDocument()

    change(screen.getByLabelText('Preview for'), {
      target: { value: other.id },
    })

    expect(
      await screen.findByText(
        `Dear ${other.firstName} ${other.lastName}, see {{nothing}}`,
      ),
    ).toBeInTheDocument()
  })

  it('finds the guest to preview by typing part of their name', async () => {
    const { services } = await openMessages()
    const guests = await services.guests.list(MAIN)
    const first = await firstGuest(services)
    const wanted = guests.find(
      (guest) =>
        guest.id !== first.id &&
        guests.filter((other) => other.lastName === guest.lastName).length ===
          1,
    )!
    const field = screen.getByLabelText('Preview for')

    fireEvent.click(field)
    expect(screen.getAllByRole('option')).toHaveLength(guests.length)

    fireEvent.change(field, {
      target: { value: wanted.lastName.toUpperCase() },
    })
    expect(
      screen.getAllByRole('option').map((option) => option.textContent),
    ).toEqual([guestFullName(wanted)])

    fireEvent.keyDown(field, { key: 'Enter' })
    expect(field).toHaveValue(guestFullName(wanted))
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(
      await within(await preview()).findByText(guestFullName(wanted)),
    ).toBeInTheDocument()

    // Text that matches nobody says so, and leaving restores the choice.
    fireEvent.change(field, { target: { value: 'zzzz' } })
    expect(screen.getByText('No guest matches')).toBeInTheDocument()
    expect(screen.queryByRole('option')).not.toBeInTheDocument()
    fireEvent.keyDown(field, { key: 'Escape' })
    expect(field).toHaveValue(guestFullName(wanted))
  })

  it('formats the selection, and inserts variables and emoji at the cursor', async () => {
    await openMessages()
    type('Hello friend')
    editor().setSelectionRange(6, 12)

    fireEvent.click(screen.getByRole('button', { name: 'Bold' }))
    expect(editor()).toHaveValue('Hello *friend*')
    expect(editor().selectionStart).toBe(7)
    expect((await preview()).querySelector('strong')).toHaveTextContent(
      'friend',
    )

    fireEvent.click(screen.getByRole('button', { name: 'Bold' }))
    expect(editor()).toHaveValue('Hello friend')

    fireEvent.click(screen.getByRole('button', { name: 'Italic' }))
    expect(editor()).toHaveValue('Hello _friend_')
    expect((await preview()).querySelector('em')).toHaveTextContent('friend')

    type('Hello ')
    editor().setSelectionRange(6, 6)
    fireEvent.click(
      screen.getByRole('button', { name: 'Insert {{first_name}}' }),
    )
    expect(editor()).toHaveValue('Hello {{first_name}}')
    expect(editor()).toHaveFocus()

    fireEvent.click(screen.getByRole('button', { name: 'Insert emoji' }))
    fireEvent.click(screen.getByRole('button', { name: 'Insert 🎉' }))
    expect(editor()).toHaveValue('Hello {{first_name}}🎉')

    type('gone')
    editor().setSelectionRange(0, 4)
    fireEvent.click(screen.getByRole('button', { name: 'Strikethrough' }))
    expect((await preview()).querySelector('s')).toHaveTextContent('gone')
  })

  it('saves a changed message', async () => {
    const { services } = await openMessages()

    type('See you there, {{first_name}}! {{rsvp_url}}')
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }))

    expect(await screen.findByText('Message saved.')).toBeInTheDocument()
    expect((await services.messages.getTemplate(MAIN)).body).toBe(
      'See you there, {{first_name}}! {{rsvp_url}}',
    )
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Save Changes' }),
      ).toBeDisabled(),
    )
  })

  it.each([
    ['   ', 'Write a message before saving.'],
    ['x'.repeat(1001), 'The message can be up to 1,000 characters.'],
  ])('refuses a message that is empty or too long', async (text, message) => {
    const { services } = await openMessages()
    const before = (await services.messages.getTemplate(MAIN)).body

    type(text)
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }))

    expect(await screen.findByText(message)).toBeInTheDocument()
    expect(editor()).toHaveFocus()
    expect((await services.messages.getTemplate(MAIN)).body).toBe(before)
  })

  it('warns about a missing RSVP link and about words that are not variables', async () => {
    await openMessages()
    expect(
      screen.queryByText('The message has no RSVP link'),
    ).not.toBeInTheDocument()

    type('Hi {{name}}, come!')

    expect(screen.getByText('The message has no RSVP link')).toBeInTheDocument()
    expect(
      screen.getByText('These will be sent exactly as written: {{name}}'),
    ).toBeInTheDocument()
  })

  it('reports a failed save and keeps the text', async () => {
    await openMessages(
      MAIN,
      createTestServices({
        failOperations: new Set(['messages.updateTemplate']),
      }),
    )

    type('Not saved {{rsvp_url}}')
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }))

    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(editor()).toHaveValue('Not saved {{rsvp_url}}')
  })

  it('resets the text to the default message, to be saved or not', async () => {
    const { services } = await openMessages()
    const original = await services.messages.getDefaultTemplate(MAIN)
    type('Something else')

    fireEvent.click(screen.getByRole('button', { name: 'Reset to Default' }))

    await waitFor(() => expect(editor()).toHaveValue(original))
  })

  it('sends a test through WhatsApp with no recipient, recording nothing', async () => {
    const { services } = await openMessages()
    const guest = await firstGuest(services)
    const before = await services.messages.listSends(MAIN)
    type('Test for {{first_name}}?')
    await screen.findByText(`Test for ${guest.firstName}?`)

    fireEvent.click(screen.getByRole('button', { name: 'Send Test Message' }))

    expect(open).toHaveBeenCalledExactlyOnceWith(
      `https://wa.me/?text=${encodeURIComponent(`Test for ${guest.firstName}?`)}`,
      '_blank',
      'noopener,noreferrer',
    )
    expect(await services.messages.listSends(MAIN)).toHaveLength(before.length)
    expect(
      (await services.guests.list(MAIN)).find((item) => item.id === guest.id)
        ?.invitationSentCount,
    ).toBe(guest.invitationSentCount)
  })

  it('pages through the sent messages and shows one in full', async () => {
    const { services } = await openMessages()
    const sends = await services.messages.listSends(MAIN)
    expect(sends.length).toBeGreaterThan(10)

    fireEvent.click(
      within(
        screen.getByRole('navigation', { name: 'Sent message pages' }),
      ).getByRole('button', { name: 'Page 2' }),
    )
    expect(
      within(sentRows()[0]!).getByText(sends[10]!.guestName),
    ).toBeInTheDocument()

    fireEvent.click(
      within(sentRows()[0]!).getByRole('button', {
        name: `Actions for the message to ${sends[10]!.guestName}`,
      }),
    )
    fireEvent.click(screen.getByRole('menuitem', { name: 'View message' }))

    const dialog = await screen.findByRole('dialog', {
      name: `Message to ${sends[10]!.guestName}`,
    })
    expect(dialog.querySelector('p[dir="auto"]')?.textContent).toBe(
      sends[10]!.message,
    )
  })

  it('sends again to a guest from the list, counting a new send', async () => {
    const { services } = await openMessages()
    const [latest] = await services.messages.listSends(MAIN)
    const before = (await services.guests.list(MAIN)).find(
      (guest) => guest.id === latest!.guestId,
    )!
    const total = (await services.messages.listSends(MAIN)).length

    fireEvent.click(
      within(sentRows()[0]!).getByRole('button', {
        name: `Actions for the message to ${latest!.guestName}`,
      }),
    )
    fireEvent.click(screen.getByRole('menuitem', { name: 'Send again' }))
    const dialog = await screen.findByRole('dialog', {
      name: 'Send WhatsApp message',
    })
    fireEvent.click(
      await within(dialog).findByRole('button', { name: 'Open WhatsApp' }),
    )

    await waitFor(() => expect(open).toHaveBeenCalledTimes(1))
    expect(open.mock.calls[0]?.[0]).toMatch(
      new RegExp(`^https://wa\\.me/${before.normalizedPhone.slice(1)}\\?text=`),
    )
    await screen.findByText(`WhatsApp opened for ${latest!.guestName}.`)
    expect(await services.messages.listSends(MAIN)).toHaveLength(total + 1)
    expect(
      (await services.guests.list(MAIN)).find((guest) => guest.id === before.id)
        ?.invitationSentCount,
    ).toBe(before.invitationSentCount + 1)
  })

  it.each([
    [DEMO_EVENTS.viewer, 'View-only access'],
    [DEMO_EVENTS.past, 'This event has ended'],
  ])('is read-only for %s', async (eventId, notice) => {
    await openMessages(eventId)

    expect(screen.getByText(notice)).toBeInTheDocument()
    expect(editor()).toHaveAttribute('readonly')
    for (const name of [
      'Save Changes',
      'Send Test Message',
      'Bold',
      'Reset to Default',
      'Insert {{first_name}}',
    ]) {
      expect(screen.queryByRole('button', { name })).not.toBeInTheDocument()
    }
    expect(screen.getByText('Available Variables')).toBeInTheDocument()

    const menus = screen.queryAllByRole('button', {
      name: /^Actions for the message to/,
    })
    if (menus[0]) {
      fireEvent.click(menus[0])
      expect(
        screen.getByRole('menuitem', { name: 'View message' }),
      ).toBeInTheDocument()
      expect(
        screen.queryByRole('menuitem', { name: 'Send again' }),
      ).not.toBeInTheDocument()
    }
  })

  it('previews with a sample guest and invites sending when the event is new', async () => {
    const services = createTestServices()
    const event = await services.events.create({
      name: 'Fresh Start',
      startsAt: new Date(TEST_NOW.getTime() + 30 * 86_400_000).toISOString(),
      timeZone: 'Asia/Jerusalem',
      maxAttendees: 100,
      defaultAllowedAttendees: 2,
      rsvpLanguage: 'en',
    })

    await openMessages(event.id, services)

    expect(
      screen.getByText(
        'This event has no guests yet, so a sample guest is shown.',
      ),
    ).toBeInTheDocument()
    expect(screen.queryByLabelText('Preview for')).not.toBeInTheDocument()
    expect(within(await preview()).getByText(/Hello Dana,/)).toBeInTheDocument()
    expect(screen.getByText('No messages sent yet')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Go to Guests' })).toHaveAttribute(
      'href',
      `/events/${event.id}/guests`,
    )
  })

  it('splits into Message Editor and Preview tabs on a phone', async () => {
    setViewportWidth(400)
    renderApp(`/events/${MAIN}/messages`)
    await screen.findByRole('heading', { name: 'Message Template' })
    const bar = screen.getByRole('region', { name: 'Page actions' })

    expect(screen.getByRole('tab', { name: 'Message Editor' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    expect(
      within(bar)
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual(['Send Test Message', 'Save Changes'])
    expect(
      screen.queryByRole('heading', { name: 'Message Preview' }),
    ).not.toBeInTheDocument()

    type('Phone draft')
    fireEvent.click(screen.getByRole('tab', { name: 'Preview' }))

    expect(await screen.findByText('Phone draft')).toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: 'Message Template' }),
    ).not.toBeInTheDocument()
    expect(
      within(bar)
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual(['Back to Editor', 'Send Test Message'])

    fireEvent.click(within(bar).getByRole('button', { name: 'Back to Editor' }))

    expect(editor()).toHaveValue('Phone draft')
  })

  it('asks before leaving with an unsaved message', async () => {
    const { router } = await openMessages()

    fireEvent.click(screen.getByRole('link', { name: 'Guests' }))
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`/events/${MAIN}/guests`),
    )
    await router.navigate(`/events/${MAIN}/messages`)
    await screen.findByRole('heading', { name: 'Message Template' })

    type('Unsaved')
    fireEvent.click(screen.getByRole('link', { name: 'Guests' }))

    expect(
      await screen.findByRole('dialog', { name: 'Leave without saving?' }),
    ).toBeInTheDocument()
    expect(router.state.location.pathname).toBe(`/events/${MAIN}/messages`)
  })

  it('is translated to Hebrew', async () => {
    await openMessages()

    await changeLanguage('he')

    expect(
      await screen.findByRole('heading', { name: 'תבנית ההודעה' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'שליחת הודעת בדיקה' }),
    ).toBeInTheDocument()
    await changeLanguage('en')
  })
})
