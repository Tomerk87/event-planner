import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { parseCsv } from '../../domain/csv.ts'
import { guestFullName } from '../../domain/guestList.ts'
import { listGroups } from '../../domain/guests.ts'
import type { Guest } from '../../domain/models.ts'
import { changeLanguage } from '../../i18n/i18n.ts'
import type { Services } from '../../services/contracts/index.ts'
import { setViewportWidth } from '../../test/matchMedia.ts'
import {
  createTestServices,
  DEMO_EVENTS,
  renderApp,
} from '../../test/renderApp.tsx'
import { change, optionLabels } from '../../test/controls.ts'

const downloads: { name: string; blob: Blob }[] = []

vi.mock('../../shared/download.ts', async (original) => ({
  ...(await original<typeof import('../../shared/download.ts')>()),
  downloadBlob: (blob: Blob, name: string) => {
    downloads.push({ name, blob })
  },
}))

const MAIN = DEMO_EVENTS.owner

beforeEach(() => {
  downloads.length = 0
})

async function openGuests(
  query = '',
  services: Services = createTestServices(),
  eventId: string = MAIN,
) {
  const view = renderApp(`/events/${eventId}/guests${query}`, services)
  await screen.findByRole('region', { name: 'Guest figures' })
  return view
}

function guestTable() {
  return screen.getByRole('table', { name: 'Guests' })
}

function rows() {
  return within(guestTable()).getAllByRole('row').slice(1)
}

function shownNames() {
  return rows().map(
    (row) => within(row).getAllByRole('button')[0]?.textContent ?? '',
  )
}

function rowOf(name: string) {
  const row = within(guestTable()).getByRole('button', { name }).closest('tr')
  if (!row) {
    throw new Error(`no row for ${name}`)
  }
  return row
}

function kpi(label: string) {
  const figures = screen.getByRole('region', { name: 'Guest figures' })
  return within(figures)
    .getByText(label)
    .parentElement?.querySelectorAll('p')[1]?.textContent
}

function tabCount(label: string) {
  return screen.getByRole('tab', { name: new RegExp(`^${label}`) }).textContent
}

async function lastDownload() {
  await waitFor(() => expect(downloads.length).toBeGreaterThan(0))
  const { name, blob } = downloads[downloads.length - 1]!
  return { name, rows: parseCsv(await blob.text()) }
}

function search(text: string) {
  change(screen.getByRole('searchbox', { name: 'Search guests' }), {
    target: { value: text },
  })
}

function fillGuestForm(
  dialog: HTMLElement,
  values: {
    firstName?: string
    lastName?: string
    phone?: string
    allowed?: string
  },
) {
  const fields = within(dialog)
  const set = (label: RegExp, value: string | undefined) => {
    if (value !== undefined) {
      change(fields.getByLabelText(label), { target: { value } })
    }
  }
  set(/First Name/, values.firstName)
  set(/Last Name/, values.lastName)
  set(/Phone Number/, values.phone)
  set(/Expected Attendees/, values.allowed)
}

async function find(
  services: Services,
  test: (guest: Guest) => boolean,
  eventId: string = MAIN,
) {
  const guest = (await services.guests.list(eventId)).find(test)
  if (!guest) {
    throw new Error('no such guest in the demo data')
  }
  return guest
}

function openRowMenu(name: string, item: string) {
  fireEvent.click(
    within(rowOf(name)).getByRole('button', {
      name: `More actions for ${name}`,
    }),
  )
  fireEvent.click(screen.getByRole('menuitem', { name: item }))
}

/** Opens a guest's edit form from the first item of the row's ⋯ menu. */
function openEditGuest(row: HTMLElement, name: string) {
  fireEvent.click(
    within(row).getByRole('button', { name: `More actions for ${name}` }),
  )
  const items = screen.getAllByRole('menuitem')
  expect(items[0]).toHaveTextContent('Edit Guest')
  fireEvent.click(items[0]!)
}

