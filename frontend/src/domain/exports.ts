import type { EventTable, Guest } from './models.ts'
import { tableOccupancy } from './seating.ts'

export interface GuestExportRow {
  firstName: string
  lastName: string
  invitationName: string
  phone: string
  allowedAttendees: number
  confirmedAttendees: number | null
  rsvpStatus: Guest['rsvpStatus']
  invitationSentCount: number
  tableNumber: number | null
}

export interface SeatingDetailRow {
  tableNumber: number
  tableName: string
  firstName: string
  lastName: string
  invitationName: string
  phone: string
  confirmedAttendees: number
}

export interface SeatingSummaryRow {
  tableNumber: number
  tableName: string
  capacity: number
  assigned: number
  remaining: number
}

function byName(a: Guest, b: Guest): number {
  return (
    a.lastName.localeCompare(b.lastName) ||
    a.firstName.localeCompare(b.firstName) ||
    a.id.localeCompare(b.id)
  )
}

/** Active guests only; soft-deleted guests never appear in exports. */
export function buildGuestExportRows(
  guests: readonly Guest[],
  tables: readonly EventTable[],
): GuestExportRow[] {
  const numbers = new Map(tables.map((table) => [table.id, table.number]))
  return guests
    .filter((guest) => !guest.deleted)
    .sort(byName)
    .map((guest) => ({
      firstName: guest.firstName,
      lastName: guest.lastName,
      invitationName: guest.invitationName ?? '',
      phone: guest.phone,
      allowedAttendees: guest.allowedAttendees,
      confirmedAttendees: guest.confirmedAttendees,
      rsvpStatus: guest.rsvpStatus,
      invitationSentCount: guest.invitationSentCount,
      tableNumber:
        guest.tableId === null ? null : (numbers.get(guest.tableId) ?? null),
    }))
}

/** One row per seated party, ordered by table number (PRD section 11.3). */
export function buildSeatingDetailRows(
  guests: readonly Guest[],
  tables: readonly EventTable[],
): SeatingDetailRow[] {
  return [...tables]
    .sort((a, b) => a.number - b.number)
    .flatMap((table) =>
      guests
        .filter(
          (guest) =>
            guest.tableId === table.id &&
            !guest.deleted &&
            guest.rsvpStatus === 'APPROVED',
        )
        .sort(byName)
        .map((guest) => ({
          tableNumber: table.number,
          tableName: table.name,
          firstName: guest.firstName,
          lastName: guest.lastName,
          invitationName: guest.invitationName ?? '',
          phone: guest.phone,
          confirmedAttendees: guest.confirmedAttendees ?? 0,
        })),
    )
}

/** One row per table. `remaining` is negative for a table over capacity. */
export function buildSeatingSummaryRows(
  guests: readonly Guest[],
  tables: readonly EventTable[],
): SeatingSummaryRow[] {
  return [...tables]
    .sort((a, b) => a.number - b.number)
    .map((table) => {
      const assigned = tableOccupancy(table.id, guests)
      return {
        tableNumber: table.number,
        tableName: table.name,
        capacity: table.capacity,
        assigned,
        remaining: table.capacity - assigned,
      }
    })
}
