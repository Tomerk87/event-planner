import type { ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import { useFormatters } from '../../i18n/format.ts'
import type { TableWithOccupancy } from '../../services/contracts/index.ts'

/**
 * Builds the choices of a table selector, by number. The guest's own table
 * shows its number alone; the other tables also show their free seats, which
 * is what matters when choosing where to move.
 */
export function useTableOptions(): (
  tables: readonly TableWithOccupancy[],
  ownTableId: string | null,
) => ReactElement[] {
  const { t } = useTranslation()
  const format = useFormatters()

  return (tables, ownTableId) =>
    [...tables]
      .sort((a, b) => a.table.number - b.table.number)
      .map(({ table, available }) => (
        <option key={table.id} value={table.id}>
          {table.id === ownTableId
            ? t('guests.table.tableChosen', {
                number: format.number(table.number),
              })
            : t('guests.table.tableChoice', {
                number: format.number(table.number),
                available: format.number(Math.max(0, available)),
              })}
        </option>
      ))
}
