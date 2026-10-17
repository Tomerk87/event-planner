import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { parseCsv } from '../../domain/csv.ts'
import { guestFullName } from '../../domain/guestList.ts'
import type { Guest } from '../../domain/models.ts'
import { partiesAt, seatingCandidates } from '../../domain/seating.ts'
import { changeLanguage } from '../../i18n/i18n.ts'
import type {
  Services,
  TableWithOccupancy,
} from '../../services/contracts/index.ts'
import { change } from '../../test/controls.ts'
import { setViewportWidth } from '../../test/matchMedia.ts'
import {
  createTestServices,
  DEMO_EVENTS,
  renderApp,
} from '../../test/renderApp.tsx'

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

async function openLayout(
  query = '',
  services: Services = createTestServices(),
  eventId: string = MAIN,
) {
  const view = renderApp(`/events/${eventId}/layout${query}`, services)
  await screen.findByRole('region', { name: 'Seating figures' })
  return view
}

function tablesTable() {
  return screen.getByRole('table', { name: 'Tables' })
}

function rows() {
  return within(tablesTable()).getAllByRole('row').slice(1)
}

/** The table numbers listed, in order. */
function shownNumbers() {
  return rows().map((row) => Number(row.querySelector('td')?.textContent))
}

function rowOf(number: number) {
  const row = rows().find(
    (candidate) =>
      candidate.querySelector('td')?.textContent === String(number),
  )
  if (!row) {
    throw new Error(`no row for table ${number}`)
  }
  return row
}

function cells(number: number) {
  return within(rowOf(number))
    .getAllByRole('cell')
    .map((cell) => cell.textContent)
}

/** Chooses a table by a click on its number. */
function choose(number: number) {
  fireEvent.click(rowOf(number).querySelector('td')!)
}

const LIST_HINT = 'Select a table in the list to see its guests here.'

function kpi(label: string) {
  const figures = screen.getByRole('region', { name: 'Seating figures' })
  return within(figures)
    .getByText(label)
    .parentElement?.querySelectorAll('p')[1]?.textContent
}

function selectedPanel() {
  const panel = screen
    .getByRole('heading', { name: 'Selected Table' })
    .closest('section')
  if (!panel) {
    throw new Error('no Selected Table panel')
  }
  return within(panel)
}

async function tableNumbered(
  services: Services,
  number: number,
  eventId: string = MAIN,
): Promise<TableWithOccupancy> {
  const item = (await services.tables.list(eventId)).find(
    ({ table }) => table.number === number,
  )
  if (!item) {
    throw new Error(`no table ${number} in the demo data`)
  }
  return item
}

function openGuestsOf(number: number) {
  fireEvent.click(
    within(rowOf(number)).getByRole('button', {
      name: `Manage guests of Table ${number}`,
    }),
  )
  return screen.getByRole('dialog', { name: `Guests of Table ${number}` })
}

function partyNames(list: HTMLElement) {
  return within(list)
    .getAllByRole('listitem')
    .map((item) => item.querySelector('span')?.textContent)
}

function fillTableForm(
  dialog: HTMLElement,
  values: { number?: string; capacity?: string; shape?: string },
) {
  const fields = within(dialog)
  if (values.number !== undefined) {
    change(fields.getByLabelText(/Table Number/), {
      target: { value: values.number },
    })
  }
  if (values.capacity !== undefined) {
    change(fields.getByLabelText(/Capacity/), {
      target: { value: values.capacity },
    })
  }
  if (values.shape !== undefined) {
    change(fields.getByRole('combobox', { name: 'Shape' }), {
      target: { value: values.shape },
    })
  }
}

async function lastDownload() {
  await waitFor(() => expect(downloads.length).toBeGreaterThan(0))
  const { name, blob } = downloads[downloads.length - 1]!
  return { name, rows: parseCsv(await blob.text()) }
}