describe('Guests list', () => {
  it('shows the figures, both tabs and the first page of guests by name', async () => {
    const { services } = await openGuests()
    const guests = await services.guests.list(MAIN)

    expect(kpi('Total Guests')).toBe(String(guests.length))
    expect(kpi('Not Sent')).toBe(
      String(guests.filter((guest) => guest.invitationSentCount === 0).length),
    )
    // People who confirmed, not invitations: the Dashboard's figure.
    expect(kpi('Approved')).toBe(
      String(
        guests.reduce((sum, guest) => sum + (guest.confirmedAttendees ?? 0), 0),
      ),
    )
    expect(tabCount('Guests')).toBe(`Guests${guests.length}`)
    expect(tabCount('Unknown Guests')).toBe('Unknown Guests8')
    expect(shownNames()).toHaveLength(10)
    expect(shownNames()).toEqual(
      [...shownNames()].sort((a, b) => a.localeCompare(b)),
    )
    expect(
      screen.getByText(`1–10 of ${guests.length} guests`),
    ).toBeInTheDocument()
    expect(
      within(guestTable()).getByRole('columnheader', { name: /^Name/ }),
    ).toHaveAttribute('aria-sort', 'ascending')
  })

  it('labels a guest who was never invited Not Sent, and an invited one Awaiting Response', async () => {
    const services = createTestServices()
    const notSent = await find(
      services,
      (guest) =>
        guest.invitationSentCount === 0 && guest.rsvpStatus === 'NO_RESPONSE',
    )
    const awaiting = await find(
      services,
      (guest) =>
        guest.invitationSentCount > 0 && guest.rsvpStatus === 'NO_RESPONSE',
    )

    await openGuests(`?q=${encodeURIComponent(notSent.phone)}`, services)
    expect(within(rows()[0]!).getByText('Not Sent')).toBeInTheDocument()

    search(awaiting.phone)
    expect(
      within(rows()[0]!).getByText('Awaiting Response'),
    ).toBeInTheDocument()
  })

  it('searches by name and by phone in any format, and keeps the search in the address', async () => {
    const services = createTestServices()
    const guest = await find(services, () => true)
    const { router } = await openGuests('', services)

    search(guestFullName(guest).toUpperCase())
    expect(shownNames()).toEqual([guestFullName(guest)])
    expect(router.state.location.search).toContain('q=')

    search(guest.normalizedPhone.replace('+972', '0'))
    expect(shownNames()).toEqual([guestFullName(guest)])

    search('no such guest anywhere')
    expect(screen.getByText('No guests match')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('filters by RSVP Status, invitation and table, and clears the filters in one click', async () => {
    const { services, router } = await openGuests()
    const guests = await services.guests.list(MAIN)
    const count = (test: (guest: Guest) => boolean) =>
      guests.filter(test).length
    const range = () => screen.getByRole('status', { name: '' }).textContent
    const total = (expected: number) =>
      expect(
        screen.getByText(new RegExp(` of ${expected} guests$`)),
      ).toBeInTheDocument()

    expect(
      screen.queryByRole('button', { name: 'Clear filters' }),
    ).not.toBeInTheDocument()

    change(screen.getByLabelText('RSVP Status'), {
      target: { value: 'DECLINED' },
    })
    total(count((guest) => guest.rsvpStatus === 'DECLINED'))
    expect(router.state.location.search).toBe('?rsvp=DECLINED')

    change(screen.getByLabelText('RSVP Status'), {
      target: { value: 'ALL' },
    })
    change(screen.getByLabelText('Invitation Status'), {
      target: { value: 'NOT_SENT' },
    })
    total(count((guest) => guest.invitationSentCount === 0))

    change(screen.getByLabelText('Invitation Status'), {
      target: { value: 'ALL' },
    })
    change(screen.getByLabelText('Table'), {
      target: { value: 'NONE' },
    })
    total(count((guest) => guest.tableId === null))

    const seated = guests.find((guest) => guest.tableId !== null)!
    change(screen.getByLabelText('Table'), {
      target: { value: seated.tableId },
    })
    total(count((guest) => guest.tableId === seated.tableId))

    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }))
    total(guests.length)
    expect(router.state.location.search).toBe('')
    expect(range).toBeDefined()
  })

  it('sorts by a column, reversing on a second click', async () => {
    const { services } = await openGuests()
    const guests = await services.guests.list(MAIN)
    const header = () =>
      within(guestTable()).getByRole('columnheader', {
        name: /Expected Attendees/,
      })

    fireEvent.click(within(header()).getByRole('button'))
    expect(header()).toHaveAttribute('aria-sort', 'ascending')
    const lowest = Math.min(...guests.map((guest) => guest.allowedAttendees))
    expect(within(rows()[0]!).getAllByRole('cell')[4]).toHaveTextContent(
      String(lowest),
    )

    fireEvent.click(within(header()).getByRole('button'))
    expect(header()).toHaveAttribute('aria-sort', 'descending')
    const highest = Math.max(...guests.map((guest) => guest.allowedAttendees))
    expect(within(rows()[0]!).getAllByRole('cell')[4]).toHaveTextContent(
      String(highest),
    )
    expect(
      within(guestTable()).getByRole('columnheader', { name: /^Name/ }),
    ).toHaveAttribute('aria-sort', 'none')
  })

  it('pages through the guests and changes the rows per page', async () => {
    const { services, router } = await openGuests()
    const total = (await services.guests.list(MAIN)).length
    const first = shownNames()
    const pages = screen.getByRole('navigation', { name: 'Guest pages' })

    expect(
      within(pages).getByRole('button', { name: 'Previous page' }),
    ).toBeDisabled()
    fireEvent.click(within(pages).getByRole('button', { name: 'Next page' }))

    expect(screen.getByText(`11–20 of ${total} guests`)).toBeInTheDocument()
    expect(shownNames()).not.toEqual(first)
    expect(router.state.location.search).toBe('?page=2')
    expect(
      within(pages).getByRole('button', { name: 'Page 2' }),
    ).toHaveAttribute('aria-current', 'page')

    change(screen.getByLabelText('Rows per page'), {
      target: { value: '50' },
    })
    expect(screen.getByText(`1–50 of ${total} guests`)).toBeInTheDocument()
    expect(rows()).toHaveLength(50)
    expect(router.state.location.search).toBe('?size=50')
  })

  it('keeps every change when several are made in quick succession', async () => {
    const { router } = await openGuests()

    // No waiting between the changes: each must build on the one before.
    change(screen.getByLabelText('RSVP Status'), {
      target: { value: 'APPROVED' },
    })
    change(screen.getByLabelText('Invitation Status'), {
      target: { value: 'SENT' },
    })
    change(screen.getByLabelText('Rows per page'), {
      target: { value: '25' },
    })
    search('a')

    await waitFor(() =>
      expect(
        Object.fromEntries(new URLSearchParams(router.state.location.search)),
      ).toEqual({ rsvp: 'APPROVED', inv: 'SENT', size: '25', q: 'a' }),
    )
  })

  it('goes to a page by its number and back with Previous', async () => {
    const { router } = await openGuests()
    const pages = screen.getByRole('navigation', { name: 'Guest pages' })

    fireEvent.click(within(pages).getByRole('button', { name: 'Page 3' }))
    expect(screen.getByText(/^21–30 of /)).toBeInTheDocument()

    fireEvent.click(
      within(pages).getByRole('button', { name: 'Previous page' }),
    )
    expect(screen.getByText(/^11–20 of /)).toBeInTheDocument()

    const last = within(pages).getAllByRole('button', { name: /^Page \d+$/ })
    fireEvent.click(last[last.length - 1]!)
    expect(
      within(pages).getByRole('button', { name: 'Next page' }),
    ).toBeDisabled()

    fireEvent.click(within(pages).getByRole('button', { name: 'Page 1' }))
    expect(router.state.location.search).toBe('')
  })

  it('starts from the filters, sorting and page given in the address', async () => {
    await openGuests('?rsvp=APPROVED&sort=-confirmed&size=25&page=2')

    expect(screen.getByLabelText('RSVP Status')).toHaveValue('APPROVED')
    expect(screen.getByLabelText('Rows per page')).toHaveValue('25')
    expect(
      within(guestTable()).getByRole('columnheader', { name: /Confirmed/ }),
    ).toHaveAttribute('aria-sort', 'descending')
    expect(screen.getByText(/^26–50 of /)).toBeInTheDocument()
    expect(rows().every((row) => within(row).queryByText('Approved'))).toBe(
      true,
    )
  })

  it('opens a guest’s details from their name', async () => {
    const services = createTestServices()
    const guest = await find(
      services,
      (candidate) => candidate.tableId !== null,
    )
    const name = guestFullName(guest)
    await openGuests(`?q=${encodeURIComponent(guest.phone)}`, services)

    fireEvent.click(within(guestTable()).getByRole('button', { name }))
    const panel = screen.getByRole('dialog', { name: 'Guest Details' })

    expect(within(panel).getByText(guest.phone)).toBeInTheDocument()
    expect(within(panel).getByText('Last Invitation Sent')).toBeInTheDocument()
    expect(within(panel).getByText(/^Table \d+$/)).toBeInTheDocument()

    fireEvent.click(within(panel).getByRole('button', { name: 'Edit' }))
    expect(
      within(screen.getByRole('dialog', { name: 'Edit Guest' })).getByLabelText(
        /First Name/,
      ),
    ).toHaveValue(guest.firstName)
  })

  it('sends a WhatsApp message: shows it, opens WhatsApp and counts the send', async () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)
    const services = createTestServices()
    const [guest] = await services.guests.list(MAIN)
    const name = guestFullName(guest!)
    const { message, launchUrl } = await services.messages.preview(
      MAIN,
      guest!.id,
    )
    await openGuests(`?q=${encodeURIComponent(guest!.phone)}`, services)

    fireEvent.click(
      within(rows()[0]!).getByRole('button', {
        name: `Send a WhatsApp message to ${name}`,
      }),
    )
    const dialog = await screen.findByRole('dialog', {
      name: 'Send WhatsApp message',
    })
    expect(within(dialog).getByText(`To ${name}`)).toBeInTheDocument()
    await within(dialog).findByText(new RegExp(guest!.firstName))
    expect(open).not.toHaveBeenCalled()

    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Open WhatsApp' }),
    )

    expect(open).toHaveBeenCalledExactlyOnceWith(
      launchUrl,
      '_blank',
      'noopener,noreferrer',
    )
    expect(launchUrl).toBe(
      `https://wa.me/${guest!.normalizedPhone.slice(1)}?text=${encodeURIComponent(message)}`,
    )
    expect(
      await screen.findByText(`WhatsApp opened for ${name}.`),
    ).toBeInTheDocument()
    const after = (await services.guests.list(MAIN)).find(
      (candidate) => candidate.id === guest!.id,
    )
    expect(after?.invitationSentCount).toBe(guest!.invitationSentCount + 1)
    open.mockRestore()
  })

  it('counts nothing when the send is cancelled, and offers no send to a Viewer', async () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)
    const { services, unmount } = await openGuests()
    const before = await services.messages.listSends(MAIN)

    fireEvent.click(
      within(rows()[0]!).getByRole('button', {
        name: /^Send a WhatsApp message to/,
      }),
    )
    const dialog = await screen.findByRole('dialog', {
      name: 'Send WhatsApp message',
    })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))

    expect(open).not.toHaveBeenCalled()
    expect(await services.messages.listSends(MAIN)).toHaveLength(before.length)

    unmount()
    await openGuests('', createTestServices(), DEMO_EVENTS.viewer)
    expect(
      screen.queryByRole('button', { name: /^Send a WhatsApp message to/ }),
    ).not.toBeInTheDocument()
    open.mockRestore()
  })
})

