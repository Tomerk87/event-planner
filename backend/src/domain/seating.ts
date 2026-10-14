import { assertIntegerInRange, DomainError } from './errors.ts'
import {
  TABLE_SHAPES,
  type EventTable,
  type Guest,
  type Id,
  type TableShape,
} from './models.ts'

export const TABLE_LIMITS = {
  number: { min: 1, max: 9999 },
  capacity: { min: 1, max: 1000 },
} as const

export const TABLE_STATUSES = [
  'OVER_CAPACITY',
  'FULL',
  'ALMOST_FULL',
  'READY',
] as const

export type TableStatus = (typeof TABLE_STATUSES)[number]

/** A table with this many free seats or fewer, but not none, is almost full. */
const ALMOST_FULL_SEATS = 2

/** The label a table carries, from its chairs and the attendees seated at it. */
export function tableStatus(capacity: number, assigned: number): TableStatus {
  const free = capacity - assigned
  if (free < 0) {
    return 'OVER_CAPACITY'
  }
  if (free === 0) {
    return 'FULL'
  }
  return free <= ALMOST_FULL_SEATS ? 'ALMOST_FULL' : 'READY'
}

function isSeated(guest: Guest): boolean {
  return !guest.deleted && guest.rsvpStatus === 'APPROVED'
}

/** Confirmed attendees seated at a table. */
export function tableOccupancy(tableId: Id, guests: readonly Guest[]): number {
  return guests
    .filter((guest) => guest.tableId === tableId && isSeated(guest))
    .reduce((sum, guest) => sum + (guest.confirmedAttendees ?? 0), 0)
}

/**
 * Checks a manual assignment (PRD section 11.2): only an active, Approved
 * guest can be seated, and the whole party must fit in the remaining chairs.
 * Passing no table unassigns and is always allowed.
 */
export function assertCanAssign(
  guest: Guest,
  table: EventTable | null,
  guests: readonly Guest[],
): void {
  if (table === null) {
    return
  }
  if (!isSeated(guest)) {
    throw new DomainError('GUEST_NOT_APPROVED')
  }
  const others = guests.filter((other) => other.id !== guest.id)
  const occupancy = tableOccupancy(table.id, others)
  const needed = guest.confirmedAttendees ?? 0
  if (occupancy + needed > table.capacity) {
    throw new DomainError('TABLE_FULL', {
      capacity: table.capacity,
      available: Math.max(0, table.capacity - occupancy),
      needed,
    })
  }
}

function byName(a: Guest, b: Guest): number {
  return (
    a.lastName.localeCompare(b.lastName) ||
    a.firstName.localeCompare(b.firstName) ||
    a.id.localeCompare(b.id)
  )
}

/** The parties seated at a table, by name. */
export function partiesAt(tableId: Id, guests: readonly Guest[]): Guest[] {
  return guests
    .filter((guest) => guest.tableId === tableId && isSeated(guest))
    .sort(byName)
}

/**
 * The parties that could be brought to a table: every active Approved guest
 * not already at it. Those without a table come first, then those who would
 * move from another table; each part by name.
 */
export function seatingCandidates(
  tableId: Id,
  guests: readonly Guest[],
): Guest[] {
  return guests
    .filter((guest) => isSeated(guest) && guest.tableId !== tableId)
    .sort(
      (a, b) =>
        Number(a.tableId !== null) - Number(b.tableId !== null) || byName(a, b),
    )
}

export interface TableInput {
  number: number
  capacity: number
  shape: TableShape
}

/** Validates table fields and the event-scoped uniqueness of the number. */
export function validateTableInput(
  input: TableInput,
  eventTables: readonly EventTable[],
  editingTableId: Id | null,
): TableInput {
  assertIntegerInRange(
    input.number,
    TABLE_LIMITS.number.min,
    TABLE_LIMITS.number.max,
    'number',
  )
  assertIntegerInRange(
    input.capacity,
    TABLE_LIMITS.capacity.min,
    TABLE_LIMITS.capacity.max,
    'capacity',
  )
  if (!TABLE_SHAPES.includes(input.shape)) {
    throw new DomainError('VALIDATION', { field: 'shape' })
  }
  const clash = eventTables.some(
    (table) => table.number === input.number && table.id !== editingTableId,
  )
  if (clash) {
    throw new DomainError('DUPLICATE_TABLE_NUMBER', { number: input.number })
  }
  return {
    number: input.number,
    capacity: input.capacity,
    shape: input.shape,
  }
}

export interface TableConflict {
  tableId: Id
  tableNumber: number
  /** Attendees beyond the table's capacity. */
  over: number
}

/** Tables holding more attendees than chairs, which only an RSVP change can cause. */
export function findTableConflicts(
  tables: readonly EventTable[],
  guests: readonly Guest[],
): TableConflict[] {
  return tables
    .map((table) => ({
      tableId: table.id,
      tableNumber: table.number,
      over: tableOccupancy(table.id, guests) - table.capacity,
    }))
    .filter((conflict) => conflict.over > 0)
    .sort((a, b) => a.tableNumber - b.tableNumber)
}
