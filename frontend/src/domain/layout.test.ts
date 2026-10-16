import { describe, expect, it } from 'vitest'
import { makeTable } from '../test/factories.ts'
import { isDomainError } from './errors.ts'
import {
  assertLayoutVersion,
  chairPositions,
  emptyLayout,
  findLayoutIssues,
  footprintBounds,
  footprintsOverlap,
  normalizeRotation,
  tableFootprint,
  tableSize,
  validateLayoutInput,
  type Footprint,
  type LayoutInput,
} from './layout.ts'
import type { VenueObject } from './models.ts'

const round10 = makeTable({ id: 't-1', number: 1, capacity: 10 })
const long8 = makeTable({
  id: 't-2',
  number: 2,
  capacity: 8,
  shape: 'RECTANGLE',
})
const square10 = makeTable({
  id: 't-3',
  number: 3,
  capacity: 10,
  shape: 'SQUARE',
})

function input(overrides: Partial<LayoutInput> = {}): LayoutInput {
  const { eventId: _eventId, ...layout } = emptyLayout('e-1')
  return { ...layout, ...overrides }
}

function object(overrides: Partial<VenueObject> = {}): VenueObject {
  return {
    id: 'o-1',
    kind: 'STAGE',
    x: 1000,
    y: 200,
    width: 600,
    height: 300,
    rotation: 0,
    label: null,
    ...overrides,
  }
}

function codeOf(action: () => unknown): string {
  try {
    action()
  } catch (error) {
    if (isDomainError(error)) {
      return `${error.code}:${String(error.details['field'] ?? '')}`
    }
    throw error
  }
  return 'NO_ERROR'
}

describe('table sizes and chairs (D100)', () => {
  it('sizes a table from its shape and seats', () => {
    expect(tableSize('CIRCLE', 10)).toEqual({ width: 180, height: 180 })
    expect(tableSize('CIRCLE', 1)).toEqual({ width: 80, height: 80 })
    expect(tableSize('SQUARE', 10)).toEqual({ width: 180, height: 180 })
    expect(tableSize('RECTANGLE', 8)).toEqual({ width: 240, height: 80 })
    expect(tableSize('RECTANGLE', 1)).toEqual({ width: 120, height: 80 })
  })

  it('draws one chair per seat, around the table', () => {
    for (const shape of ['CIRCLE', 'SQUARE', 'RECTANGLE'] as const) {
      for (const capacity of [1, 2, 5, 10, 13]) {
        const chairs = chairPositions(shape, capacity)
        expect(chairs).toHaveLength(capacity)
        const { width, height } = tableSize(shape, capacity)
        // Every chair stands outside the table's top.
        for (const chair of chairs) {
          expect(
            shape === 'CIRCLE'
              ? Math.hypot(chair.x, chair.y) > width / 2
              : Math.abs(chair.x) > width / 2 || Math.abs(chair.y) > height / 2,
          ).toBe(true)
        }
      }
    }
  })

  it('starts a round table at the top and seats a rectangle on its long sides', () => {
    const [first] = chairPositions('CIRCLE', 4)
    expect(first!.x).toBeCloseTo(0)
    expect(first!.y).toBeCloseTo(-(80 / 2 + 30))
    const sides = chairPositions('RECTANGLE', 5).map((chair) =>
      Math.sign(chair.y),
    )
    expect(sides).toEqual([-1, -1, -1, 1, 1])
  })

  it('spreads a square table’s chairs over its four sides', () => {
    const chairs = chairPositions('SQUARE', 6)
    const half = 120 / 2 + 30
    expect(chairs.filter((chair) => chair.y === -half)).toHaveLength(2)
    expect(chairs.filter((chair) => chair.x === half)).toHaveLength(2)
    expect(chairs.filter((chair) => chair.y === half)).toHaveLength(1)
    expect(chairs.filter((chair) => chair.x === -half)).toHaveLength(1)
  })
})