describe('Changing guests', () => {
  it('adds a guest, who appears in the list and the figures', async () => {
    const { services } = await openGuests()
    const before = (await services.guests.list(MAIN)).length

    fireEvent.click(screen.getByRole('button', { name: 'Add Guest' }))
    const dialog = screen.getByRole('dialog', { name: 'Add Guest' })
    expect(within(dialog).getByLabelText(/Expected Attendees/)).toHaveValue(5)
    fillGuestForm(dialog, {
      firstName: 'Zohar',
      lastName: 'Newcomer',
      phone: '050-555-0199',
      allowed: '3',
    })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add Guest' }))

    expect(await screen.findByText('The guest was added.')).toBeInTheDocument()
    await waitFor(() => expect(kpi('Total Guests')).toBe(String(before + 1)))
    search('Zohar')
    const row = rowOf('Zohar Newcomer')
    expect(within(row).getByText('050-555-0199')).toBeInTheDocument()
    expect(within(row).getByText('Not Sent')).toBeInTheDocument()
    expect(await services.guests.list(MAIN)).toHaveLength(before + 1)
  })

  it('lists and exports a phone in local form however it was typed, and a foreign one with its code', async () => {
    await openGuests()
    const add = (firstName: string, phone: string) => {
      fireEvent.click(screen.getByRole('button', { name: 'Add Guest' }))
      const dialog = screen.getByRole('dialog', { name: 'Add Guest' })
      fillGuestForm(dialog, { firstName, lastName: 'Phoneform', phone })
      fireEvent.click(within(dialog).getByRole('button', { name: 'Add Guest' }))
    }

    add('Local', '+972 50 730 8828')
    await screen.findByText('The guest was added.')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    add('Abroad', '+1 (212) 555-0123')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())

    search('Phoneform')
    await waitFor(() => expect(rows()).toHaveLength(2))
    expect(
      within(rowOf('Local Phoneform')).getByText('050-730-8828'),
    ).toBeInTheDocument()
    expect(
      within(rowOf('Abroad Phoneform')).getByText('+1 2125550123'),
    ).toBeInTheDocument()

    search('0507308828')
    expect(shownNames()).toEqual(['Local Phoneform'])

    openEditGuest(rowOf('Local Phoneform'), 'Local Phoneform')
    expect(
      within(screen.getByRole('dialog', { name: 'Edit Guest' })).getByLabelText(
        /Phone Number/,
      ),
    ).toHaveValue('050-730-8828')
    fireEvent.click(
      within(screen.getByRole('dialog', { name: 'Edit Guest' })).getByRole(
        'button',
        { name: 'Cancel' },
      ),
    )

    fireEvent.click(screen.getByRole('button', { name: 'Export' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'CSV file (.csv)' }))
    const phones = (await lastDownload()).rows.map((row) => row[3])
    expect(phones).toContain('050-730-8828')
    expect(phones).toContain('+1 2125550123')
  })

  it('refuses a number that is local to another country', async () => {
    await openGuests()
    fireEvent.click(screen.getByRole('button', { name: 'Add Guest' }))
    const dialog = screen.getByRole('dialog', { name: 'Add Guest' })

    expect(
      within(dialog).getByText(
        /For a number from another country, start with \+ and the country code/,
      ),
    ).toBeInTheDocument()
    fillGuestForm(dialog, { firstName: 'Abroad', phone: '06 12 34 56 78' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add Guest' }))

    expect(
      await within(dialog).findByText('Enter a valid phone number.'),
    ).toBeInTheDocument()
  })

  it('explains what is wrong with a new guest’s details', async () => {
    const services = createTestServices()
    const existing = await find(services, () => true)
    await openGuests('', services)
    fireEvent.click(screen.getByRole('button', { name: 'Add Guest' }))
    const dialog = screen.getByRole('dialog', { name: 'Add Guest' })
    const submit = () =>
      fireEvent.click(within(dialog).getByRole('button', { name: 'Add Guest' }))

    submit()
    expect(within(dialog).getByText('Enter a first name.')).toBeInTheDocument()

    fillGuestForm(dialog, { firstName: 'Zohar' })
    submit()
    expect(
      within(dialog).getByText('Enter a valid phone number.'),
    ).toBeInTheDocument()

    fillGuestForm(dialog, { phone: '050-555-0199', allowed: '11' })
    submit()
    expect(
      within(dialog).getByText('Enter a whole number between 1 and 10.'),
    ).toBeInTheDocument()

    fillGuestForm(dialog, { phone: 'not a phone', allowed: '2' })
    submit()
    expect(
      await within(dialog).findByText('Enter a valid phone number.'),
    ).toBeInTheDocument()

    fillGuestForm(dialog, { phone: existing.phone })
    submit()
    expect(
      await within(dialog).findByText(
        'Another guest in this event already has this phone number.',
      ),
    ).toBeInTheDocument()
    expect(within(dialog).getByLabelText(/Phone Number/)).toHaveAttribute(
      'aria-invalid',
      'true',
    )
  })

  it('edits a guest, and refuses an allowance below what they confirmed', async () => {
    const services = createTestServices()
    const guest = await find(
      services,
      (candidate) => (candidate.confirmedAttendees ?? 0) >= 2,
    )
    const name = guestFullName(guest)
    await openGuests(`?q=${encodeURIComponent(guest.phone)}`, services)

    openEditGuest(rowOf(name), name)
    const dialog = screen.getByRole('dialog', { name: 'Edit Guest' })
    fillGuestForm(dialog, { allowed: '1' })
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Save Changes' }),
    )

    expect(
      await within(dialog).findByText(
        `This guest already confirmed ${guest.confirmedAttendees} attendees, so the expected attendees cannot be lower.`,
      ),
    ).toBeInTheDocument()

    fillGuestForm(dialog, { lastName: 'Renamed', allowed: '9' })
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Save Changes' }),
    )

    expect(
      await screen.findByText('The guest was updated.'),
    ).toBeInTheDocument()
    await waitFor(() =>
      expect(shownNames()).toEqual([`${guest.firstName} Renamed`]),
    )
    expect(
      (await services.guests.list(MAIN)).find((item) => item.id === guest.id),
    ).toMatchObject({ lastName: 'Renamed', allowedAttendees: 9 })
  })

  it('deletes a guest after confirmation, and restores them when the phone is added again', async () => {
    const services = createTestServices()
    const guest = await find(
      services,
      (candidate) =>
        candidate.rsvpStatus === 'APPROVED' && candidate.tableId !== null,
    )
    const name = guestFullName(guest)
    await openGuests(`?q=${encodeURIComponent(guest.phone)}`, services)
    const before = Number(kpi('Total Guests'))

    openRowMenu(name, 'Delete')
    const dialog = screen.getByRole('dialog', { name: 'Delete Guest' })
    expect(
      within(dialog).getByText(`Delete ${name} from this event?`),
    ).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }))

    expect(
      await screen.findByText('The guest was deleted.'),
    ).toBeInTheDocument()
    await waitFor(() => expect(kpi('Total Guests')).toBe(String(before - 1)))
    expect(screen.getByText('No guests match')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Add Guest' }))
    const add = screen.getByRole('dialog', { name: 'Add Guest' })
    fillGuestForm(add, {
      firstName: 'Back',
      lastName: 'Again',
      phone: guest.phone,
    })
    fireEvent.click(within(add).getByRole('button', { name: 'Add Guest' }))

    await waitFor(() => expect(shownNames()).toEqual(['Back Again']))
    const restored = (await services.guests.list(MAIN)).find(
      (item) => item.id === guest.id,
    )
    expect(restored).toMatchObject({
      rsvpStatus: 'NO_RESPONSE',
      tableId: null,
      invitationSentCount: guest.invitationSentCount,
    })
  })

  it('changes an RSVP by hand, with the same attendee limits as the public form', async () => {
    const services = createTestServices()
    const guest = await find(
      services,
      (candidate) => candidate.rsvpStatus === 'NO_RESPONSE',
    )
    const name = guestFullName(guest)
    await openGuests(`?q=${encodeURIComponent(guest.phone)}`, services)

    openRowMenu(name, 'Change RSVP')
    const dialog = screen.getByRole('dialog', { name: 'Change RSVP' })
    expect(
      within(dialog).getByRole('radio', { name: 'No response' }),
    ).toBeChecked()
    expect(
      within(dialog).queryByLabelText(/Confirmed Attendees/),
    ).not.toBeInTheDocument()

    fireEvent.click(within(dialog).getByRole('radio', { name: 'Approved' }))
    change(within(dialog).getByLabelText(/Confirmed Attendees/), {
      target: { value: String(guest.allowedAttendees + 1) },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save RSVP' }))
    expect(
      within(dialog).getByText(
        `Enter a whole number between 1 and ${guest.allowedAttendees}.`,
      ),
    ).toBeInTheDocument()

    change(within(dialog).getByLabelText(/Confirmed Attendees/), {
      target: { value: '1' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save RSVP' }))

    expect(await screen.findByText('The RSVP was updated.')).toBeInTheDocument()
    await waitFor(() =>
      expect(within(rowOf(name)).getByText('Approved')).toBeInTheDocument(),
    )
    expect(
      within(rowOf(name)).getByRole('combobox', { name: `Table for ${name}` }),
    ).toHaveValue('NONE')
  })

  it('warns that a seated guest loses their table when they stop being approved', async () => {
    const services = createTestServices()
    const guest = await find(
      services,
      (candidate) => candidate.tableId !== null,
    )
    const name = guestFullName(guest)
    await openGuests(`?q=${encodeURIComponent(guest.phone)}`, services)

    openRowMenu(name, 'Change RSVP')
    const dialog = screen.getByRole('dialog', { name: 'Change RSVP' })
    expect(within(dialog).queryByText(/will be removed from table/)).toBeNull()
    fireEvent.click(within(dialog).getByRole('radio', { name: 'Declined' }))
    expect(
      within(dialog).getByText(/^This guest will be removed from table \d+,/),
    ).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save RSVP' }))

    await waitFor(() =>
      expect(within(rowOf(name)).getByText('Declined')).toBeInTheDocument(),
    )
    expect(within(rowOf(name)).queryByRole('combobox')).not.toBeInTheDocument()
    expect(
      (await services.guests.list(MAIN)).find((item) => item.id === guest.id)
        ?.tableId,
    ).toBeNull()
  })

  it('assigns an approved guest to a table, and refuses a table without room', async () => {
    const services = createTestServices()
    const tables = await services.tables.list(MAIN)
    const guest = await find(
      services,
      (candidate) =>
        candidate.rsvpStatus === 'APPROVED' &&
        candidate.tableId === null &&
        (candidate.confirmedAttendees ?? 0) >= 2,
    )
    const roomy = tables.find(
      (item) => item.available >= (guest.confirmedAttendees ?? 0),
    )!
    const full = tables.find((item) => item.available <= 0)!
    const name = guestFullName(guest)
    await openGuests(`?q=${encodeURIComponent(guest.phone)}`, services)
    const select = () =>
      within(rowOf(name)).getByRole('combobox', { name: `Table for ${name}` })

    change(select(), { target: { value: full.table.id } })
    expect(
      await screen.findByText(/^This table has 0 seats left/),
    ).toBeVisible()
    expect(select()).toHaveValue('NONE')

    change(select(), { target: { value: roomy.table.id } })
    await waitFor(() => expect(select()).toHaveValue(roomy.table.id))
    expect(
      (await services.guests.list(MAIN)).find((item) => item.id === guest.id)
        ?.tableId,
    ).toBe(roomy.table.id)

    change(select(), { target: { value: 'NONE' } })
    await waitFor(() => expect(select()).toHaveValue('NONE'))
  })
})

describe('Selecting guests', () => {
  it('deletes the selected guests after confirmation', async () => {
    const { services } = await openGuests()
    const before = (await services.guests.list(MAIN)).length
    const [first, second] = shownNames()

    expect(screen.queryByRole('region', { name: 'Selected guests' })).toBeNull()
    fireEvent.click(screen.getByRole('checkbox', { name: `Select ${first}` }))
    fireEvent.click(screen.getByRole('checkbox', { name: `Select ${second}` }))
    const bar = screen.getByRole('region', { name: 'Selected guests' })
    expect(within(bar).getByText('2 selected')).toBeInTheDocument()

    fireEvent.click(
      within(bar).getByRole('button', { name: 'Delete selected' }),
    )
    const dialog = screen.getByRole('dialog', { name: 'Delete Guests' })
    expect(
      within(dialog).getByText('Delete the 2 selected guests from this event?'),
    ).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }))

    expect(
      await screen.findByText('2 guests were deleted.'),
    ).toBeInTheDocument()
    await waitFor(() => expect(kpi('Total Guests')).toBe(String(before - 2)))
    expect(shownNames()).not.toContain(first)
    expect(screen.queryByRole('region', { name: 'Selected guests' })).toBeNull()
  })

  it('adds the selected guests to an existing group, moving those who had another', async () => {
    const { services } = await openGuests()
    const guests = await services.guests.list(MAIN)
    const [first, second] = shownNames()
    const idOf = (name: string | undefined) =>
      guests.find((guest) => guestFullName(guest) === name)!.id
    const grouped = [first, second].filter(
      (name) => guests.find((guest) => guest.id === idOf(name))?.group != null,
    ).length
    const target = listGroups(guests)[0]!

    fireEvent.click(screen.getByRole('checkbox', { name: `Select ${first}` }))
    fireEvent.click(screen.getByRole('checkbox', { name: `Select ${second}` }))
    const bar = screen.getByRole('region', { name: 'Selected guests' })
    fireEvent.click(within(bar).getByRole('button', { name: 'Add to Group' }))
    const dialog = await screen.findByRole('dialog', { name: 'Add to Group' })
    expect(grouped).toBeGreaterThan(0)
    expect(
      within(dialog).getByText(
        `${grouped} of the selected guests already have a group and will be moved.`,
      ),
    ).toBeInTheDocument()

    change(within(dialog).getByRole('combobox', { name: 'Group' }), {
      target: { value: target.toUpperCase() },
    })
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Add to Group' }),
    )

    expect(
      await screen.findByText(`2 guests added to "${target.toUpperCase()}"`),
    ).toBeInTheDocument()
    const after = await services.guests.list(MAIN)
    expect(after.find((guest) => guest.id === idOf(first))?.group).toBe(target)
    expect(after.find((guest) => guest.id === idOf(second))?.group).toBe(target)
    await waitFor(() =>
      expect(
        screen.queryByRole('region', { name: 'Selected guests' }),
      ).toBeNull(),
    )
  })

  it('asks before creating a group for the selected guests, and can remove them from groups', async () => {
    const { services } = await openGuests()
    const guests = await services.guests.list(MAIN)
    const [first] = shownNames()
    const id = guests.find((guest) => guestFullName(guest) === first)!.id
    const groupOf = async () =>
      (await services.guests.list(MAIN)).find((guest) => guest.id === id)?.group
    const open = async () => {
      fireEvent.click(screen.getByRole('checkbox', { name: `Select ${first}` }))
      fireEvent.click(
        within(
          screen.getByRole('region', { name: 'Selected guests' }),
        ).getByRole('button', { name: 'Add to Group' }),
      )
      return screen.findByRole('dialog', { name: 'Add to Group' })
    }

    let dialog = await open()
    change(within(dialog).getByRole('combobox', { name: 'Group' }), {
      target: { value: 'Book Club' },
    })
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Add to Group' }),
    )
    const confirm = await screen.findByRole('dialog', {
      name: 'Create a New Group?',
    })
    expect(
      within(confirm).getByText(
        'The group "Book Club" does not exist yet. Create it and put the 1 selected guests in it?',
      ),
    ).toBeInTheDocument()
    fireEvent.click(within(confirm).getByRole('button', { name: 'Cancel' }))
    expect(await groupOf()).not.toBe('Book Club')

    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Add to Group' }),
    )
    fireEvent.click(
      within(
        await screen.findByRole('dialog', { name: 'Create a New Group?' }),
      ).getByRole('button', { name: 'Create Group' }),
    )
    await screen.findByText('1 guests added to "Book Club"')
    expect(await groupOf()).toBe('Book Club')

    dialog = await open()
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Remove From Groups' }),
    )
    await screen.findByText('1 guests removed from their groups')
    expect(await groupOf()).toBeNull()
  })

  it('selects and clears a whole page, keeping the selection across pages', async () => {
    await openGuests()
    const all = screen.getByRole('checkbox', {
      name: 'Select all guests on this page',
    })

    fireEvent.click(all)
    expect(screen.getByText('10 selected')).toBeInTheDocument()
    expect(all).toBeChecked()

    fireEvent.click(screen.getByRole('button', { name: 'Next page' }))
    expect(
      screen.getByRole('checkbox', { name: 'Select all guests on this page' }),
    ).not.toBeChecked()
    fireEvent.click(
      screen.getByRole('checkbox', { name: `Select ${shownNames()[0]}` }),
    )
    expect(screen.getByText('11 selected')).toBeInTheDocument()
    expect(
      (
        screen.getByRole('checkbox', {
          name: 'Select all guests on this page',
        }) as HTMLInputElement
      ).indeterminate,
    ).toBe(true)

    fireEvent.click(screen.getByRole('button', { name: 'Clear selection' }))
    expect(screen.queryByText(/selected$/)).not.toBeInTheDocument()
  })

  it('exports only the selected guests', async () => {
    await openGuests()
    const [first, , third] = shownNames()
    fireEvent.click(screen.getByRole('checkbox', { name: `Select ${first}` }))
    fireEvent.click(screen.getByRole('checkbox', { name: `Select ${third}` }))

    fireEvent.click(screen.getByRole('button', { name: 'Export selected' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'CSV file (.csv)' }))

    const file = await lastDownload()
    expect(file.rows).toHaveLength(3)
    expect(
      file.rows
        .slice(1)
        .map((row) => `${row[0]} ${row[1]}`.trim())
        .sort(),
    ).toEqual([first, third].sort())
  })
})

