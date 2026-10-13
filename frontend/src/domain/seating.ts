import { assertIntegerInRange, DomainError } from './errors.ts'
import {
  TABLE_SHAPES,
  type EventTable,
  type Guest,
  type Id,
  type TableShape,
} from './models.ts'

const MAX_TABLE_NUMBER = 9999
const MAX_TABLE_CAPACITY = 1000

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
  assertIntegerInRange(input.number, 1, MAX_TABLE_NUMBER, 'number')
  assertIntegerInRange(input.capacity, 1, MAX_TABLE_CAPACITY, 'capacity')
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
