import { assertIntegerInRange, DomainError } from './errors.ts'
import {
  VENUE_OBJECT_KINDS,
  type EventLayout,
  type EventTable,
  type Id,
  type TablePlacement,
  type TableShape,
  type VenueObject,
  type VenueObjectKind,
} from './models.ts'

/** What an organizer saves: the whole plan at once (D100). */
export type LayoutInput = Omit<EventLayout, 'eventId' | 'version'> & {
  /** The version the changes were made on; a newer one refuses the save. */
  version: number
}

/** Sizes in centimetres, and how much a plan may hold. */
export const LAYOUT_LIMITS = {
  /** 3 m to 200 m on each side. */
  room: { min: 300, max: 20_000 },
  objectSize: { min: 20, max: 20_000 },
  objects: 200,
  label: 40,
} as const

/** A new event's room: 20 m wide and 15 m deep. */
export const DEFAULT_ROOM = { roomWidth: 2000, roomDepth: 1500 } as const

/** The floor picture's controls: field, lowest, highest. */
export const FLOOR_IMAGE = [
  ['floorImageTransparency', 0, 90],
  ['floorImageZoom', 25, 400],
  ['floorImageRotation', -180, 180],
] as const

/** The floor picture as uploaded: faded so tables stay readable, not turned. */
export const DEFAULT_FLOOR_IMAGE = {
  floorImageTransparency: 40,
  floorImageZoom: 100,
  floorImageRotation: 0,
} as const

/** A stored floor picture, as a data address; about 700 KB of picture. */
export const FLOOR_IMAGE_MAX_LENGTH = 1_000_000

/** A new object's size, width by depth, in centimetres. */
export const DEFAULT_OBJECT_SIZE: Record<
  VenueObjectKind,
  { width: number; height: number }
> = {
  WALL: { width: 400, height: 20 },
  STAGE: { width: 600, height: 300 },
  BAR: { width: 120, height: 400 },
  STAIRS: { width: 200, height: 100 },
  FOOD_STATION: { width: 150, height: 400 },
  ENTRANCE: { width: 200, height: 40 },
  PLANT: { width: 60, height: 60 },
}

/** An empty plan, before anything was placed. */
export function emptyLayout(eventId: Id): EventLayout {
  return {
    eventId,
    ...DEFAULT_ROOM,
    floorImage: null,
    ...DEFAULT_FLOOR_IMAGE,
    placements: [],
    objects: [],
    version: 0,
  }
}

// Each chair takes this much of the table's edge, and stands this far from it.
const SEAT_WIDTH = 60
const ROUND_SEAT_WIDTH = 55
const CHAIR_SIZE = 40
const CHAIR_DISTANCE = 30
const MIN_TABLE = 80
const RECTANGLE_DEPTH = 80
const RECTANGLE_MIN_LENGTH = 120

const roundUp = (value: number, step: number) => Math.ceil(value / step) * step

/**
 * The size of a table's top, from its shape and chairs; the organizer does
 * not draw it. A round table of 10 is 180 cm across; a rectangle seats its
 * chairs along its two long sides.
 */
export function tableSize(
  shape: TableShape,
  capacity: number,
): { width: number; height: number } {
  switch (shape) {
    case 'CIRCLE': {
      const across = Math.max(
        MIN_TABLE,
        roundUp((capacity * ROUND_SEAT_WIDTH) / Math.PI, 10),
      )
      return { width: across, height: across }
    }
    case 'SQUARE': {
      const side = Math.max(MIN_TABLE, Math.ceil(capacity / 4) * SEAT_WIDTH)
      return { width: side, height: side }
    }
    case 'RECTANGLE':
      return {
        width: Math.max(
          RECTANGLE_MIN_LENGTH,
          Math.ceil(capacity / 2) * SEAT_WIDTH,
        ),
        height: RECTANGLE_DEPTH,
      }
  }
}

export interface ChairPosition {
  /** From the table's centre, before the table is turned. */
  x: number
  y: number
}

export const CHAIR_SIZE_CM = CHAIR_SIZE

/** Spreads `count` chairs evenly along an edge `length` long. */
function along(count: number, length: number): number[] {
  return Array.from(
    { length: count },
    (_, index) => ((index + 0.5) / count - 0.5) * length,
  )
}