describe('Exporting guests', () => {
  it('exports every guest with every field, whatever is filtered or hidden', async () => {
    const { services } = await openGuests('?rsvp=DECLINED')
    const guests = await services.guests.list(MAIN)

    fireEvent.click(screen.getByRole('button', { name: 'Export' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'CSV file (.csv)' }))

    const file = await lastDownload()
    expect(file.name).toBe('Maya & Daniel’s Wedding - guests.csv')
    expect(file.rows[0]).toEqual([
      'First Name',
      'Last Name',
      'Invitation Name',
      'Phone',
      'Expected Attendees',
      'Confirmed Attendees',
      'RSVP Status',
      'Invitations Sent',
      'Table',
      'Group',
    ])
    expect(file.rows).toHaveLength(guests.length + 1)
    const statuses = new Set(file.rows.slice(1).map((row) => row[6]))
    expect([...statuses].sort()).toEqual([
      'Approved',
      'Awaiting Response',
      'Declined',
      'Not Sent',
      'Not Sure',
    ])
    expect(await screen.findByText('The file was downloaded.')).toBeVisible()
  })
})

describe('Choosing columns', () => {
  function chooser() {
    fireEvent.click(screen.getByRole('button', { name: 'Choose columns' }))
    return screen.getByRole('group', { name: 'Choose columns' })
  }
  const headers = () =>
    within(guestTable())
      .getAllByRole('columnheader')
      .map((header) => header.textContent)
      .filter((text) => text !== '')

  it('hides and shows columns, always keeping Name and Phone, and remembers the choice', async () => {
    const { services } = await openGuests()
    expect(headers()).toEqual([
      'Select all guests on this page',
      'Name',
      'Invitation Name',
      'Phone',
      'Expected Attendees',
      'Confirmed',
      'RSVP Status',
      'Invitations Sent',
      'Table',
      'Group',
      'Actions',
    ])
    const panel = chooser()

    expect(
      within(panel).getByRole('checkbox', { name: 'Name (always shown)' }),
    ).toBeDisabled()
    expect(
      within(panel).getByRole('checkbox', { name: 'Phone (always shown)' }),
    ).toBeDisabled()
    expect(
      within(panel).getByRole('button', { name: 'Select all' }),
    ).toBeDisabled()

    fireEvent.click(
      within(panel).getByRole('checkbox', { name: 'Expected Attendees' }),
    )
    await waitFor(() => expect(headers()).not.toContain('Expected Attendees'))
    await waitFor(async () =>
      expect(await services.preferences.getGuestColumns()).not.toContain(
        'allowed',
      ),
    )

    fireEvent.click(within(panel).getByRole('button', { name: 'Clear' }))
    await waitFor(() =>
      expect(headers()).toEqual([
        'Select all guests on this page',
        'Name',
        'Phone',
        'Actions',
      ]),
    )
    expect(within(panel).getByRole('button', { name: 'Clear' })).toBeDisabled()

    fireEvent.click(within(panel).getByRole('button', { name: 'Select all' }))
    await waitFor(() => expect(headers()).toHaveLength(11))
    await waitFor(async () =>
      expect(await services.preferences.getGuestColumns()).toHaveLength(9),
    )
  })

  it('starts from the remembered choice, and falls back to sorting by name when the sorted column is hidden', async () => {
    const services = createTestServices()
    await services.preferences.setGuestColumns(['name', 'phone', 'status'])

    await openGuests('?sort=-confirmed', services)

    await waitFor(() =>
      expect(headers()).toEqual([
        'Select all guests on this page',
        'Name',
        'Phone',
        'RSVP Status',
        'Actions',
      ]),
    )
    expect(
      within(guestTable()).getByRole('columnheader', { name: /^Name/ }),
    ).toHaveAttribute('aria-sort', 'ascending')
  })

  it('closes with Escape and returns focus to its button', async () => {
    await openGuests()
    const panel = chooser()

    fireEvent.keyDown(panel, { key: 'Escape' })

    expect(screen.queryByRole('group', { name: 'Choose columns' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Choose columns' })).toHaveFocus()
  })
})

describe('Importing guests', () => {
  function chooseFile(dialog: HTMLElement, name: string, content: string) {
    change(within(dialog).getByLabelText('Choose a CSV or Excel file'), {
      target: { files: [new File([content], name, { type: 'text/csv' })] },
    })
  }

  it('imports a file in steps, skipping and reporting the rows it cannot use', async () => {
    const services = createTestServices()
    const existing = await find(services, () => true)
    const before = (await services.guests.list(MAIN)).length
    await openGuests('', services)

    fireEvent.click(screen.getByRole('button', { name: 'Import Guests' }))
    const dialog = screen.getByRole('dialog', { name: 'Import guests' })
    chooseFile(
      dialog,
      'guests.csv',
      [
        'First Name,Last Name,Phone,Allowed',
        'Imported,One,+972 50 555 0101,3',
        'Imported,Two,050-555-0102,',
        ',NoName,050-555-0103,2',
        'Bad,Phone,12,2',
        'Same,Phone,0505550101,2',
        `Existing,Guest,${existing.phone},2`,
      ].join('\n'),
    )

    expect(
      await within(dialog).findByText(/^guests\.csv: 7 rows\./),
    ).toBeInTheDocument()
    expect(within(dialog).getByLabelText(/First Name/)).toHaveValue('0')
    expect(within(dialog).getByLabelText(/Phone Number/)).toHaveValue('2')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Preview' }))

    expect(within(dialog).getByText('2 will be imported')).toBeInTheDocument()
    expect(within(dialog).getByText('4 will be skipped')).toBeInTheDocument()
    for (const problem of [
      'No first name',
      'Phone number is not valid',
      'Same phone as an earlier row',
      'A guest already has this phone',
    ]) {
      expect(within(dialog).getByText(problem)).toBeInTheDocument()
    }
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Import 2 guests' }),
    )

    expect(
      await within(dialog).findByText(
        '2 guests added, 0 restored, 4 rows skipped.',
      ),
    ).toBeInTheDocument()
    await waitFor(() => expect(kpi('Total Guests')).toBe(String(before + 2)))

    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Download skipped rows' }),
    )
    const skipped = await lastDownload()
    expect(skipped.rows).toHaveLength(5)
    expect(skipped.rows[1]).toEqual([
      '4',
      '',
      'NoName',
      '050-555-0103',
      '2',
      '',
      'No first name',
    ])

    fireEvent.click(within(dialog).getByRole('button', { name: 'Done' }))
    search('Imported')
    expect(shownNames()).toEqual(['Imported One', 'Imported Two'])
    const two = (await services.guests.list(MAIN)).find(
      (guest) => guest.lastName === 'Two',
    )
    expect(two?.allowedAttendees).toBe(5)
  })

  it('lets the columns be matched by hand when the headings are not recognised', async () => {
    await openGuests()
    fireEvent.click(screen.getByRole('button', { name: 'Import Guests' }))
    const dialog = screen.getByRole('dialog', { name: 'Import guests' })
    chooseFile(dialog, 'list.csv', 'Who,Number\nZiv Shalev,050-555-0111\n')

    await within(dialog).findByText(/^list\.csv: 2 rows\./)
    expect(
      within(dialog).getByRole('button', { name: 'Preview' }),
    ).toBeDisabled()
    expect(
      within(dialog).getByText(
        'Choose the columns for First Name and Phone Number to continue.',
      ),
    ).toBeInTheDocument()

    change(within(dialog).getByLabelText(/First Name/), {
      target: { value: '0' },
    })
    change(within(dialog).getByLabelText(/Phone Number/), {
      target: { value: '1' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Preview' }))
    expect(within(dialog).getByText('1 will be imported')).toBeInTheDocument()

    fireEvent.click(within(dialog).getByRole('button', { name: 'Back' }))
    fireEvent.click(
      within(dialog).getByRole('checkbox', {
        name: 'The first row contains column headings',
      }),
    )
    fireEvent.click(within(dialog).getByRole('button', { name: 'Preview' }))
    // The heading row is now data, and "Number" is not a phone.
    expect(within(dialog).getByText('1 will be skipped')).toBeInTheDocument()
  })

  it.each([
    ['notes.txt', 'a,b', 'Choose a .csv or .xlsx file.'],
    ['empty.csv', '\n\n', 'The file has no rows.'],
    ['broken.xlsx', 'not really a spreadsheet', /could not be read/],
  ])('refuses %s with an explanation', async (name, content, message) => {
    await openGuests()
    fireEvent.click(screen.getByRole('button', { name: 'Import Guests' }))
    const dialog = screen.getByRole('dialog', { name: 'Import guests' })

    chooseFile(dialog, name, content)

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(message)
  })

  it('offers a template with the expected headings', async () => {
    await openGuests()
    fireEvent.click(screen.getByRole('button', { name: 'Import Guests' }))

    fireEvent.click(screen.getByRole('button', { name: 'Download a template' }))

    const file = await lastDownload()
    expect(file.name).toBe('guest import template.csv')
    expect(file.rows).toEqual([
      [
        'First Name',
        'Last Name',
        'Phone Number',
        'Expected Attendees',
        'Group',
      ],
    ])
  })
})

describe('Unknown Guests', () => {
  async function openUnknown(services: Services = createTestServices()) {
    const view = await openGuests('?tab=unknown', services)
    return view
  }
  const table = (name: string) => screen.getByRole('table', { name })
  const unknownRow = (name: string) =>
    within(table('Awaiting review')).getByText(name).closest('tr')!

  it('lists the responses awaiting review, apart from the guest figures', async () => {
    const { services } = await openUnknown()
    const [first] = await services.unknownGuests.list(MAIN)
    const guests = await services.guests.list(MAIN)

    expect(
      screen.getByText(
        'Responses from phone numbers that are not on your guest list',
      ),
    ).toBeInTheDocument()
    expect(
      within(table('Awaiting review')).getAllByRole('row').slice(1),
    ).toHaveLength(8)
    expect(
      within(unknownRow(first!.name)).getByText(first!.phone),
    ).toBeVisible()
    expect(kpi('Total Guests')).toBe(String(guests.length))
    expect(screen.getByRole('tab', { name: /^Rejected/ })).toHaveTextContent(
      'Rejected1',
    )
  })

  it('adds a response as a guest, keeping what they answered', async () => {
    const services = createTestServices()
    const unknown = (await services.unknownGuests.list(MAIN)).find(
      (item) => item.rsvpStatus === 'APPROVED',
    )!
    const before = (await services.guests.list(MAIN)).length
    await openUnknown(services)

    fireEvent.click(
      within(unknownRow(unknown.name)).getByRole('button', {
        name: 'Add as guest',
      }),
    )
    const dialog = screen.getByRole('dialog', { name: 'Add as guest' })
    const [firstName, ...rest] = unknown.name.split(' ')
    expect(within(dialog).getByLabelText(/First Name/)).toHaveValue(firstName)
    expect(within(dialog).getByLabelText(/Last Name/)).toHaveValue(
      rest.join(' '),
    )
    expect(within(dialog).getByText(unknown.phone)).toBeInTheDocument()

    change(within(dialog).getByLabelText(/First Name/), {
      target: { value: ' ' },
    })
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Add as guest' }),
    )
    expect(within(dialog).getByText('Enter a first name.')).toBeInTheDocument()
    change(within(dialog).getByLabelText(/First Name/), {
      target: { value: 'Known' },
    })
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Add as guest' }),
    )

    expect(
      await screen.findByText('The response was added as a guest.'),
    ).toBeInTheDocument()
    await waitFor(() => expect(kpi('Total Guests')).toBe(String(before + 1)))
    expect(tabCount('Unknown Guests')).toBe('Unknown Guests7')
    const guest = (await services.guests.list(MAIN)).find(
      (item) => item.normalizedPhone === unknown.normalizedPhone,
    )
    expect(guest).toMatchObject({
      firstName: 'Known',
      rsvpStatus: 'APPROVED',
      confirmedAttendees: unknown.confirmedAttendees,
      invitationName: unknown.name,
    })
  })

  it('matches a response to an existing guest, replacing their RSVP', async () => {
    const services = createTestServices()
    const unknown = (await services.unknownGuests.list(MAIN)).find(
      (item) => item.rsvpStatus === 'DECLINED',
    )!
    const guest = await find(
      services,
      (candidate) => candidate.rsvpStatus === 'NO_RESPONSE',
    )
    await openUnknown(services)

    fireEvent.click(
      within(unknownRow(unknown.name)).getByRole('button', {
        name: 'Match to a guest',
      }),
    )
    const dialog = screen.getByRole('dialog', { name: 'Match to a guest' })
    const submit = within(dialog).getByRole('button', {
      name: 'Match to a guest',
    })
    expect(submit).toBeDisabled()

    change(within(dialog).getByLabelText('Find a guest'), {
      target: { value: 'zzzz no one' },
    })
    expect(
      within(dialog).getByText('No guest matches this search.'),
    ).toBeInTheDocument()
    change(within(dialog).getByLabelText('Find a guest'), {
      target: { value: guest.phone },
    })
    fireEvent.click(
      within(dialog).getByRole('radio', {
        name: new RegExp(guestFullName(guest)),
      }),
    )
    fireEvent.click(submit)

    expect(
      await screen.findByText('The response was matched to the guest.'),
    ).toBeInTheDocument()
    expect(
      (await services.guests.list(MAIN)).find((item) => item.id === guest.id),
    ).toMatchObject({ rsvpStatus: 'DECLINED', invitationName: unknown.name })
    await waitFor(() =>
      expect(tabCount('Unknown Guests')).toBe('Unknown Guests7'),
    )
  })

  it('explains when a response is for more people than the guest is allowed', async () => {
    const services = createTestServices()
    const unknown = (await services.unknownGuests.list(MAIN)).find(
      (item) => (item.confirmedAttendees ?? 0) >= 2,
    )!
    const guest = await find(services, () => true)
    await services.guests.setRsvp(MAIN, guest.id, {
      status: 'NO_RESPONSE',
      attendees: null,
    })
    await services.guests.update(MAIN, guest.id, {
      firstName: guest.firstName,
      lastName: guest.lastName,
      phone: guest.phone,
      allowedAttendees: 1,
    })
    await openUnknown(services)

    fireEvent.click(
      within(unknownRow(unknown.name)).getByRole('button', {
        name: 'Match to a guest',
      }),
    )
    const dialog = screen.getByRole('dialog', { name: 'Match to a guest' })
    change(within(dialog).getByLabelText('Find a guest'), {
      target: { value: guest.phone },
    })
    fireEvent.click(within(dialog).getByRole('radio'))
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Match to a guest' }),
    )

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      `The response is for ${unknown.confirmedAttendees} attendees but this guest is expected to bring up to 1. Raise the guest's expected attendees first.`,
    )
  })

  it('rejects a response into the Rejected list, from which it can be restored', async () => {
    const services = createTestServices()
    const [unknown] = await services.unknownGuests.list(MAIN)
    const { router } = await openUnknown(services)

    fireEvent.click(
      within(unknownRow(unknown!.name)).getByRole('button', { name: 'Reject' }),
    )

    expect(
      await screen.findByText(
        'The response was rejected. You can restore it from the Rejected list.',
      ),
    ).toBeInTheDocument()
    await waitFor(() =>
      expect(tabCount('Unknown Guests')).toBe('Unknown Guests7'),
    )

    fireEvent.click(screen.getByRole('tab', { name: /^Rejected/ }))
    expect(router.state.location.search).toBe('?tab=unknown&view=rejected')
    const rejected = table('Rejected')
    expect(within(rejected).getAllByRole('row').slice(1)).toHaveLength(2)
    expect(
      within(rejected).getByRole('columnheader', { name: 'Rejected' }),
    ).toBeInTheDocument()

    fireEvent.click(
      within(
        within(rejected).getByText(unknown!.name).closest('tr')!,
      ).getByRole('button', { name: 'Restore' }),
    )

    expect(
      await screen.findByText('The response was returned to review.'),
    ).toBeInTheDocument()
    await waitFor(() =>
      expect(tabCount('Unknown Guests')).toBe('Unknown Guests8'),
    )
    expect(await services.unknownGuests.listRejected(MAIN)).toHaveLength(1)
  })

  it('says so when there is nothing to review', async () => {
    const services = createTestServices()
    await openGuests('?tab=unknown', services, DEMO_EVENTS.viewer)

    expect(
      screen.getByText('No unknown responses to review.'),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: /^Rejected/ }))
    expect(screen.getByText('No rejected responses.')).toBeInTheDocument()
  })
})

