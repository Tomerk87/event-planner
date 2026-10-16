import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { changeLanguage } from '../../i18n/i18n.ts'
import type { Services } from '../../services/contracts/index.ts'
import { change } from '../../test/controls.ts'
import { setViewportWidth } from '../../test/matchMedia.ts'
import {
  createTestServices,
  DEMO_EVENTS,
  renderApp,
} from '../../test/renderApp.tsx'

const MAIN = DEMO_EVENTS.owner

async function openArrangement(
  services: Services = createTestServices(),
  eventId: string = MAIN,
) {
  const view = renderApp(`/events/${eventId}/layout?view=arrangement`, services)
  await screen.findByRole('group', { name: 'Floor plan' })
  return view
}

function plan() {
  return within(screen.getByRole('group', { name: 'Floor plan' }))
}

function tableOnPlan(number: number) {
  return plan().getByRole('button', { name: new RegExp(`^Table ${number},`) })
}

function inspectorValue(label: string) {
  return (screen.getByLabelText(label) as HTMLInputElement).value
}

async function startEditing() {
  fireEvent.click(screen.getByRole('button', { name: 'Edit Layout' }))
  return screen.findByText('Edit Mode')
}

describe('Table Arrangement (D100)', () => {
  it('is a tab of its own, kept in the address, with no Soon badge', async () => {
    const { router } = renderApp(`/events/${MAIN}/layout`, createTestServices())
    const tab = await screen.findByRole('tab', { name: 'Table Arrangement' })

    expect(tab).toBeEnabled()
    fireEvent.click(tab)

    expect(
      await screen.findByRole('group', { name: 'Floor plan' }),
    ).toBeInTheDocument()
    expect(router.state.location.search).toBe('?view=arrangement')
    expect(screen.queryByRole('table', { name: 'Tables' })).toBeNull()

    fireEvent.click(screen.getByRole('tab', { name: 'Tables' }))
    expect(
      await screen.findByRole('table', { name: 'Tables' }),
    ).toBeInTheDocument()
    expect(router.state.location.search).toBe('')
  })

  it('draws the placed tables with their seats, the objects, and says what is not placed', async () => {
    const { services } = await openArrangement()
    const layout = await services.layout.get(MAIN)
    const tables = await services.tables.list(MAIN)
    const over = tables.find((item) => item.available < 0)!

    expect(plan().getAllByRole('button', { name: /^Table \d+,/ })).toHaveLength(
      layout.placements.length,
    )
    expect(tableOnPlan(over.table.number)).toHaveAccessibleName(
      `Table ${over.table.number}, ${over.assigned} of ${over.table.capacity} seats, Over Capacity`,
    )
    expect(plan().getByRole('img', { name: 'Stage' })).toBeInTheDocument()
    expect(
      plan().getByRole('img', { name: 'Food Station' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Tables not on the plan yet: 1.'),
    ).toBeInTheDocument()
    // Viewing offers no editing handles.
    expect(screen.queryByText('Edit Mode')).toBeNull()
  })

  it('ticks a table on the plan in the same selection as the list', async () => {
    setViewportWidth(1440)
    await openArrangement()

    expect(
      screen.getByText('Select a table on the plan to see its guests here.'),
    ).toBeInTheDocument()
    fireEvent.click(tableOnPlan(3))
    expect(tableOnPlan(3)).toHaveAttribute('aria-pressed', 'true')
    const card = screen
      .getByRole('heading', { name: 'Selected Table' })
      .closest('section')!
    expect(within(card).getByText('Table 3')).toBeInTheDocument()

    // A second click lets go.
    fireEvent.click(tableOnPlan(3))
    expect(tableOnPlan(3)).toHaveAttribute('aria-pressed', 'false')
    expect(
      screen.getByText('Select a table on the plan to see its guests here.'),
    ).toBeInTheDocument()

    fireEvent.keyDown(tableOnPlan(5), { key: 'Enter' })
    fireEvent.click(screen.getByRole('tab', { name: 'Tables' }))
    const row = (
      await screen.findByRole('checkbox', { name: 'Select Table 5' })
    ).closest('tr')!
    expect(within(row).getByRole('checkbox')).toBeChecked()
    expect(
      within(screen.getByRole('region', { name: 'Selected tables' })).getByText(
        '1 selected',
      ),
    ).toBeInTheDocument()
  })

  it('shows a small preview beside the list that opens the tab', async () => {
    setViewportWidth(1440)
    renderApp(`/events/${MAIN}/layout`, createTestServices())
    const preview = (
      await screen.findByRole('heading', { name: 'Arrangement Preview' })
    ).closest('section')!

    fireEvent.click(within(preview).getByRole('button', { name: /^Table 2,/ }))
    expect(
      screen.getByRole('checkbox', { name: 'Select Table 2' }),
    ).toBeChecked()

    fireEvent.click(
      within(preview).getByRole('button', { name: 'Open Arrangement' }),
    )
    expect(
      await screen.findByRole('tab', {
        name: 'Table Arrangement',
        selected: true,
      }),
    ).toBeInTheDocument()
  })

  it('places a table, moves and turns it with the keyboard, adds a stage and saves', async () => {
    const { services } = await openArrangement()
    const before = await services.layout.get(MAIN)
    await startEditing()

    fireEvent.click(
      screen.getByRole('button', { name: 'Place Table 18 on the plan' }),
    )
    expect(screen.getByText('Every table is on the plan.')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Table 18' }),
    ).toBeInTheDocument()
    const x = Number(inspectorValue('From the left (m)'))

    fireEvent.keyDown(tableOnPlan(18), { key: 'ArrowRight' })
    fireEvent.keyDown(tableOnPlan(18), { key: 'ArrowDown', shiftKey: true })
    fireEvent.keyDown(tableOnPlan(18), { key: 'r' })
    expect(Number(inspectorValue('From the left (m)'))).toBeCloseTo(x + 0.1)
    expect(inspectorValue('Turn (°)')).toBe('15')

    // A new item is drawn above every other.
    fireEvent.click(screen.getByRole('button', { name: 'Add Stairs' }))
    expect(plan().getAllByRole('button').at(-1)).toHaveAccessibleName('Stairs')
    fireEvent.keyDown(plan().getAllByRole('button').at(-1)!, { key: 'Delete' })

    fireEvent.click(screen.getByRole('button', { name: 'Add Stage' }))
    change(screen.getByLabelText('Label'), { target: { value: 'Dance floor' } })
    change(screen.getByLabelText('Width (m)'), { target: { value: '4.5' } })

    fireEvent.click(screen.getByRole('button', { name: 'Save Layout' }))

    expect(
      await screen.findByText('The floor plan was saved.'),
    ).toBeInTheDocument()
    expect(screen.queryByText('Edit Mode')).toBeNull()
    const saved = await services.layout.get(MAIN)
    expect(saved.version).toBe(before.version + 1)
    const placement = saved.placements.find(
      (item) => item.tableId === 'tbl-1-18',
    )!
    expect(placement).toMatchObject({
      x: Math.round(x * 100) + 10,
      rotation: 15,
    })
    expect(saved.objects.at(-1)).toMatchObject({
      kind: 'STAGE',
      label: 'Dance floor',
      width: 450,
    })
    expect(plan().getByRole('img', { name: 'Dance floor' })).toBeInTheDocument()
  })

  it('takes items off with Delete, sizes the room, and Cancel leaves the plan as it was', async () => {
    const { services } = await openArrangement()
    const before = await services.layout.get(MAIN)
    await startEditing()

    fireEvent.keyDown(tableOnPlan(1), { key: 'Delete' })
    expect(
      screen.getByRole('button', { name: 'Place Table 1 on the plan' }),
    ).toBeInTheDocument()
    fireEvent.keyDown(plan().getByRole('button', { name: 'Bar' }), {
      key: 'Enter',
    })
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(plan().queryByRole('button', { name: 'Bar' })).toBeNull()

    // A smaller room keeps everything inside it.
    fireEvent.keyDown(tableOnPlan(2), { key: 'Escape' })
    change(screen.getByLabelText('Width (m)'), { target: { value: '3' } })
    expect(inspectorValue('Width (m)')).toBe('3')
    fireEvent.click(tableOnPlan(6))
    expect(Number(inspectorValue('From the left (m)'))).toBeLessThanOrEqual(3)

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByText('Edit Mode')).toBeNull()
    expect(await services.layout.get(MAIN)).toEqual(before)
    expect(tableOnPlan(1)).toBeInTheDocument()
  })

  it('asks before leaving with unsaved changes', async () => {
    await openArrangement()
    await startEditing()
    fireEvent.keyDown(tableOnPlan(4), { key: 'ArrowUp' })

    fireEvent.click(screen.getByRole('tab', { name: 'Tables' }))

    expect(
      await screen.findByRole('dialog', { name: 'Leave without saving?' }),
    ).toBeInTheDocument()
  })

  it('refuses a save over someone else’s and reloads theirs', async () => {
    const { services } = await openArrangement()
    await startEditing()
    fireEvent.keyDown(tableOnPlan(4), { key: 'ArrowUp' })
    const stored = await services.layout.get(MAIN)
    await services.layout.save(MAIN, { ...stored, roomDepth: 2500 })

    fireEvent.click(screen.getByRole('button', { name: 'Save Layout' }))

    expect(
      await screen.findByText(
        'Someone else saved this floor plan after you opened it. Reload to see their changes.',
      ),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Reload' }))
    await waitFor(() => expect(inspectorValue('Depth (m)')).toBe('25'))
    expect(screen.getByText('Edit Mode')).toBeInTheDocument()
  })

  it('lays a floor picture under the plan, with its transparency, zoom and turn', async () => {
    const { services } = await openArrangement()
    await startEditing()
    expect(screen.getByLabelText('Transparency')).toBeDisabled()

    const picture = 'data:image/jpeg;base64,AAAA'
    vi.stubGlobal('createImageBitmap', () =>
      Promise.resolve({ width: 3000, height: 2000, close: () => undefined }),
    )
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D)
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(picture)
    fireEvent.change(screen.getByTestId('floor-picture-file'), {
      target: {
        files: [new File(['x'], 'floor.jpg', { type: 'image/jpeg' })],
      },
    })

    expect(
      await screen.findByRole('button', { name: 'Replace Picture' }),
    ).toBeInTheDocument()
    change(screen.getByLabelText('Transparency'), { target: { value: '70' } })
    change(screen.getByLabelText('Zoom'), { target: { value: '150' } })
    change(screen.getByLabelText('Rotate'), { target: { value: '-30' } })
    const image = document.querySelector('svg image')!
    expect(image).toHaveAttribute('opacity', '0.3')
    expect(image.getAttribute('transform')).toContain('rotate(-30) scale(1.5)')

    fireEvent.click(screen.getByRole('button', { name: 'Save Layout' }))
    await screen.findByText('The floor plan was saved.')
    expect(await services.layout.get(MAIN)).toMatchObject({
      floorImage: picture,
      floorImageTransparency: 70,
      floorImageZoom: 150,
      floorImageRotation: -30,
    })

    await startEditing()
    fireEvent.click(screen.getByRole('button', { name: 'Reset Picture' }))
    expect(screen.getByLabelText('Rotate')).toHaveValue('0')
    fireEvent.click(screen.getByRole('button', { name: 'Remove Picture' }))
    expect(document.querySelector('svg image')).toBeNull()
  })

  it('refuses a picture of another kind', async () => {
    await openArrangement()
    await startEditing()

    fireEvent.change(screen.getByTestId('floor-picture-file'), {
      target: { files: [new File(['x'], 'plan.gif', { type: 'image/gif' })] },
    })

    expect(await screen.findByRole('alert')).toBeInTheDocument()
  })

  it('points out tables that overlap, or reach past the walls', async () => {
    const services = createTestServices()
    const layout = await services.layout.get(MAIN)
    const [first, second] = layout.placements
    await services.layout.save(MAIN, {
      ...layout,
      placements: [
        { ...first!, x: 500, y: 700 },
        { ...second!, x: 520, y: 700 },
        ...layout.placements.slice(2),
      ],
    })
    await openArrangement(services)

    expect(screen.getByText('Check the plan')).toBeInTheDocument()
    expect(screen.getByText('Table 1 overlaps Table 2.')).toBeInTheDocument()
  })

  it.each([
    [DEMO_EVENTS.viewer, 'View-only access'],
    [DEMO_EVENTS.past, 'This event has ended'],
  ])('only shows the plan at %s', async (eventId, notice) => {
    await openArrangement(createTestServices(), eventId)

    expect(screen.getByText(notice)).toBeInTheDocument()
    expect(screen.getByText('View Mode')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Edit Layout' })).toBeNull()
  })

  it('offers no editing on a phone, and shows a tapped table below the plan', async () => {
    setViewportWidth(390)
    await openArrangement()

    expect(
      screen.getByText('Edit the layout on a larger screen.'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Edit Layout' })).toBeNull()
    fireEvent.click(tableOnPlan(4))
    const card = screen
      .getByRole('heading', { name: 'Selected Table' })
      .closest('section')!
    expect(within(card).getByText('Table 4')).toBeInTheDocument()
  })

  it('zooms, shows the whole room again, and fills the screen', async () => {
    await openArrangement()
    const svg = screen.getByRole('group', { name: 'Floor plan' })
    const whole = svg.getAttribute('viewBox')

    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }))
    expect(svg.getAttribute('viewBox')).not.toBe(whole)
    fireEvent.click(screen.getByRole('button', { name: 'Zoom out' }))
    fireEvent.click(screen.getByRole('button', { name: 'Zoom out' }))
    fireEvent.click(screen.getByRole('button', { name: 'Show the whole room' }))
    expect(svg.getAttribute('viewBox')).toBe(whole)

    fireEvent.click(screen.getByRole('button', { name: 'Fullscreen' }))
    expect(
      await screen.findByRole('button', { name: 'Exit fullscreen' }),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Exit fullscreen' }))
    expect(
      await screen.findByRole('button', { name: 'Fullscreen' }),
    ).toBeInTheDocument()
  })

  it('is translated to Hebrew', async () => {
    await openArrangement()

    await changeLanguage('he')

    expect(
      await screen.findByRole('tab', { name: 'סידור שולחנות' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'תוכנית האולם' })).toHaveAttribute(
      'aria-label',
    )
    expect(
      screen.getByRole('button', { name: 'עריכת הסידור' }),
    ).toBeInTheDocument()
  })
})