/**
 * Where each of a table's chairs stands, one per seat: around a round
 * table from the top clockwise, on all four sides of a square one, and on
 * the long sides of a rectangle.
 */
export function chairPositions(
  shape: TableShape,
  capacity: number,
): ChairPosition[] {
  const { width, height } = tableSize(shape, capacity)
  const offset = CHAIR_DISTANCE
  if (shape === 'CIRCLE') {
    const radius = width / 2 + offset
    return Array.from({ length: capacity }, (_, index) => {
      const angle = (index / capacity) * 2 * Math.PI - Math.PI / 2
      return { x: radius * Math.cos(angle), y: radius * Math.sin(angle) }
    })
  }
  const top = { x: 0, y: -(height / 2 + offset) }
  const bottom = { x: 0, y: height / 2 + offset }
  if (shape === 'RECTANGLE') {
    const above = Math.ceil(capacity / 2)
    return [
      ...along(above, width).map((x) => ({ x, y: top.y })),
      ...along(capacity - above, width).map((x) => ({ x, y: bottom.y })),
    ]
  }
  // A square: top, right, bottom, left in turn take one more chair each.
  const sides = [0, 1, 2, 3].map(
    (side) => Math.floor(capacity / 4) + (side < capacity % 4 ? 1 : 0),
  )
  const half = width / 2 + offset
  return [
    ...along(sides[0]!, width).map((x) => ({ x, y: -half })),
    ...along(sides[1]!, height).map((y) => ({ x: half, y })),
    ...along(sides[2]!, width).map((x) => ({ x: -x, y: half })),
    ...along(sides[3]!, height).map((y) => ({ x: -half, y: -y })),
  ]
}

/** What a placed item takes up, chairs included: a circle or a turned box. */
export type Footprint =
  | { kind: 'circle'; x: number; y: number; radius: number }
  | {
      kind: 'box'
      x: number
      y: number
      width: number
      height: number
      rotation: number
    }

/** A table's footprint with its chairs around it. */
export function tableFootprint(
  table: Pick<EventTable, 'shape' | 'capacity'>,
  placement: Pick<TablePlacement, 'x' | 'y' | 'rotation'>,
): Footprint {
  const { width, height } = tableSize(table.shape, table.capacity)
  const reach = CHAIR_DISTANCE + CHAIR_SIZE / 2
  if (table.shape === 'CIRCLE') {
    return {
      kind: 'circle',
      x: placement.x,
      y: placement.y,
      radius: width / 2 + reach,
    }
  }
  return {
    kind: 'box',
    x: placement.x,
    y: placement.y,
    // A rectangle has no chairs at its ends.
    width: table.shape === 'RECTANGLE' ? width : width + 2 * reach,
    height: height + 2 * reach,
    rotation: placement.rotation,
  }
}

export function objectFootprint(object: VenueObject): Footprint {
  return {
    kind: 'box',
    x: object.x,
    y: object.y,
    width: object.width,
    height: object.height,
    rotation: object.rotation,
  }
}

type Point = { x: number; y: number }

function corners(box: Extract<Footprint, { kind: 'box' }>): Point[] {
  const angle = (box.rotation * Math.PI) / 180
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  return [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ].map(([sx, sy]) => {
    const dx = (sx! * box.width) / 2
    const dy = (sy! * box.height) / 2
    return { x: box.x + dx * cos - dy * sin, y: box.y + dx * sin + dy * cos }
  })
}

/** The smallest upright box holding the footprint. */
export function footprintBounds(footprint: Footprint): {
  left: number
  top: number
  right: number
  bottom: number
} {
  if (footprint.kind === 'circle') {
    return {
      left: footprint.x - footprint.radius,
      top: footprint.y - footprint.radius,
      right: footprint.x + footprint.radius,
      bottom: footprint.y + footprint.radius,
    }
  }
  const points = corners(footprint)
  return {
    left: Math.min(...points.map((point) => point.x)),
    top: Math.min(...points.map((point) => point.y)),
    right: Math.max(...points.map((point) => point.x)),
    bottom: Math.max(...points.map((point) => point.y)),
  }
}

/** Overlaps of a centimetre or less are drawing noise, not a clash. */
const TOLERANCE = 1

