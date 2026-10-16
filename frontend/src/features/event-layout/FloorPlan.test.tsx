import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { emptyLayout } from '../../domain/layout.ts'
import type { SeatedTable } from '../../domain/tableList.ts'
import { makeTable } from '../../test/factories.ts'
import { FloorPlan, type PlanLayout } from './FloorPlan.tsx'
import { DRAG_TYPE } from './planParts.ts'

/**
 * Gestures on the plan. jsdom lays nothing out, so screen points are taken
 * as centimetres of the room (an identity screen matrix), and pointer events
 * are mouse events with a pointer id.
 */
class TestPointerEvent extends MouseEvent {
  readonly pointerId: number
  constructor(type: string, init: PointerEventInit = {}) {
    super(type, init)
    this.pointerId = init.pointerId ?? 1
  }
}

class TestPoint {
  readonly x: number
  readonly y: number
  constructor(x: number, y: number) {
    this.x = x
    this.y = y
  }
  matrixTransform() {
    return { x: this.x, y: this.y }
  }
}

/** A drop, which jsdom does not have, with where it happened. */
class TestDragEvent extends MouseEvent {}

beforeEach(() => {
  vi.stubGlobal('PointerEvent', TestPointerEvent)
  vi.stubGlobal('DragEvent', TestDragEvent)
  vi.stubGlobal('DOMPoint', TestPoint)
  Object.defineProperty(SVGSVGElement.prototype, 'getScreenCTM', {
    configurable: true,
    value: () => ({ inverse: () => ({}) }),
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
  delete (SVGSVGElement.prototype as { getScreenCTM?: unknown }).getScreenCTM
})

const tables: SeatedTable[] = [
  {
    table: makeTable({ id: 't-1', number: 1, capacity: 10 }),
    assigned: 4,
    available: 6,
  },
  {
    table: makeTable({ id: 't-2', number: 2, capacity: 4, shape: 'SQUARE' }),
    assigned: 6,
    available: -2,
  },
]

function layout(overrides: Partial<PlanLayout> = {}): PlanLayout {
  const { eventId: _eventId, version: _version, ...plan } = emptyLayout('e')
  return {
    ...plan,
    placements: [
      { tableId: 't-1', x: 500, y: 500, rotation: 0 },
      { tableId: 't-2', x: 1200, y: 500, rotation: 30 },
    ],
    objects: [
      {
        id: 'stage',
        kind: 'STAGE',
        x: 1000,
        y: 200,
        width: 600,
        height: 300,
        rotation: 0,
        label: null,
      },
    ],
    ...overrides,
  }
}

function svg() {
  return screen.getByRole('group', { name: 'Floor plan' })
}

function viewBox() {
  return svg().getAttribute('viewBox')!.split(' ').map(Number)
}

const at = (x: number, y: number, pointerId = 1) => ({
  clientX: x,
  clientY: y,
  pointerId,
})

describe('FloorPlan', () => {
  it('draws chairs, taken seats and a warning on a table over capacity', () => {
    const { container } = render(
      <FloorPlan layout={layout()} tables={tables} selected={new Set()} />,
    )
    const second = screen.getByRole('button', { name: /^Table 2,/ })

    expect(second).toHaveAccessibleName('Table 2, 6 of 4 seats, Over Capacity')
    expect(within(second).getByText('!')).toBeInTheDocument()
    expect(
      screen
        .getByRole('button', { name: /^Table 1,/ })
        .querySelectorAll('rect'),
    ).toHaveLength(10)
    expect(container.querySelector('image')).toBeNull()
  })

  it('pans with a drag on the floor, without choosing the table it started on', () => {
    const onTable = vi.fn()
    const onBackground = vi.fn()
    render(
      <FloorPlan
        layout={layout()}
        tables={tables}
        selected={new Set()}
        onTable={onTable}
        onBackground={onBackground}
      />,
    )
    const before = viewBox()
    const table = screen.getByRole('button', { name: /^Table 1,/ })

    fireEvent.pointerDown(table, at(500, 500))
    fireEvent.pointerMove(svg(), at(560, 540))
    fireEvent.pointerUp(svg(), at(560, 540))
    fireEvent.click(table)

    expect(viewBox()[0]).toBeLessThan(before[0]!)
    expect(onTable).not.toHaveBeenCalled()

    // A press that does not move is a click.
    fireEvent.pointerDown(table, at(500, 500))
    fireEvent.pointerUp(table, at(500, 500))
    fireEvent.click(table)
    expect(onTable).toHaveBeenCalledWith('t-1')

    fireEvent.pointerDown(svg(), at(10, 10))
    fireEvent.pointerUp(svg(), at(10, 10))
    expect(onBackground).toHaveBeenCalledTimes(1)
  })

  it('zooms with two fingers, and with Ctrl and the wheel only', () => {
    render(<FloorPlan layout={layout()} tables={tables} selected={new Set()} />)
    const width = () => viewBox()[2]!
    const before = width()

    fireEvent.pointerDown(svg(), at(400, 400, 1))
    fireEvent.pointerDown(svg(), at(600, 400, 2))
    fireEvent.pointerMove(svg(), at(700, 400, 2))
    expect(width()).toBeLessThan(before)
    fireEvent.pointerUp(svg(), at(700, 400, 2))
    fireEvent.pointerUp(svg(), at(400, 400, 1))

    const pinched = width()
    fireEvent.wheel(svg(), { deltaY: -100, clientX: 500, clientY: 500 })
    expect(width()).toBe(pinched)
    fireEvent.wheel(svg(), {
      deltaY: -100,
      ctrlKey: true,
      clientX: 500,
      clientY: 500,
    })
    expect(width()).toBeLessThan(pinched)
  })

  it('moves, turns and sizes items while editing, snapping moves', () => {
    const onChange = vi.fn()
    const onTable = vi.fn()
    const onObject = vi.fn()
    const { rerender } = render(
      <FloorPlan
        layout={layout()}
        tables={tables}
        selected={new Set()}
        editing
        snap={50}
        onChange={onChange}
        onTable={onTable}
        onObject={onObject}
      />,
    )

    fireEvent.pointerDown(
      screen.getByRole('button', { name: /^Table 1,/ }),
      at(510, 490),
    )
    fireEvent.pointerMove(svg(), at(733, 812))
    fireEvent.pointerUp(svg(), at(733, 812))
    expect(onTable).toHaveBeenCalledWith('t-1')
    expect(onChange).toHaveBeenLastCalledWith({
      type: 'move',
      item: { type: 'table', id: 't-1' },
      x: 700,
      y: 800,
    })

    // Moves stay inside the room.
    fireEvent.pointerDown(
      screen.getByRole('button', { name: 'Stage' }),
      at(1000, 200),
    )
    fireEvent.pointerMove(svg(), at(-400, 99_999))
    fireEvent.pointerUp(svg(), at(-400, 99_999))
    expect(onObject).toHaveBeenCalledWith('stage')
    expect(onChange).toHaveBeenLastCalledWith({
      type: 'move',
      item: { type: 'object', id: 'stage' },
      x: 0,
      y: 1500,
    })

    rerender(
      <FloorPlan
        layout={layout()}
        tables={tables}
        selected={new Set()}
        editing
        active={{ type: 'object', id: 'stage' }}
        onChange={onChange}
      />,
    )
    const stage = screen.getByRole('button', { name: 'Stage' })
    const [rotate] = stage.querySelectorAll('circle[aria-hidden="true"]')
    const [resize] = stage.querySelectorAll('rect[aria-hidden="true"]')

    fireEvent.pointerDown(rotate!, at(1000, 0))
    fireEvent.pointerMove(svg(), at(1200, 200))
    fireEvent.pointerUp(svg(), at(1200, 200))
    expect(onChange).toHaveBeenLastCalledWith({
      type: 'rotate',
      item: { type: 'object', id: 'stage' },
      rotation: 90,
    })

    fireEvent.pointerDown(resize!, at(1300, 350))
    fireEvent.pointerMove(svg(), at(1404, 297))
    fireEvent.pointerUp(svg(), at(1404, 297))
    expect(onChange).toHaveBeenLastCalledWith({
      type: 'resize',
      id: 'stage',
      width: 810,
      height: 190,
    })
  })

  it('draws tables above the objects, and the chosen item above everything while editing', () => {
    const order = () =>
      [...svg().querySelectorAll('[role="button"]')].map((item) =>
        item.getAttribute('aria-label'),
      )
    const { rerender } = render(
      <FloorPlan
        layout={layout()}
        tables={tables}
        selected={new Set()}
        editing
      />,
    )
    expect(order()[0]).toBe('Stage')

    rerender(
      <FloorPlan
        layout={layout()}
        tables={tables}
        selected={new Set()}
        editing
        active={{ type: 'object', id: 'stage' }}
      />,
    )
    expect(order().at(-1)).toBe('Stage')
  })

  it('draws stairs with their treads', () => {
    const { container } = render(
      <FloorPlan
        layout={layout({
          objects: [
            {
              id: 'up',
              kind: 'STAIRS',
              x: 300,
              y: 300,
              width: 200,
              height: 100,
              rotation: 0,
              label: null,
            },
          ],
        })}
        tables={tables}
        selected={new Set()}
      />,
    )

    expect(screen.getByRole('img', { name: 'Stairs' })).toBeInTheDocument()
    // Five treads, besides the lines of the icon.
    expect(
      container.querySelectorAll('g[aria-label="Stairs"] > line'),
    ).toHaveLength(5)
  })

  it('takes a palette item dropped on it, at the point of the room', () => {
    const onDrop = vi.fn()
    render(
      <FloorPlan
        layout={layout()}
        tables={tables}
        selected={new Set()}
        editing
        snap={50}
        onDrop={onDrop}
      />,
    )

    fireEvent.drop(svg(), {
      clientX: 812,
      clientY: 340,
      dataTransfer: {
        getData: (type: string) => (type === DRAG_TYPE ? 'object:BAR' : ''),
      },
    })

    expect(onDrop).toHaveBeenCalledWith('object:BAR', { x: 800, y: 350 })
  })

  it('draws the floor picture faded and turned, under everything', () => {
    const { container } = render(
      <FloorPlan
        layout={layout({
          floorImage: 'data:image/png;base64,AAAA',
          floorImageTransparency: 25,
          floorImageZoom: 200,
          floorImageRotation: 90,
        })}
        tables={tables}
        selected={new Set(['t-1'])}
      />,
    )
    const image = container.querySelector('image')!

    expect(image).toHaveAttribute('opacity', '0.75')
    expect(image.getAttribute('transform')).toBe(
      'translate(1000 750) rotate(90) scale(2) translate(-1000 -750)',
    )
    expect(image.parentElement).toHaveAttribute('clip-path')
    expect(screen.getByRole('button', { name: /^Table 1,/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })
})
