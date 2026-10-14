import type { EventTable, TableShape } from './models.ts'
import { TABLE_STATUSES, tableStatus } from './seating.ts'

/** A table with the attendees seated at it. */
export interface SeatedTable {
  table: EventTable
  assigned: number
  /** Negative when the table is over capacity. */
  available: number
}

export const TABLE_SORT_KEYS = [
  'number',
  'shape',
  'capacity',
  'assigned',
  'available',
  'status',
] as const

export type TableSortKey = (typeof TABLE_SORT_KEYS)[number]

export interface TableListSort {
  key: TableSortKey
  direction: 'asc' | 'desc'
}

export const DEFAULT_TABLE_SORT: TableListSort = {
  key: 'number',
  direction: 'asc',
}

export interface TableFilters {
  /** Digits of a table number; a table matches when its number contains them. */
  query: string
  shape: 'ALL' | TableShape
}

export function filterTables<Item extends SeatedTable>(
  items: readonly Item[],
  filters: TableFilters,
): Item[] {
  const digits = filters.query.replace(/\D/g, '')
  const hasText = filters.query.trim() !== ''
  return items.filter(
    ({ table }) =>
      (filters.shape === 'ALL' || table.shape === filters.shape) &&
      // Text with no digit in it cannot be part of a table number.
      (!hasText || (digits !== '' && String(table.number).includes(digits))),
  )
}

function sortValue(item: SeatedTable, key: TableSortKey): number | string {
  switch (key) {
    case 'number':
      return item.table.number
    case 'shape':
      return item.table.shape
    case 'capacity':
      return item.table.capacity
    case 'assigned':
      return item.assigned
    case 'available':
      return item.available
    case 'status':
      // The order of the statuses: the tables needing attention first.
      return TABLE_STATUSES.indexOf(
        tableStatus(item.table.capacity, item.assigned),
      )
  }
}

/** Sorts tables; tables equal in the chosen column stay in number order. */
export function sortTables<Item extends SeatedTable>(
  items: readonly Item[],
  sort: TableListSort,
): Item[] {
  const sign = sort.direction === 'asc' ? 1 : -1
  return [...items].sort((a, b) => {
    const first = sortValue(a, sort.key)
    const second = sortValue(b, sort.key)
    const order =
      typeof first === 'number' && typeof second === 'number'
        ? first - second
        : String(first).localeCompare(String(second))
    return order * sign || a.table.number - b.table.number
  })
}