function boxesOverlap(a: Point[], b: Point[]): boolean {
  // Separating axis test: two convex shapes are apart if some edge's normal
  // separates their projections.
  for (const shape of [a, b]) {
    for (let index = 0; index < shape.length; index++) {
      const from = shape[index]!
      const to = shape[(index + 1) % shape.length]!
      const length = Math.hypot(to.x - from.x, to.y - from.y)
      const normal = {
        x: (from.y - to.y) / length,
        y: (to.x - from.x) / length,
      }
      const project = (points: Point[]) =>
        points.map((point) => point.x * normal.x + point.y * normal.y)
      const pa = project(a)
      const pb = project(b)
      if (
        Math.max(...pa) - TOLERANCE <= Math.min(...pb) ||
        Math.max(...pb) - TOLERANCE <= Math.min(...pa)
      ) {
        return false
      }
    }
  }
  return true
}

function circleOverlapsBox(
  circle: Extract<Footprint, { kind: 'circle' }>,
  box: Extract<Footprint, { kind: 'box' }>,
): boolean {
  // The circle's centre in the box's own, unturned frame.
  const angle = (-box.rotation * Math.PI) / 180
  const dx = circle.x - box.x
  const dy = circle.y - box.y
  const local = {
    x: dx * Math.cos(angle) - dy * Math.sin(angle),
    y: dx * Math.sin(angle) + dy * Math.cos(angle),
  }
  const nearest = {
    x: Math.max(-box.width / 2, Math.min(box.width / 2, local.x)),
    y: Math.max(-box.height / 2, Math.min(box.height / 2, local.y)),
  }
  return (
    Math.hypot(local.x - nearest.x, local.y - nearest.y) <
    circle.radius - TOLERANCE
  )
}

export function footprintsOverlap(a: Footprint, b: Footprint): boolean {
  if (a.kind === 'circle' && b.kind === 'circle') {
    return Math.hypot(a.x - b.x, a.y - b.y) < a.radius + b.radius - TOLERANCE
  }
  if (a.kind === 'circle' && b.kind === 'box') {
    return circleOverlapsBox(a, b)
  }
  if (a.kind === 'box' && b.kind === 'circle') {
    return circleOverlapsBox(b, a)
  }
  return boxesOverlap(
    corners(a as Extract<Footprint, { kind: 'box' }>),
    corners(b as Extract<Footprint, { kind: 'box' }>),
  )
}

export type LayoutItem = { type: 'table'; id: Id } | { type: 'object'; id: Id }

export interface LayoutIssues {
  /** Pairs that overlap; one of each pair is a table. */
  overlapping: [LayoutItem, LayoutItem][]
  /** Items reaching past the room's walls. */
  outside: LayoutItem[]
}

/**
 * What the plan should draw attention to (D100). Saving is still allowed:
 * real venues have tight spots. Objects overlapping each other, such as a
 * plant on the stage, are not a problem.
 */
export function findLayoutIssues(
  layout: Pick<
    EventLayout,
    'roomWidth' | 'roomDepth' | 'placements' | 'objects'
  >,
  tables: readonly EventTable[],
): LayoutIssues {
  const placed = layout.placements.flatMap((placement) => {
    const table = tables.find((candidate) => candidate.id === placement.tableId)
    return table
      ? [
          {
            item: { type: 'table', id: table.id } as LayoutItem,
            footprint: tableFootprint(table, placement),
          },
        ]
      : []
  })
  const objects = layout.objects.map((object) => ({
    item: { type: 'object', id: object.id } as LayoutItem,
    footprint: objectFootprint(object),
  }))
  const all = [...placed, ...objects]

  const overlapping: [LayoutItem, LayoutItem][] = []
  for (let first = 0; first < placed.length; first++) {
    for (let second = first + 1; second < all.length; second++) {
      if (footprintsOverlap(all[first]!.footprint, all[second]!.footprint)) {
        overlapping.push([all[first]!.item, all[second]!.item])
      }
    }
  }
  const outside = all
    .filter(({ footprint }) => {
      const bounds = footprintBounds(footprint)
      return (
        bounds.left < -TOLERANCE ||
        bounds.top < -TOLERANCE ||
        bounds.right > layout.roomWidth + TOLERANCE ||
        bounds.bottom > layout.roomDepth + TOLERANCE
      )
    })
    .map(({ item }) => item)
  return { overlapping, outside }
}

