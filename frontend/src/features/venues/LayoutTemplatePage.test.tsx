import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { createTestServices, renderApp } from '../../test/renderApp.tsx'

const withVenues = () => createTestServices({ venues: true })
const EDITOR = '/venues/org-1/spaces/spc-1-1/layouts/tpl-1-1-3'

async function openEditor(path = EDITOR) {
  renderApp(path, withVenues())
  return screen.findByRole('heading', { level: 1, name: /Bar Mitzvah Mixed/ })
}

describe('the layout template editor (Phase 26, mockup #6)', () => {
  it('shows the template with its figures against the space', async () => {
    await openEditor()
    expect(
      screen.getByRole('link', { name: 'Back to Main Hall' }),
    ).toBeVisible()
    expect(screen.getByText('Total Tables')).toBeVisible()
    expect(screen.getByText('people in Main Hall')).toBeVisible()
    expect(screen.getByText(/Not used by upcoming events/)).toBeVisible()
    expect(screen.getByText(/Select a table to see its details/)).toBeVisible()
    expect(screen.getByRole('button', { name: 'Edit Layout' })).toBeVisible()
  })

  it('renames the template, refusing a name another layout has', async () => {
    await openEditor()
    fireEvent.click(screen.getByRole('button', { name: 'Rename' }))
    const dialog = within(screen.getByRole('dialog', { name: 'Rename Layout' }))
    const name = dialog.getByRole('textbox', { name: /Layout Name/ })

    fireEvent.change(name, { target: { value: 'wedding rounds' } })
    fireEvent.click(dialog.getByRole('button', { name: 'Save Name' }))
    expect(
      await dialog.findByText('Another layout of this space has this name'),
    ).toBeVisible()

    fireEvent.change(name, { target: { value: 'Mitzvah Mix' } })
    fireEvent.click(dialog.getByRole('button', { name: 'Save Name' }))
    expect(
      await screen.findByRole('heading', { level: 1, name: /Mitzvah Mix/ }),
    ).toBeVisible()
  })

  it('adds a table, lists it, and deletes it', async () => {
    await openEditor()
    fireEvent.click(screen.getByRole('button', { name: 'Add Table' }))
    const dialog = within(screen.getByRole('dialog', { name: /Add Table/ }))
    fireEvent.click(dialog.getByRole('button', { name: /Add Table/ }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())

    fireEvent.click(screen.getByRole('tab', { name: 'Tables' }))
    const table = await screen.findByRole('table', {
      name: 'Tables of this layout',
    })
    expect(within(table).getAllByRole('row')).toHaveLength(14)

    fireEvent.click(
      within(table).getByRole('button', { name: 'Delete Table: Table 13' }),
    )
    fireEvent.click(
      within(screen.getByRole('dialog', { name: /Delete table 13/ })).getByRole(
        'button',
        { name: 'Delete Table' },
      ),
    )
    await waitFor(() =>
      expect(within(table).getAllByRole('row')).toHaveLength(13),
    )
  })

  it('refuses a table number the template already has', async () => {
    await openEditor()
    fireEvent.click(screen.getByRole('button', { name: 'Add Table' }))
    const dialog = within(screen.getByRole('dialog', { name: /Add Table/ }))
    fireEvent.change(dialog.getByRole('spinbutton', { name: /Number/ }), {
      target: { value: '3' },
    })
    fireEvent.click(dialog.getByRole('button', { name: /Add Table/ }))
    expect(await dialog.findByText(/already/i)).toBeVisible()
  })

  it('shows an archived template read-only', async () => {
    renderApp('/venues/org-1/spaces/spc-1-1/layouts/tpl-1-1-4', withVenues())
    expect(await screen.findByText('This layout is archived')).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Add Table' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Edit Layout' })).toBeNull()
  })

  it('is not found under another space or another venue', async () => {
    renderApp('/venues/org-1/spaces/spc-1-2/layouts/tpl-1-1-3', withVenues())
    expect(
      await screen.findByRole('heading', { name: 'Page not found' }),
    ).toBeVisible()
    renderApp('/venues/org-2/spaces/spc-2-1/layouts/tpl-1-1-3', withVenues())
    expect(
      await screen.findAllByRole('heading', { name: 'Page not found' }),
    ).not.toHaveLength(0)
  })
})

describe('opening the editor from the space', () => {
  it('opens a layout from its card', async () => {
    renderApp('/venues/org-1/spaces/spc-1-1', withVenues())
    await screen.findByRole('list', { name: 'Layouts' })
    fireEvent.click(
      screen.getByRole('link', { name: 'Edit: Bar Mitzvah Mixed' }),
    )
    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: /Bar Mitzvah Mixed/,
      }),
    ).toBeVisible()
  })

  it('adds a layout and opens it, empty', async () => {
    renderApp('/venues/org-1/spaces/spc-1-3', withVenues())
    await screen.findByText('No layouts yet')
    fireEvent.click(screen.getByRole('button', { name: 'Add Layout' }))
    const dialog = within(screen.getByRole('dialog', { name: 'Add Layout' }))
    fireEvent.change(dialog.getByRole('textbox', { name: /Layout Name/ }), {
      target: { value: 'Rooftop Cocktail' },
    })
    fireEvent.click(dialog.getByRole('button', { name: 'Create Layout' }))

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: /Rooftop Cocktail/,
      }),
    ).toBeVisible()
    expect(screen.getByText('Total Tables')).toBeVisible()
  })

  it('adds a layout from My Spaces too', async () => {
    renderApp('/venues/org-1/spaces', withVenues())
    await screen.findByRole('list', { name: 'Spaces' })
    fireEvent.click(screen.getByRole('button', { name: 'Add Layout' }))
    const dialog = within(screen.getByRole('dialog', { name: 'Add Layout' }))
    fireEvent.change(dialog.getByRole('textbox', { name: /Layout Name/ }), {
      target: { value: 'First Layout' },
    })
    fireEvent.click(dialog.getByRole('button', { name: 'Create Layout' }))
    expect(
      await screen.findByRole('heading', { level: 1, name: /First Layout/ }),
    ).toBeVisible()
  })
})
