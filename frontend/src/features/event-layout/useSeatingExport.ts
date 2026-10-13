import { useTranslation } from 'react-i18next'
import {
  buildSeatingDetailRows,
  buildSeatingExportTable,
  SEATING_EXPORT_COLUMNS,
  type SeatingExportColumn,
} from '../../domain/exports.ts'
import type { EventTable, Guest } from '../../domain/models.ts'
import { getCurrentLanguage } from '../../i18n/i18n.ts'
import { safeFileName } from '../../shared/download.ts'
import { describeError } from '../../shared/errorMessage.ts'
import { useToast } from '../../shared/ui/toastContext.ts'
import { saveSpreadsheet, type FileFormat } from '../guests/guestFiles.ts'

/**
 * Saves the seating list as a file: one row per seated party, in table
 * order, with headings in the interface language.
 */
export function useSeatingExport(eventName: string) {
  const { t } = useTranslation()
  const { showToast } = useToast()

  return async (
    format: FileFormat,
    guests: readonly Guest[],
    tables: readonly EventTable[],
  ) => {
    const headings = Object.fromEntries(
      SEATING_EXPORT_COLUMNS.map((column) => [
        column,
        t(`layout.export.headings.${column}`),
      ]),
    ) as Record<SeatingExportColumn, string>
    try {
      await saveSpreadsheet(
        buildSeatingExportTable(
          buildSeatingDetailRows(guests, tables),
          headings,
        ),
        format,
        safeFileName(t('layout.export.fileName', { event: eventName })),
        {
          sheetName: t('layout.export.sheet'),
          rightToLeft: getCurrentLanguage() === 'he',
        },
      )
      showToast({ tone: 'success', message: t('layout.export.done') })
    } catch (error) {
      showToast({ tone: 'danger', message: describeError(t, error) })
    }
  }
}