describe('Guests page for a read-only event', () => {
  it.each([
    [DEMO_EVENTS.viewer, 'View-only access'],
    [DEMO_EVENTS.past, 'This event has ended'],
  ])(
    'lets %s be viewed and exported but not changed',
    async (eventId, notice) => {
      await openGuests('', createTestServices(), eventId)

      expect(screen.getByText(notice)).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Add Guest' })).toBeNull()
      expect(screen.queryByRole('button', { name: 'Import Guests' })).toBeNull()
      expect(screen.queryByRole('button', { name: /^Edit / })).toBeNull()
      expect(screen.queryByRole('button', { name: /^More actions/ })).toBeNull()
      expect(within(guestTable()).queryByRole('combobox')).toBeNull()
      expect(screen.getByRole('button', { name: 'Export' })).toBeEnabled()

      fireEvent.click(
        screen.getByRole('checkbox', { name: `Select ${shownNames()[0]}` }),
      )
      const bar = screen.getByRole('region', { name: 'Selected guests' })
      expect(
        within(bar).getByRole('button', { name: 'Export selected' }),
      ).toBeInTheDocument()
      expect(
        within(bar).queryByRole('button', { name: 'Delete selected' }),
      ).toBeNull()
      expect(
        within(bar).queryByRole('button', { name: 'Add to Group' }),
      ).toBeNull()

      fireEvent.click(
        within(guestTable()).getAllByRole('button', {
          name: shownNames()[0],
        })[0]!,
      )
      const panel = screen.getByRole('dialog', { name: 'Guest Details' })
      expect(within(panel).queryByRole('button', { name: 'Edit' })).toBeNull()
    },
  )

  it('shows unknown responses without actions', async () => {
    await openGuests('?tab=unknown', createTestServices(), DEMO_EVENTS.past)

    expect(screen.getByRole('table', { name: 'Awaiting review' })).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Reject' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Add as guest' })).toBeNull()
  })
})

