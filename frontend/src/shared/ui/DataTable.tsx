import type { ReactNode } from 'react'
import { cx } from './cx.ts'
import styles from './DataTable.module.css'

export interface Column<Row> {
  id: string
  header: string
  cell: (row: Row) => ReactNode
  align?: 'start' | 'end'
}

interface DataTableProps<Row> {
  caption: string
  columns: Column<Row>[]
  rows: Row[]
  getRowKey: (row: Row) => string
  /** Phone presentation of one row; shown instead of the table below 768px. */
  renderCard: (row: Row) => ReactNode
}

export function DataTable<Row>({
  caption,
  columns,
  rows,
  getRowKey,
  renderCard,
}: DataTableProps<Row>) {
  return (
    <>
      <div className={styles.tableView}>
        <table className={styles.table}>
          <caption className="visually-hidden">{caption}</caption>
          <thead>
            <tr>
              {columns.map((column) => (
                <th
                  key={column.id}
                  scope="col"
                  className={cx(column.align === 'end' && styles.end)}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={getRowKey(row)}>
                {columns.map((column) => (
                  <td
                    key={column.id}
                    className={cx(column.align === 'end' && styles.end)}
                  >
                    {column.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className={styles.cardView} aria-label={caption}>
        {rows.map((row) => (
          <li key={getRowKey(row)} className={styles.card}>
            {renderCard(row)}
          </li>
        ))}
      </ul>
    </>
  )
}
