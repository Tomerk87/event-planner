import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import type { ReactNode } from 'react'
import { PHONE_QUERY, useMediaQuery } from '../useMediaQuery.ts'
import { Checkbox } from './Checkbox.tsx'
import { cx } from './cx.ts'
import styles from './DataTable.module.css'

export interface Column<Row> {
  id: string
  header: string
  cell: (row: Row) => ReactNode
  align?: 'start' | 'end'
  /** Makes the heading a button that sorts by this column. */
  sortable?: boolean
  /** Show the heading to assistive technology only (an actions column). */
  hideHeader?: boolean
  /** Keep the column in view at the end while the table scrolls sideways. */
  pinned?: boolean
}

export interface TableSort {
  columnId: string
  direction: 'asc' | 'desc'
}

export interface TableSelection<Row> {
  selected: ReadonlySet<string>
  onToggle: (key: string, selected: boolean) => void
  /** Selects or clears every row currently shown. */
  onToggleAll: (selected: boolean) => void
  rowLabel: (row: Row) => string
  allLabel: string
}

interface DataTableProps<Row> {
  caption: string
  columns: Column<Row>[]
  rows: Row[]
  getRowKey: (row: Row) => string
  /** Phone presentation of one row; rendered instead of the table below 768px. */
  renderCard: (row: Row) => ReactNode
  sort?: TableSort
  onSort?: (columnId: string) => void
  /** What a sortable heading's button says, for example "Sort by Name". */
  sortLabel?: (header: string) => string
  /** Adds a checkbox to each row and to the heading. Desktop table only. */
  selection?: TableSelection<Row>
}

export function DataTable<Row>({
  caption,
  columns,
  rows,
  getRowKey,
  renderCard,
  sort,
  onSort,
  sortLabel,
  selection,
}: DataTableProps<Row>) {
  const isPhone = useMediaQuery(PHONE_QUERY)

  if (isPhone) {
    return (
      <ul className={styles.cardView} aria-label={caption}>
        {rows.map((row) => (
          <li key={getRowKey(row)} className={styles.card}>
            {renderCard(row)}
          </li>
        ))}
      </ul>
    )
  }

  const selectedOnPage = selection
    ? rows.filter((row) => selection.selected.has(getRowKey(row))).length
    : 0

  return (
    <div className={styles.tableView}>
      <table className={styles.table}>
        <caption className="visually-hidden">{caption}</caption>
        <thead>
          <tr>
            {selection && (
              <th scope="col" className={styles.selectCell}>
                <Checkbox
                  label={selection.allLabel}
                  hideLabel
                  checked={rows.length > 0 && selectedOnPage === rows.length}
                  indeterminate={
                    selectedOnPage > 0 && selectedOnPage < rows.length
                  }
                  disabled={rows.length === 0}
                  onChange={(event) =>
                    selection.onToggleAll(event.target.checked)
                  }
                />
              </th>
            )}
            {columns.map((column) => {
              const sorted = sort?.columnId === column.id ? sort : undefined
              const SortIcon = !sorted
                ? ArrowUpDown
                : sorted.direction === 'asc'
                  ? ArrowUp
                  : ArrowDown
              return (
                <th
                  key={column.id}
                  scope="col"
                  className={cx(
                    column.align === 'end' && styles.end,
                    column.pinned && styles.pinned,
                  )}
                  aria-sort={
                    !column.sortable
                      ? undefined
                      : !sorted
                        ? 'none'
                        : sorted.direction === 'asc'
                          ? 'ascending'
                          : 'descending'
                  }
                >
                  {column.sortable && onSort ? (
                    <button
                      type="button"
                      className={cx(
                        styles.sortButton,
                        sorted && styles.sortButtonActive,
                      )}
                      title={sortLabel?.(column.header)}
                      onClick={() => onSort(column.id)}
                    >
                      {column.header}
                      <SortIcon aria-hidden="true" />
                    </button>
                  ) : column.hideHeader ? (
                    <span className="visually-hidden">{column.header}</span>
                  ) : (
                    column.header
                  )}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const key = getRowKey(row)
            const isSelected = selection?.selected.has(key) ?? false
            return (
              <tr key={key} className={cx(isSelected && styles.selectedRow)}>
                {selection && (
                  <td className={styles.selectCell}>
                    <Checkbox
                      label={selection.rowLabel(row)}
                      hideLabel
                      checked={isSelected}
                      onChange={(event) =>
                        selection.onToggle(key, event.target.checked)
                      }
                    />
                  </td>
                )}
                {columns.map((column) => (
                  <td
                    key={column.id}
                    className={cx(
                      column.align === 'end' && styles.end,
                      column.pinned && styles.pinned,
                    )}
                  >
                    {column.cell(row)}
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