describe('Guests page states', () => {
  it('shows a loading state, then the guests', async () => {
    renderApp(`/events/${MAIN}/guests`, createTestServices({ delayMs: 30 }))

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Guests' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Loading…')
    expect(await screen.findByRole('table', { name: 'Guests' })).toBeVisible()
  })

  it('shows an error that can be retried', async () => {
    renderApp(
      `/events/${MAIN}/guests`,
      createTestServices({ failOperations: new Set(['guests.list']) }),
    )

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(
      'The service is not available right now. Please try again.',
    )
    fireEvent.click(within(alert).getByRole('button', { name: 'Try again' }))
    expect(await screen.findByRole('alert')).toBeInTheDocument()
  })

  it('invites adding the first guest to an event that has none', async () => {
    const services = createTestServices()
    const event = await services.events.create({
      name: 'Fresh Start',
      startsAt: '2031-01-01T18:00:00.000Z',
      timeZone: 'Asia/Jerusalem',
      maxAttendees: 100,
      defaultAllowedAttendees: 2,
      rsvpLanguage: 'en',
    })
    await openGuests('', services, event.id)

    expect(screen.getByText('No guests yet')).toBeInTheDocument()
    expect(kpi('Total Guests')).toBe('0')
    fireEvent.click(screen.getAllByRole('button', { name: 'Add Guest' })[1]!)
    expect(
      within(screen.getByRole('dialog', { name: 'Add Guest' })).getByLabelText(
        /Expected Attendees/,
      ),
    ).toHaveValue(2)
  })

  it('shows a change on the Dashboard after it is made here', async () => {
    const { services } = await openGuests()
    const before = (await services.dashboard.get(MAIN)).metrics.totalGuests

    fireEvent.click(screen.getByRole('button', { name: 'Add Guest' }))
    const dialog = screen.getByRole('dialog', { name: 'Add Guest' })
    fillGuestForm(dialog, { firstName: 'Zohar', phone: '050-555-0199' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add Guest' }))
    await screen.findByText('The guest was added.')

    fireEvent.click(screen.getByRole('link', { name: 'Dashboard' }))
    const figures = await screen.findByRole('region', { name: 'Key figures' })
    await waitFor(() =>
      expect(
        within(figures).getByText('Total Guests').parentElement,
      ).toHaveTextContent(String(before + 1)),
    )
  })

  it('is translated', async () => {
    await changeLanguage('he')
    renderApp(`/events/${MAIN}/guests`)
    await screen.findByRole('table', { name: 'אורחים' })

    expect(
      screen.getByRole('heading', { level: 1, name: 'אורחים' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'הוספת אורח' })).toBeVisible()
    expect(screen.getAllByText('אישר הגעה').length).toBeGreaterThan(0)
    expect(screen.getByText(/^1–10 מתוך \d+ אורחים$/)).toBeInTheDocument()
  })

  it('shows guests as cards on a phone, without the table-only controls', async () => {
    setViewportWidth(390)
    await openGuests()
    const list = screen.getByRole('list', { name: 'Guests' })
    const [card] = within(list).getAllByRole('listitem')

    expect(within(list).getAllByRole('listitem').length).toBeGreaterThanOrEqual(
      10,
    )
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Choose columns' })).toBeNull()
    expect(screen.queryByRole('checkbox')).toBeNull()
    expect(within(card!).getByText(/^Expected \d+$/)).toBeInTheDocument()
    expect(within(card!).getByText(/^Sent \d+$/)).toBeInTheDocument()

    fireEvent.click(
      within(card!).getByRole('button', { name: /^View details of / }),
    )
    expect(
      screen.getByRole('dialog', { name: 'Guest Details' }),
    ).toBeInTheDocument()
  })
})

describe('Groups, and the Table field of the guest form', () => {
  it('shows each guest’s group and filters by it', async () => {
    const { services, router } = await openGuests()
    const guests = await services.guests.list(MAIN)
    const inFamily = guests.filter((guest) => guest.group === 'Family')
    const inNone = guests.filter((guest) => guest.group === null)
    expect(inFamily.length).toBeGreaterThan(0)
    expect(inNone.length).toBeGreaterThan(0)
    const filter = screen.getByRole('combobox', { name: 'Group' })
    expect(optionLabels(filter)).toEqual([
      'All Groups',
      'No Group',
      'Family',
      'Friends',
      'Neighbours',
      'Work',
    ])

    change(filter, { target: { value: 'Family' } })

    expect(
      await screen.findByText(new RegExp(`of ${inFamily.length} guests`)),
    ).toBeInTheDocument()
    expect(router.state.location.search).toContain('group=Family')
    expect(
      rows().every((row) => within(row).queryByText('Family') !== null),
    ).toBe(true)

    change(filter, { target: { value: '~none' } })
    expect(
      await screen.findByText(new RegExp(`of ${inNone.length} guests`)),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }))
    await waitFor(() => expect(filter).toHaveValue('ALL'))
  })

  it('finds guests by group in the search box and sorts by the Group column', async () => {
    const { services } = await openGuests()
    const guests = await services.guests.list(MAIN)

    search('neighbours')
    expect(
      await screen.findByText(
        new RegExp(
          `of ${guests.filter((guest) => guest.group === 'Neighbours').length} guests`,
        ),
      ),
    ).toBeInTheDocument()

    search('')
    fireEvent.click(
      within(
        within(guestTable()).getByRole('columnheader', { name: /^Group/ }),
      ).getByRole('button'),
    )
    await waitFor(() =>
      expect(within(rows()[0]!).getByText('Family')).toBeInTheDocument(),
    )
  })

  it('adds a guest to a group, joining an existing one whatever the capitals, with no table to choose yet', async () => {
    const { services } = await openGuests()

    fireEvent.click(screen.getByRole('button', { name: 'Add Guest' }))
    const dialog = await screen.findByRole('dialog', { name: 'Add Guest' })
    const group = within(dialog).getByRole('combobox', { name: 'Group' })
    fireEvent.click(group)
    expect(
      within(within(dialog).getByRole('listbox', { name: 'Group' }))
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['Family', 'Friends', 'Neighbours', 'Work'])
    expect(within(dialog).getByLabelText('Table')).toBeDisabled()
    expect(
      within(dialog).getByText('Available once the guest approves.'),
    ).toBeInTheDocument()

    fillGuestForm(dialog, {
      firstName: 'Grouped',
      lastName: 'Guest',
      phone: '050-555-0177',
    })
    change(group, { target: { value: ' friends ' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add Guest' }))

    // An existing group, whatever the capitals, is joined without asking.
    await screen.findByText('The guest was added.')
    expect(
      screen.queryByRole('dialog', { name: 'Create a New Group?' }),
    ).not.toBeInTheDocument()
    const added = await find(services, (guest) => guest.firstName === 'Grouped')
    expect(added).toMatchObject({ group: 'Friends', tableId: null })
  })

  it('changes an approved guest’s group and table from the form, and shows the group in the details', async () => {
    const services = createTestServices()
    const guest = await find(
      services,
      (candidate) =>
        candidate.rsvpStatus === 'APPROVED' &&
        candidate.tableId !== null &&
        candidate.confirmedAttendees === 1,
    )
    const tables = await services.tables.list(MAIN)
    const target = tables.find(
      (item) => item.table.id !== guest.tableId && item.available >= 1,
    )!
    const name = guestFullName(guest)
    await openGuests(`?q=${encodeURIComponent(guest.phone)}`, services)

    openEditGuest(rowOf(name), name)
    const dialog = await screen.findByRole('dialog', { name: 'Edit Guest' })
    const table = within(dialog).getByLabelText('Table')
    expect(table).toBeEnabled()
    expect(table).toHaveValue(guest.tableId)
    expect(
      optionLabels(table).every((label) =>
        /^(No table|\d+|\d+ \(\d+ free\))$/.test(label),
      ),
    ).toBe(true)

    change(table, { target: { value: target.table.id } })
    change(within(dialog).getByRole('combobox', { name: 'Group' }), {
      target: { value: 'Choir' },
    })
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Save Changes' }),
    )
    fireEvent.click(
      within(
        await screen.findByRole('dialog', { name: 'Create a New Group?' }),
      ).getByRole('button', { name: 'Create Group' }),
    )

    await screen.findByText('The guest was updated.')
    expect(
      await find(services, (candidate) => candidate.id === guest.id),
    ).toMatchObject({ group: 'Choir', tableId: target.table.id })

    fireEvent.click(within(guestTable()).getByRole('button', { name }))
    const panel = await screen.findByRole('dialog', { name: 'Guest Details' })
    expect(within(panel).getByText('Choir')).toBeInTheDocument()
  })

  it('keeps the form open and explains when the chosen table is full', async () => {
    const services = createTestServices()
    const tables = await services.tables.list(MAIN)
    const guest = await find(
      services,
      (candidate) =>
        candidate.rsvpStatus === 'APPROVED' &&
        tables.some(
          (item) =>
            item.table.id !== candidate.tableId &&
            item.available < (candidate.confirmedAttendees ?? 0),
        ),
    )
    const full = tables.find(
      (item) =>
        item.table.id !== guest.tableId &&
        item.available < (guest.confirmedAttendees ?? 0),
    )!
    const name = guestFullName(guest)
    await openGuests(`?q=${encodeURIComponent(guest.phone)}`, services)

    openEditGuest(rowOf(name), name)
    const dialog = await screen.findByRole('dialog', { name: 'Edit Guest' })
    change(within(dialog).getByLabelText('Table'), {
      target: { value: full.table.id },
    })
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Save Changes' }),
    )

    expect(await within(dialog).findByRole('alert')).toBeInTheDocument()
    expect(
      (await find(services, (candidate) => candidate.id === guest.id)).tableId,
    ).toBe(guest.tableId)
  })

  it('centres the number columns and shows tables by number alone', async () => {
    const services = createTestServices()
    const guest = await find(
      services,
      (candidate) => candidate.tableId !== null,
    )
    const table = (await services.tables.list(MAIN)).find(
      (item) => item.table.id === guest.tableId,
    )!
    const name = guestFullName(guest)
    await openGuests(`?q=${encodeURIComponent(guest.phone)}`, services)

    const cells = within(rowOf(name)).getAllByRole('cell')
    const centred = cells.filter((cell) => /center/.test(cell.className))
    expect(centred).toHaveLength(4)
    const selector = within(rowOf(name)).getByRole('combobox', {
      name: `Table for ${name}`,
    })
    // The closed selector shows the number alone.
    expect(selector).toHaveTextContent(new RegExp(`^${table.table.number}$`))
  })
})

