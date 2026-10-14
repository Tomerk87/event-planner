import { guestDisplayStatus, type GuestDisplayStatus } from './guestStatus.ts'
import type { EventTable, Guest } from './models.ts'

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
  group: string
}

export interface SeatingDetailRow {
  firstName: string
  lastName: string
  invitationName: string
  phone: string
  confirmedAttendees: number
  tableNumber: number
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
      group: guest.group ?? '',
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
          firstName: guest.firstName,
          lastName: guest.lastName,
          invitationName: guest.invitationName ?? '',
          phone: guest.phone,
          confirmedAttendees: guest.confirmedAttendees ?? 0,
        })),
    )
}

export const GUEST_EXPORT_COLUMNS = [
  'firstName',
  'lastName',
  'invitationName',
  'phone',
  'allowedAttendees',
  'confirmedAttendees',
  'status',
  'invitationSentCount',
  'tableNumber',
  'group',
] as const

export type GuestExportColumn = (typeof GUEST_EXPORT_COLUMNS)[number]

export interface GuestExportLabels {
  headings: Record<GuestExportColumn, string>
  statuses: Record<GuestDisplayStatus, string>
}

/**
 * The guest export as a table: one heading row, then one row per guest, with
 * every field. Headings and status names come translated from the caller.
 */
export function buildGuestExportTable(
  rows: readonly GuestExportRow[],
  labels: GuestExportLabels,
): (string | number | null)[][] {
  return [
    GUEST_EXPORT_COLUMNS.map((column) => labels.headings[column]),
    ...rows.map((row) => [
      row.firstName,
      row.lastName,
      row.invitationName,
      row.phone,
      row.allowedAttendees,
      row.confirmedAttendees,
      labels.statuses[guestDisplayStatus(row)],
      row.invitationSentCount,
      row.tableNumber,
      row.group,
    ]),
  ]
}

export const SEATING_EXPORT_COLUMNS = [
  'firstName',
  'lastName',
  'invitationName',
  'phone',
  'confirmedAttendees',
  'tableNumber',
] as const

export type SeatingExportColumn = (typeof SEATING_EXPORT_COLUMNS)[number]

/**
 * The seating list as a table: one heading row, then one row per seated
 * party in table order. Headings come translated from the caller.
 */
export function buildSeatingExportTable(
  rows: readonly SeatingDetailRow[],
  headings: Record<SeatingExportColumn, string>,
): (string | number)[][] {
  return [
    SEATING_EXPORT_COLUMNS.map((column) => headings[column]),
    ...rows.map((row) => SEATING_EXPORT_COLUMNS.map((column) => row[column])),
  ]
}
