import { useTranslation } from 'react-i18next'
import { useFormatters } from '../../i18n/format.ts'
import type { TableWithOccupancy } from '../../services/contracts/index.ts'

interface TableOptionsProps {
  tables: readonly TableWithOccupancy[]
  /** The guest's current table, shown by its number alone. */
  ownTableId: string | null
}

/**
 * The tables a guest can be seated at, by number. The other tables also show
 * their free seats, which is what matters when choosing where to move.
 */
export function TableOptions({ tables, ownTableId }: TableOptionsProps) {
  const { t } = useTranslation()
  const format = useFormatters()

  return [...tables]
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