describe('footprints', () => {
  it('includes the chairs, and a rectangle has none at its ends', () => {
    expect(tableFootprint(round10, { x: 500, y: 400, rotation: 0 })).toEqual({
      kind: 'circle',
      x: 500,
      y: 400,
      radius: 90 + 50,
    })
    expect(tableFootprint(long8, { x: 0, y: 0, rotation: 90 })).toMatchObject({
      kind: 'box',
      width: 240,
      height: 180,
      rotation: 90,
    })
    expect(tableFootprint(square10, { x: 0, y: 0, rotation: 0 })).toMatchObject(
      { width: 280, height: 280 },
    )
  })

  it('bounds a turned box by its corners', () => {
    const bounds = footprintBounds({
      kind: 'box',
      x: 100,
      y: 100,
      width: 200,
      height: 20,
      rotation: 90,
    })
    expect(bounds.left).toBeCloseTo(90)
    expect(bounds.right).toBeCloseTo(110)
    expect(bounds.top).toBeCloseTo(0)
    expect(bounds.bottom).toBeCloseTo(200)
  })

  it('tells overlapping shapes from those that only touch', () => {
    const circle = (x: number): Footprint => ({
      kind: 'circle',
      x,
      y: 0,
      radius: 50,
    })
    const box = (x: number, rotation = 0): Footprint => ({
      kind: 'box',
      x,
      y: 0,
      width: 100,
      height: 100,
      rotation,
    })
    expect(footprintsOverlap(circle(0), circle(90))).toBe(true)
    expect(footprintsOverlap(circle(0), circle(100))).toBe(false)
    expect(footprintsOverlap(circle(0), box(90))).toBe(true)
    expect(footprintsOverlap(box(90), circle(0))).toBe(true)
    expect(footprintsOverlap(circle(0), box(100))).toBe(false)
    expect(footprintsOverlap(box(0), box(95))).toBe(true)
    // A centimetre is drawing noise.
    expect(footprintsOverlap(box(0), box(99))).toBe(false)
    expect(footprintsOverlap(box(0), box(100))).toBe(false)
    // Turned 45°, a box reaches about 71 cm from its centre.
    expect(footprintsOverlap(box(0), box(115, 45))).toBe(true)
    expect(footprintsOverlap(box(0), box(125, 45))).toBe(false)
  })
})

describe('layout issues', () => {
  const tables = [round10, long8, square10]

  it('finds tables that overlap tables or objects, and items past the walls', () => {
    const issues = findLayoutIssues(
      {
        roomWidth: 2000,
        roomDepth: 1500,
        placements: [
          { tableId: 't-1', x: 500, y: 500, rotation: 0 },
          { tableId: 't-2', x: 600, y: 500, rotation: 0 },
          { tableId: 't-3', x: 1900, y: 1400, rotation: 0 },
        ],
        objects: [
          object({ id: 'stage', x: 500, y: 300 }),
          // A plant on the stage is decoration, not a clash.
          object({ id: 'plant', kind: 'PLANT', x: 500, y: 250, width: 60 }),
        ],
      },
      tables,
    )
    expect(issues.overlapping).toEqual([
      [
        { type: 'table', id: 't-1' },
        { type: 'table', id: 't-2' },
      ],
      [
        { type: 'table', id: 't-1' },
        { type: 'object', id: 'stage' },
      ],
      [
        { type: 'table', id: 't-1' },
        { type: 'object', id: 'plant' },
      ],
      [
        { type: 'table', id: 't-2' },
        { type: 'object', id: 'stage' },
      ],
    ])
    expect(issues.outside).toEqual([{ type: 'table', id: 't-3' }])
  })

  it('has nothing to say about a tidy plan, and skips removed tables', () => {
    expect(
      findLayoutIssues(
        {
          roomWidth: 2000,
          roomDepth: 1500,
          placements: [
            { tableId: 't-1', x: 300, y: 300, rotation: 0 },
            { tableId: 'gone', x: 300, y: 300, rotation: 0 },
          ],
          objects: [object({ x: 1500, y: 1000 })],
        },
        tables,
      ),
    ).toEqual({ overlapping: [], outside: [] })
  })
})