/** An angle as a whole number of degrees from 0 to 359. */
export function normalizeRotation(degrees: number): number {
  return ((Math.round(degrees) % 360) + 360) % 360
}

/** Objects are named by the page that adds them; the name is kept as is. */
const OBJECT_ID = /^[\w-]{1,64}$/

function assertRotation(value: unknown, field: string): void {
  assertIntegerInRange(value, 0, 359, field)
}

/**
 * Checks a plan before it is saved; throws VALIDATION naming the field.
 * Every centre must be inside the room; an item reaching past a wall is
 * only shown as a warning. A floor picture already stored is passed as
 * null by the server, which keeps it.
 */
export function validateLayoutInput(
  input: LayoutInput,
  tables: readonly EventTable[],
): Omit<LayoutInput, 'version'> {
  const { room, objectSize } = LAYOUT_LIMITS
  assertIntegerInRange(input.roomWidth, room.min, room.max, 'roomWidth')
  assertIntegerInRange(input.roomDepth, room.min, room.max, 'roomDepth')
  for (const [field, min, max] of FLOOR_IMAGE) {
    assertIntegerInRange(input[field], min, max, field)
  }
  if (
    input.floorImage !== null &&
    (!/^data:image\/(jpeg|png);base64,/.test(input.floorImage) ||
      input.floorImage.length > FLOOR_IMAGE_MAX_LENGTH)
  ) {
    throw new DomainError('VALIDATION', { field: 'floorImage' })
  }
  const inRoom = (item: { x: unknown; y: unknown }, field: string) => {
    assertIntegerInRange(item.x, 0, input.roomWidth, `${field}.x`)
    assertIntegerInRange(item.y, 0, input.roomDepth, `${field}.y`)
  }

  const seen = new Set<Id>()
  const placements = input.placements.flatMap((placement): TablePlacement[] => {
    if (seen.has(placement.tableId)) {
      throw new DomainError('VALIDATION', { field: 'placements' })
    }
    seen.add(placement.tableId)
    inRoom(placement, 'placements')
    assertRotation(placement.rotation, 'placements.rotation')
    // A table deleted while the plan was being changed just leaves it.
    return tables.some((table) => table.id === placement.tableId)
      ? [
          {
            tableId: placement.tableId,
            x: placement.x,
            y: placement.y,
            rotation: placement.rotation,
          },
        ]
      : []
  })

  if (input.objects.length > LAYOUT_LIMITS.objects) {
    throw new DomainError('VALIDATION', {
      field: 'objects',
      max: LAYOUT_LIMITS.objects,
    })
  }
  const ids = new Set<Id>()
  const objects = input.objects.map((object): VenueObject => {
    if (
      !VENUE_OBJECT_KINDS.includes(object.kind) ||
      typeof object.id !== 'string' ||
      !OBJECT_ID.test(object.id) ||
      ids.has(object.id)
    ) {
      throw new DomainError('VALIDATION', { field: 'objects' })
    }
    ids.add(object.id)
    inRoom(object, 'objects')
    assertIntegerInRange(
      object.width,
      objectSize.min,
      objectSize.max,
      'objects.width',
    )
    assertIntegerInRange(
      object.height,
      objectSize.min,
      objectSize.max,
      'objects.height',
    )
    assertRotation(object.rotation, 'objects.rotation')
    const label = object.label?.trim() || null
    if (label !== null && label.length > LAYOUT_LIMITS.label) {
      throw new DomainError('VALIDATION', {
        field: 'objects.label',
        max: LAYOUT_LIMITS.label,
      })
    }
    return {
      id: object.id,
      kind: object.kind,
      x: object.x,
      y: object.y,
      width: object.width,
      height: object.height,
      rotation: object.rotation,
      label,
    }
  })

  return {
    roomWidth: input.roomWidth,
    roomDepth: input.roomDepth,
    floorImage: input.floorImage,
    floorImageTransparency: input.floorImageTransparency,
    floorImageZoom: input.floorImageZoom,
    floorImageRotation: input.floorImageRotation,
    placements,
    objects,
  }
}

/** Refuses a save made on an older version than the one stored. */
export function assertLayoutVersion(expected: number, stored: number): void {
  if (expected !== stored) {
    throw new DomainError('LAYOUT_CHANGED')
  }
}
