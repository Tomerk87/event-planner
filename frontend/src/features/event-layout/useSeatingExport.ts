import { useTranslation } from 'react-i18next'
import {
  SEATING_EXPORT_COLUMNS,
  type SeatingExportColumn,
} from '../../domain/exports.ts'
import { getCurrentLanguage } from '../../i18n/i18n.ts'
import { useServices } from '../../services/servicesContext.ts'
import { downloadBlob, safeFileName } from '../../shared/download.ts'
import { describeError } from '../../shared/errorMessage.ts'
import { useToast } from '../../shared/ui/toastContext.ts'
import type { FileFormat } from '../guests/guestFiles.ts'

/**
 * Saves the seating list as a file: one row per seated party, in table
 * order, with headings in the interface language.
 */
export function useSeatingExport(eventId: string, eventName: string) {
  const { t } = useTranslation()
  const { showToast } = useToast()
  const { files } = useServices()

  return async (format: FileFormat) => {
    const headings = Object.fromEntries(
      SEATING_EXPORT_COLUMNS.map((column) => [
        column,
        t(`layout.export.headings.${column}`),
      ]),
    ) as Record<SeatingExportColumn, string>
    try {
      const blob = await files.exportSeating(eventId, {
        format,
        headings,
        sheetName: t('layout.export.sheet'),
        rightToLeft: getCurrentLanguage() === 'he',
      })
      downloadBlob(
        blob,
        `${safeFileName(t('layout.export.fileName', { event: eventName }))}.${format}`,
      )
      showToast({ tone: 'success', message: t('layout.export.done') })
    } catch (error) {
      showToast({ tone: 'danger', message: describeError(t, error) })
    }
  }
}