describe('Event Layout', () => {
  it('shows the seating figures, the tabs and the first page of tables by number', async () => {
    const { services } = await openLayout()
    const tables = await services.tables.list(MAIN)
    const capacity = tables.reduce((sum, item) => sum + item.table.capacity, 0)
    const assigned = tables.reduce((sum, item) => sum + item.assigned, 0)

    expect(kpi('Total Tables')).toBe(String(tables.length))
    expect(kpi('Seating Capacity')).toBe(String(capacity))
    expect(kpi('Assigned Attendees')).toBe(String(assigned))
    expect(kpi('Available Seats')).toBe(String(capacity - assigned))

    expect(screen.getByRole('tab', { name: 'Tables' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    expect(screen.getByRole('tab', { name: 'Table Arrangement' })).toBeEnabled()

    expect(shownNumbers()).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    expect(screen.getByText('1–10 of 18 tables')).toBeInTheDocument()
    expect(
      within(tablesTable())
        .getAllByRole('columnheader')
        .map((heading) => heading.textContent),
    ).toEqual([
      '#',
      'Shape',
      'Capacity',
      'Assigned',
      'Available',
      'Status',
      'Actions',
    ])
  })

  it('labels each table by its free seats', async () => {
    const { services } = await openLayout('?size=25')
    const tables = await services.tables.list(MAIN)
    const label = (available: number) =>
      available < 0
        ? 'Over Capacity'
        : available === 0
          ? 'Full'
          : available <= 2
            ? 'Almost Full'
            : 'Ready'

    for (const { table, assigned, available } of tables) {
      expect(cells(table.number).slice(0, 6)).toEqual([
        String(table.number),
        { CIRCLE: 'Circle', RECTANGLE: 'Rectangle', SQUARE: 'Square' }[
          table.shape
        ],
        String(table.capacity),
        String(assigned),
        String(available),
        label(available),
      ])
    }
    // The demo shows every label.
    expect(new Set(tables.map((item) => label(item.available))).size).toBe(4)
  })

  it('searches by number, filters by shape and says when nothing matches', async () => {
    await openLayout()

    change(screen.getByRole('searchbox', { name: 'Search tables' }), {
      target: { value: '1' },
    })
    await waitFor(() =>
      expect(shownNumbers()).toEqual([1, 10, 11, 12, 13, 14, 15, 16, 17, 18]),
    )

    change(screen.getByRole('combobox', { name: 'Shape' }), {
      target: { value: 'SQUARE' },
    })
    await waitFor(() => expect(shownNumbers()).toEqual([12, 16]))

    change(screen.getByRole('searchbox', { name: 'Search tables' }), {
      target: { value: 'family' },
    })
    expect(await screen.findByText('No tables match')).toBeInTheDocument()
  })

  it('sorts by a column heading, and back the other way', async () => {
    const { services } = await openLayout('?size=25')
    const byAvailable = (await services.tables.list(MAIN))
      .sort(
        (a, b) => a.available - b.available || a.table.number - b.table.number,
      )
      .map((item) => item.table.number)

    fireEvent.click(screen.getByRole('button', { name: 'Available' }))
    await waitFor(() => expect(shownNumbers()).toEqual(byAvailable))

    fireEvent.click(screen.getByRole('button', { name: 'Available' }))
    await waitFor(() => expect(shownNumbers()[0]).toBe(byAvailable.at(-1)))
  })

  it('pages through the tables', async () => {
    await openLayout()

    fireEvent.click(screen.getByRole('button', { name: 'Page 2' }))

    await waitFor(() =>
      expect(shownNumbers()).toEqual([11, 12, 13, 14, 15, 16, 17, 18]),
    )
    expect(screen.getByText('11–18 of 18 tables')).toBeInTheDocument()
  })

  it('has no Capacity Warnings card or preview; a table over capacity says so in its row', async () => {
    setViewportWidth(1440)
    const { services } = await openLayout('?size=25')
    const dashboard = await services.dashboard.get(MAIN)
    const [first] = dashboard.warnings.tablesOverCapacity

    expect(
      screen.queryByRole('heading', { name: 'Capacity Warnings' }),
    ).toBeNull()
    expect(
      screen.queryByRole('heading', { name: 'Arrangement Preview' }),
    ).toBeNull()
    expect(screen.queryByRole('group', { name: 'Floor plan' })).toBeNull()
    expect(cells(first!.tableNumber)[5]).toBe('Over Capacity')
    // Nothing is chosen to begin with, even with a table over capacity.
    expect(selectedPanel().getByText(LIST_HINT)).toBeInTheDocument()
  })
  it('shows the seating notices in cards of their own, as on the Dashboard, on both tabs', async () => {
    const { services } = await openLayout()
    const { warnings } = await services.dashboard.get(MAIN)

    for (const tab of ['Tables', 'Table Arrangement']) {
      fireEvent.click(screen.getByRole('tab', { name: tab }))
      const cards = within(
        await screen.findByRole('list', { name: 'Warnings' }),
      )
      expect(cards.getAllByRole('listitem')).toHaveLength(2)
      // Seating as a whole only informs: it is this page.
      expect(cards.getByText('Not enough seats').closest('a')).toBeNull()
      expect(
        cards.getByRole('link', {
          name: /Confirmed attendees without a table/,
        }),
      ).toHaveAttribute(
        'href',
        `/events/${MAIN}/guests?rsvp=APPROVED&table=NONE`,
      )
      expect(
        cards.getByText(
          `${warnings.attendeesAwaitingTable} confirmed attendees are not assigned to a table yet.`,
        ),
      ).toBeInTheDocument()
    }
    expect(
      screen.queryByRole('heading', { name: 'Capacity Warnings' }),
    ).toBeNull()
  })

  it('chooses one table by its row, shows it beside the list, and lets go on a second click', async () => {
    setViewportWidth(1440)
    const { services } = await openLayout()
    const guests = await services.guests.list(MAIN)
    const item = await tableNumbered(services, 3)
    const parties = partiesAt(item.table.id, guests)

    expect(screen.queryByRole('checkbox')).toBeNull()
    expect(within(rowOf(3)).queryByRole('button', { name: '3' })).toBeNull()
    choose(3)

    const panel = selectedPanel()
    expect(panel.getByText('Table 3')).toBeInTheDocument()
    expect(rowOf(3)).toHaveAttribute('aria-current', 'true')
    expect(
      panel.getByText(`Assigned Guest Parties (${parties.length})`),
    ).toBeInTheDocument()
    expect(
      partyNames(
        panel.getByRole('list', { name: 'Guest parties at this table' }),
      ),
    ).toEqual(parties.map(guestFullName))
    expect(panel.getByRole('button', { name: 'Edit Table' })).toBeEnabled()
    expect(panel.getByRole('button', { name: 'Manage Guests' })).toBeEnabled()
    // Choosing a table opens nothing.
    expect(screen.queryByRole('dialog')).toBeNull()

    // One at a time: another row takes its place.
    fireEvent.keyDown(rowOf(5), { key: 'Enter' })
    expect(selectedPanel().getByText('Table 5')).toBeInTheDocument()
    expect(rowOf(3)).not.toHaveAttribute('aria-current')

    choose(5)
    expect(selectedPanel().getByText(LIST_HINT)).toBeInTheDocument()
  })
  it('keeps the chosen table while paging and on the other tab', async () => {
    await openLayout()

    choose(2)
    fireEvent.click(screen.getByRole('button', { name: 'Page 2' }))
    await waitFor(() => expect(shownNumbers()[0]).toBe(11))
    expect(selectedPanel().getByText('Table 2')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: 'Table Arrangement' }))
    expect(
      await screen.findByRole('button', { name: /^Table 2,/ }),
    ).toHaveAttribute('aria-pressed', 'true')
    expect(selectedPanel().getByText('Table 2')).toBeInTheDocument()
  })
  it('adds a table, continuing the numbering, and refuses a number in use', async () => {
    const { services } = await openLayout('?size=25')

    fireEvent.click(screen.getByRole('button', { name: 'Add Table' }))
    const dialog = screen.getByRole('dialog', { name: 'Add Table' })
    expect(within(dialog).getByLabelText(/Table Number/)).toHaveValue(19)
    // Ten chairs to begin with, whatever the other tables have.
    expect(within(dialog).getByLabelText(/Capacity/)).toHaveValue(10)

    fillTableForm(dialog, { number: '4' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add Table' }))
    expect(
      await within(dialog).findByText('Table number 4 is already in use.'),
    ).toBeInTheDocument()

    fillTableForm(dialog, { number: '40', capacity: '0' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add Table' }))
    expect(
      await within(dialog).findByText(
        'Enter a whole number of chairs from 1 to 1000.',
      ),
    ).toBeInTheDocument()

    fillTableForm(dialog, { capacity: '6', shape: 'SQUARE' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add Table' }))

    expect(await screen.findByText('Table 40 was added.')).toBeInTheDocument()
    await waitFor(() =>
      expect(cells(40).slice(0, 6)).toEqual([
        '40',
        'Square',
        '6',
        '0',
        '6',
        'Ready',
      ]),
    )
    expect((await tableNumbered(services, 40)).table).toMatchObject({
      capacity: 6,
      shape: 'SQUARE',
    })
  })

  it('edits a table, and lowering its chairs below the seated attendees puts it over capacity', async () => {
    const { services } = await openLayout()
    const before = await tableNumbered(services, 1)

    // The row offers Edit in place of a ⋯ menu (D105).
    fireEvent.click(
      within(rowOf(1)).getByRole('button', { name: 'Edit Table 1' }),
    )
    const dialog = screen.getByRole('dialog', { name: 'Edit Table 1' })
    expect(
      within(dialog).getByRole('button', { name: 'Delete Table' }),
    ).toBeInTheDocument()
    fillTableForm(dialog, { capacity: String(before.assigned - 2) })

    expect(
      within(dialog).getByText('Fewer chairs than seated attendees'),
    ).toBeInTheDocument()
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Save Changes' }),
    )

    expect(await screen.findByText('Table 1 was saved.')).toBeInTheDocument()
    await waitFor(() => expect(cells(1)[5]).toBe('Over Capacity'))
    expect(cells(1)[4]).toBe('-2')
  })

  it('offers Delete Table in Edit Table, opening the same confirmation (D105)', async () => {
    await openLayout()

    fireEvent.click(
      within(rowOf(3)).getByRole('button', { name: 'Edit Table 3' }),
    )
    fireEvent.click(
      within(screen.getByRole('dialog', { name: 'Edit Table 3' })).getByRole(
        'button',
        { name: 'Delete Table' },
      ),
    )
    const dialog = screen.getByRole('dialog', { name: 'Delete Table 3' })
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Delete Table' }),
    )

    expect(await screen.findByText('Table 3 was deleted.')).toBeInTheDocument()
  })

  it('deletes a table after confirming, leaving its guests without a table', async () => {
    const { services } = await openLayout()
    const item = await tableNumbered(services, 2)
    const seated = partiesAt(item.table.id, await services.guests.list(MAIN))
    choose(2)

    // Deleting is offered on the Selected Table card (D105).
    fireEvent.click(
      selectedPanel().getByRole('button', { name: 'Delete Table' }),
    )
    const dialog = screen.getByRole('dialog', { name: 'Delete Table 2' })
    expect(
      within(dialog).getByText(
        `Guest parties at this table: ${seated.length} (attendees: ${item.assigned}). They will be left without a table.`,
      ),
    ).toBeInTheDocument()

    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Delete Table' }),
    )

    expect(await screen.findByText('Table 2 was deleted.')).toBeInTheDocument()
    await waitFor(() => expect(shownNumbers()).not.toContain(2))
    // The deleted table is no longer chosen.
    expect(selectedPanel().getByText(LIST_HINT)).toBeInTheDocument()
    const after = await services.guests.list(MAIN)
    for (const guest of seated) {
      expect(after.find((other) => other.id === guest.id)).toMatchObject({
        tableId: null,
        rsvpStatus: 'APPROVED',
        deleted: false,
      })
    }
  })

  it('removes a party from a table and adds one that was waiting', async () => {
    const { services } = await openLayout()
    const item = await tableNumbered(services, 3)
    const guests = await services.guests.list(MAIN)
    const [leaving] = partiesAt(item.table.id, guests)
    const joining = seatingCandidates(item.table.id, guests).find(
      (guest) =>
        guest.tableId === null && (guest.confirmedAttendees ?? 0) === 1,
    )!

    const dialog = openGuestsOf(3)
    fireEvent.click(
      within(dialog).getByRole('button', {
        name: `Remove ${guestFullName(leaving!)} from this table`,
      }),
    )
    await waitFor(async () =>
      expect(
        (await services.guests.list(MAIN)).find(
          (guest) => guest.id === leaving!.id,
        )?.tableId,
      ).toBeNull(),
    )

    change(
      within(dialog).getByRole('searchbox', { name: 'Search guests to add' }),
      { target: { value: guestFullName(joining) } },
    )
    fireEvent.click(
      await within(dialog).findByRole('button', {
        name: `Add ${guestFullName(joining)} to this table`,
      }),
    )

    await waitFor(() =>
      expect(
        partyNames(
          within(dialog).getByRole('list', {
            name: 'Guest parties at this table',
          }),
        ),
      ).toContain(guestFullName(joining)),
    )
    expect(
      (await services.guests.list(MAIN)).find(
        (guest) => guest.id === joining.id,
      )?.tableId,
    ).toBe(item.table.id)
  })

  it('moves a party from another table, and offers no button to a party that does not fit', async () => {
    const { services } = await openLayout()
    const target = await tableNumbered(services, 3)
    const guests = await services.guests.list(MAIN)
    const numbers = new Map(
      (await services.tables.list(MAIN)).map(({ table }) => [
        table.id,
        table.number,
      ]),
    )
    const candidates = seatingCandidates(target.table.id, guests)
    const moving = candidates.find(
      (guest) =>
        guest.tableId !== null &&
        (guest.confirmedAttendees ?? 0) <= target.available,
    )!
    const tooBig = candidates.find(
      (guest) => (guest.confirmedAttendees ?? 0) > target.available,
    )!

    const dialog = openGuestsOf(3)
    const searchFor = (guest: Guest) =>
      change(
        within(dialog).getByRole('searchbox', { name: 'Search guests to add' }),
        { target: { value: guest.phone } },
      )

    searchFor(tooBig)
    expect(await within(dialog).findByText('Does not fit')).toBeInTheDocument()
    expect(
      within(dialog).queryByRole('button', { name: /to this table$/ }),
    ).not.toBeInTheDocument()

    searchFor(moving)
    const candidate = (
      await within(dialog).findByRole('button', {
        name: `Move ${guestFullName(moving)} to this table`,
      })
    ).closest('li')!
    // The table the party would leave is named.
    expect(
      within(candidate).getByText(`Table ${numbers.get(moving.tableId!)}`),
    ).toBeInTheDocument()
    fireEvent.click(within(candidate).getByRole('button'))

    await waitFor(async () =>
      expect(
        (await services.guests.list(MAIN)).find(
          (guest) => guest.id === moving.id,
        )?.tableId,
      ).toBe(target.table.id),
    )
  })

  it('reports a failed assignment in the dialog', async () => {
    const services = createTestServices({
      failOperations: new Set(['guests.assignTable']),
    })
    await openLayout('', services)
    const item = await tableNumbered(services, 3)
    const [seated] = partiesAt(item.table.id, await services.guests.list(MAIN))

    const dialog = openGuestsOf(3)
    fireEvent.click(
      within(dialog).getByRole('button', {
        name: `Remove ${guestFullName(seated!)} from this table`,
      }),
    )

    expect(await within(dialog).findByRole('alert')).toBeInTheDocument()
  })

  it('exports the seating list as CSV, a row per seated party in table order', async () => {
    const { services } = await openLayout()
    const guests = await services.guests.list(MAIN)
    const tables = await services.tables.list(MAIN)

    fireEvent.click(screen.getByRole('button', { name: 'Export Tables' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'CSV file (.csv)' }))

    const file = await lastDownload()
    expect(file.name).toMatch(/ - seating\.csv$/)
    expect(file.rows[0]).toEqual([
      'First Name',
      'Last Name',
      'Invitation Name',
      'Phone',
      'Number of Attendees',
      'Table Number',
    ])
    const body = file.rows.slice(1)
    expect(body).toHaveLength(
      tables.reduce(
        (sum, { table }) => sum + partiesAt(table.id, guests).length,
        0,
      ),
    )
    const tableColumn = body.map((row) => Number(row[5]))
    expect(tableColumn).toEqual([...tableColumn].sort((a, b) => a - b))
    const [first] = partiesAt(tables[0]!.table.id, guests)
    expect(body[0]).toEqual([
      first!.firstName,
      first!.lastName,
      first!.invitationName ?? '',
      first!.phone,
      String(first!.confirmedAttendees),
      '1',
    ])
    expect(await screen.findByText('The file was downloaded.')).toBeVisible()
  })

  it('exports the seating list as Excel', async () => {
    await openLayout()

    fireEvent.click(screen.getByRole('button', { name: 'Export Tables' }))
    fireEvent.click(
      screen.getByRole('menuitem', { name: 'Excel file (.xlsx)' }),
    )

    await waitFor(() => expect(downloads).toHaveLength(1))
    expect(downloads[0]!.name).toMatch(/ - seating\.xlsx$/)
  })

  it.each([
    [DEMO_EVENTS.viewer, 'View-only access'],
    [DEMO_EVENTS.past, 'This event has ended'],
  ])(
    'is read-only at %s, with viewing and export still offered',
    async (eventId, notice) => {
      const { services } = await openLayout('', createTestServices(), eventId)
      const [first] = await services.tables.list(eventId)
      const name = `Table ${first!.table.number}`

      expect(screen.getByText(notice)).toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: 'Add Table' }),
      ).not.toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: `Edit ${name}` }),
      ).not.toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: 'Delete Table' }),
      ).not.toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: 'Manage Guests' }),
      ).not.toBeInTheDocument()

      fireEvent.click(
        screen.getByRole('button', { name: `View guests of ${name}` }),
      )
      const dialog = screen.getByRole('dialog', { name: `Guests of ${name}` })
      expect(
        within(dialog).queryByRole('button', { name: /^Remove/ }),
      ).not.toBeInTheDocument()
      expect(within(dialog).queryByRole('searchbox')).not.toBeInTheDocument()
      fireEvent.click(within(dialog).getByRole('button', { name: 'Done' }))

      fireEvent.click(screen.getByRole('button', { name: 'Export Tables' }))
      fireEvent.click(screen.getByRole('menuitem', { name: 'CSV file (.csv)' }))
      expect((await lastDownload()).rows.length).toBeGreaterThan(1)
    },
  )

  it('shows the chosen table below the list on a narrower screen', async () => {
    setViewportWidth(1024)
    await openLayout()

    choose(3)

    expect(selectedPanel().getByText('Table 3')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).toBeNull()
  })
  it('invites adding the first table when the event has none', async () => {
    const services = createTestServices()
    for (const { table } of await services.tables.list(MAIN)) {
      await services.tables.remove(MAIN, table.id)
    }
    await openLayout('', services)

    expect(screen.getByText('No tables yet')).toBeInTheDocument()
    expect(kpi('Total Tables')).toBe('0')
    expect(selectedPanel().getByText(LIST_HINT)).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Add Table' })).toHaveLength(2)
  })

  it('reports a failure to load, and loads on retry', async () => {
    const failing = new Set(['tables.list'])
    const services = createTestServices({ failOperations: failing })
    renderApp(`/events/${MAIN}/layout`, services)

    expect(await screen.findByRole('alert')).toBeInTheDocument()
    failing.clear()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))

    expect(
      await screen.findByRole('region', { name: 'Seating figures' }),
    ).toBeInTheDocument()
  })

  it('shows cards on a phone, with the guests, a sort menu, and a tapped table below', async () => {
    setViewportWidth(390)
    const { services } = await openLayout()
    const item = await tableNumbered(services, 1)
    const list = screen.getByRole('list', { name: 'Tables' })

    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    const card = within(list).getByText('Table 1').closest('li')!
    expect(
      within(card).getByRole('button', { name: 'Manage guests of Table 1' }),
    ).toHaveTextContent(`View Guests (${item.assigned})`)

    fireEvent.click(
      within(card).getByRole('button', { name: 'Manage guests of Table 1' }),
    )
    fireEvent.click(
      within(
        screen.getByRole('dialog', { name: 'Guests of Table 1' }),
      ).getByRole('button', { name: 'Done' }),
    )

    fireEvent.click(screen.getByRole('button', { name: 'Sort tables' }))
    fireEvent.click(
      screen.getByRole('menuitem', { name: 'Table number, high to low' }),
    )
    await waitFor(() =>
      expect(
        within(screen.getByRole('list', { name: 'Tables' })).getAllByRole(
          'listitem',
        )[0],
      ).toHaveTextContent('Table 18'),
    )

    // A tap on a card chooses its table.
    fireEvent.click(
      within(screen.getByRole('list', { name: 'Tables' })).getByText(
        'Table 18',
      ),
    )
    expect(
      selectedPanel().getByText('Assigned Guest Parties', { exact: false }),
    ).toBeInTheDocument()
    expect(
      within(screen.getByRole('list', { name: 'Tables' })).getAllByRole(
        'listitem',
      )[0],
    ).toHaveAttribute('aria-current', 'true')
  })

  it('is translated to Hebrew', async () => {
    await openLayout()

    await changeLanguage('he')

    expect(
      await screen.findByRole('heading', { level: 1, name: 'סידור האירוע' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('table', { name: 'שולחנות' })).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'הוספת שולחן' }),
    ).toBeInTheDocument()
    expect(screen.getAllByText('כמעט מלא').length).toBeGreaterThan(0)
  })
})