describe('validateLayoutInput', () => {
  const tables = [round10, long8]

  it('accepts a plan and tidies labels', () => {
    const saved = validateLayoutInput(
      input({
        placements: [{ tableId: 't-1', x: 0, y: 1500, rotation: 359 }],
        objects: [
          object({ label: '  Dance floor ' }),
          object({ id: 'o-2', label: '   ' }),
        ],
        floorImage: 'data:image/png;base64,AAAA',
      }),
      tables,
    )
    expect(saved.objects.map((item) => item.label)).toEqual([
      'Dance floor',
      null,
    ])
    expect(saved.placements).toEqual([
      { tableId: 't-1', x: 0, y: 1500, rotation: 359 },
    ])
    expect('version' in saved).toBe(false)
  })

  it.each([
    [{ roomWidth: 299 }, 'roomWidth'],
    [{ roomDepth: 20_001 }, 'roomDepth'],
    [{ roomWidth: 1000.5 }, 'roomWidth'],
    [{ floorImageTransparency: 91 }, 'floorImageTransparency'],
    [{ floorImageZoom: 24 }, 'floorImageZoom'],
    [{ floorImageRotation: 181 }, 'floorImageRotation'],
    [{ floorImage: 'https://example.com/a.png' }, 'floorImage'],
    [
      { floorImage: `data:image/png;base64,${'A'.repeat(1_000_000)}` },
      'floorImage',
    ],
    [
      {
        placements: [
          { tableId: 't-1', x: 1, y: 1, rotation: 0 },
          { tableId: 't-1', x: 2, y: 2, rotation: 0 },
        ],
      },
      'placements',
    ],
    [
      { placements: [{ tableId: 't-1', x: 2001, y: 1, rotation: 0 }] },
      'placements.x',
    ],
    [
      { placements: [{ tableId: 't-1', x: 1, y: -1, rotation: 0 }] },
      'placements.y',
    ],
    [
      { placements: [{ tableId: 't-1', x: 1, y: 1, rotation: 360 }] },
      'placements.rotation',
    ],
    [{ objects: [object({ kind: 'POOL' as never })] }, 'objects'],
    [{ objects: [object(), object()] }, 'objects'],
    [{ objects: [object({ id: '' })] }, 'objects'],
    [{ objects: [object({ id: 'a b' })] }, 'objects'],
    [{ objects: [object({ id: 'x'.repeat(65) })] }, 'objects'],
    [{ objects: [object({ width: 19 })] }, 'objects.width'],
    [{ objects: [object({ height: 20_001 })] }, 'objects.height'],
    [{ objects: [object({ rotation: -1 })] }, 'objects.rotation'],
    [{ objects: [object({ label: 'x'.repeat(41) })] }, 'objects.label'],
    [
      {
        objects: Array.from({ length: 201 }, (_, index) =>
          object({ id: `o-${index}` }),
        ),
      },
      'objects',
    ],
  ] as [Partial<LayoutInput>, string][])('refuses %j', (overrides, field) => {
    expect(codeOf(() => validateLayoutInput(input(overrides), tables))).toBe(
      `VALIDATION:${field}`,
    )
  })

  it('leaves out tables deleted meanwhile', () => {
    expect(
      validateLayoutInput(
        input({
          placements: [
            { tableId: 'gone', x: 1, y: 1, rotation: 0 },
            { tableId: 't-2', x: 1, y: 1, rotation: 0 },
          ],
        }),
        tables,
      ).placements.map((placement) => placement.tableId),
    ).toEqual(['t-2'])
  })

  it('refuses a save over a newer version', () => {
    expect(codeOf(() => assertLayoutVersion(3, 3))).toBe('NO_ERROR')
    expect(codeOf(() => assertLayoutVersion(2, 3))).toBe('LAYOUT_CHANGED:')
  })

  it('turns any angle into 0–359', () => {
    expect(normalizeRotation(-15)).toBe(345)
    expect(normalizeRotation(360)).toBe(0)
    expect(normalizeRotation(721.4)).toBe(1)
  })
})