describe('Choosing a group in the guest form', () => {
  async function openAddGuest() {
    const view = await openGuests()
    fireEvent.click(screen.getByRole('button', { name: 'Add Guest' }))
    const dialog = await screen.findByRole('dialog', { name: 'Add Guest' })
    fillGuestForm(dialog, { firstName: 'Picky', phone: '050-555-0188' })
    return {
      ...view,
      dialog,
      group: within(dialog).getByRole('combobox', { name: 'Group' }),
    }
  }
  const options = (dialog: HTMLElement) =>
    within(within(dialog).getByRole('listbox', { name: 'Group' }))
      .getAllByRole('option')
      .map((option) => option.textContent)

  it('narrows the groups as you type, offers to create a new one, and can be cleared', async () => {
    const { dialog, group } = await openAddGuest()

    change(group, { target: { value: 'fr' } })
    expect(options(dialog)).toEqual(['No Group', 'Friends', 'Create "fr"'])

    fireEvent.click(within(dialog).getByRole('option', { name: 'Friends' }))
    expect(group).toHaveValue('Friends')
    expect(within(dialog).queryByRole('listbox')).not.toBeInTheDocument()

    fireEvent.click(within(dialog).getByRole('button', { name: 'Show groups' }))
    expect(options(dialog)).toEqual([
      'No Group',
      'Family',
      'Friends',
      'Neighbours',
      'Work',
    ])
    expect(
      within(dialog).getByRole('option', { name: 'Friends' }),
    ).toHaveAttribute('aria-selected', 'true')

    fireEvent.click(within(dialog).getByRole('option', { name: 'No Group' }))
    expect(group).toHaveValue('')
  })

  it('is usable from the keyboard, and Escape closes the list but not the form', async () => {
    const { dialog, group } = await openAddGuest()

    fireEvent.keyDown(group, { key: 'ArrowDown' })
    expect(group).toHaveAttribute('aria-expanded', 'true')
    fireEvent.keyDown(group, { key: 'ArrowDown' })
    fireEvent.keyDown(group, { key: 'ArrowDown' })
    expect(group.getAttribute('aria-activedescendant')).toBe(
      within(dialog).getByRole('option', { name: 'Friends' }).id,
    )
    fireEvent.keyDown(group, { key: 'ArrowUp' })
    fireEvent.keyDown(group, { key: 'Enter' })
    expect(group).toHaveValue('Family')

    fireEvent.keyDown(group, { key: 'ArrowDown' })
    fireEvent.keyDown(group, { key: 'Escape' })
    expect(within(dialog).queryByRole('listbox')).not.toBeInTheDocument()
    expect(
      screen.getByRole('dialog', { name: 'Add Guest' }),
    ).toBeInTheDocument()
  })

  it('asks before creating a new group: Cancel saves nothing, Create Group saves', async () => {
    const { services, dialog, group } = await openAddGuest()
    const before = (await services.guests.list(MAIN)).length

    change(group, { target: { value: 'Famly' } })
    fireEvent.click(
      within(dialog).getByRole('option', { name: 'Create "Famly"' }),
    )
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add Guest' }))
    const confirm = await screen.findByRole('dialog', {
      name: 'Create a New Group?',
    })
    expect(
      within(confirm).getByText(
        'The group "Famly" does not exist yet. Create it and put this guest in it?',
      ),
    ).toBeInTheDocument()
    // Enter, pressed again after typing the name, creates the group.
    expect(
      within(confirm).getByRole('button', { name: 'Create Group' }),
    ).toHaveFocus()

    fireEvent.click(within(confirm).getByRole('button', { name: 'Cancel' }))
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: 'Create a New Group?' }),
      ).not.toBeInTheDocument(),
    )
    expect(await services.guests.list(MAIN)).toHaveLength(before)
    expect(group).toHaveValue('Famly')

    change(group, { target: { value: 'Choir' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add Guest' }))
    fireEvent.click(
      within(
        await screen.findByRole('dialog', { name: 'Create a New Group?' }),
      ).getByRole('button', { name: 'Create Group' }),
    )

    await screen.findByText('The guest was added.')
    expect(
      await find(services, (guest) => guest.firstName === 'Picky'),
    ).toMatchObject({ group: 'Choir' })
  })
})

describe('Column chooser panel', () => {
  it('stays open while columns are toggled by their names, and closes on a click outside or Escape', async () => {
    await openGuests()
    fireEvent.click(screen.getByRole('button', { name: 'Choose columns' }))
    const panel = screen.getByRole('group', { name: 'Choose columns' })

    fireEvent.click(within(panel).getByText('Confirmed'))
    fireEvent.click(within(panel).getByText('Group'))
    // Focus landing on the page area around the panel is not a move away.
    fireEvent.focusIn(screen.getByRole('main'))

    expect(panel).toBeInTheDocument()
    expect(
      within(panel).getByRole('checkbox', { name: 'Confirmed' }),
    ).not.toBeChecked()
    expect(
      within(panel).getByRole('checkbox', { name: 'Group' }),
    ).not.toBeChecked()

    fireEvent.pointerDown(screen.getByRole('heading', { level: 1 }))
    expect(
      screen.queryByRole('group', { name: 'Choose columns' }),
    ).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Choose columns' }))
    fireEvent.keyDown(screen.getByRole('group', { name: 'Choose columns' }), {
      key: 'Escape',
    })
    expect(
      screen.queryByRole('group', { name: 'Choose columns' }),
    ).not.toBeInTheDocument()
  })
})
