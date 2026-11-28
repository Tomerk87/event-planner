import type { GuestSortKey } from '../../domain/guestList.ts'

/** The data columns of the guests table, in display order. */
export const GUEST_COLUMNS = [
  'name',
  'invitationName',
  'phone',
  'allowed',
  'confirmed',
  'status',
  'sent',
  'table',
  'group',
] as const satisfies readonly GuestSortKey[]

export type GuestColumnId = (typeof GUEST_COLUMNS)[number]

/**
 * The venue's view of a client's list (#17): no phone and no message
 * history, and no choosing (D111).
 */
export const VENUE_GUEST_COLUMNS: readonly GuestColumnId[] = [
  'name',
  'allowed',
  'confirmed',
  'status',
  'table',
  'group',
]

/** Columns that identify a guest and so can never be hidden. */
export const REQUIRED_GUEST_COLUMNS: readonly GuestColumnId[] = [
  'name',
  'phone',
]

export function isRequiredColumn(column: GuestColumnId): boolean {
  return REQUIRED_GUEST_COLUMNS.includes(column)
}

/**
 * The columns to show for a stored choice. Unknown ids are ignored, the
 * required columns are always included, and no choice means every column.
 */
export function resolveGuestColumns(
  stored: readonly string[] | null | undefined,
): GuestColumnId[] {
  if (!stored) {
    return [...GUEST_COLUMNS]
  }
  return GUEST_COLUMNS.filter(
    (column) => isRequiredColumn(column) || stored.includes(column),
  )
}
