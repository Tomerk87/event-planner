import { useTranslation } from 'react-i18next'
import {
  buildGuestExportRows,
  buildGuestExportTable,
  GUEST_EXPORT_COLUMNS,
  type GuestExportLabels,
} from '../../domain/exports.ts'
import { GUEST_DISPLAY_STATUSES } from '../../domain/guestStatus.ts'
import type { EventTable, Guest } from '../../domain/models.ts'
import { getCurrentLanguage } from '../../i18n/i18n.ts'
import { safeFileName } from '../../shared/download.ts'
import { describeError } from '../../shared/errorMessage.ts'
import { useToast } from '../../shared/ui/toastContext.ts'
import { saveSpreadsheet, type FileFormat } from './guestFiles.ts'

/**
 * Saves guests as a file. The file always has every field, whatever columns
 * the table is showing, with headings in the interface language.
 */
export function useGuestExport(
  eventName: string,
  tables: readonly EventTable[],
) {
  const { t } = useTranslation()
  const { showToast } = useToast()

  return async (format: FileFormat, guests: readonly Guest[]) => {
    const labels: GuestExportLabels = {
      headings: Object.fromEntries(
        GUEST_EXPORT_COLUMNS.map((column) => [
          column,
          t(`guests.export.headings.${column}`),
        ]),
      ) as GuestExportLabels['headings'],
      statuses: Object.fromEntries(
        GUEST_DISPLAY_STATUSES.map((status) => [
          status,
          t(`guests.status.${status}`),
        ]),
      ) as GuestExportLabels['statuses'],
    }
    try {
      await saveSpreadsheet(
        buildGuestExportTable(buildGuestExportRows(guests, tables), labels),
        format,
        safeFileName(t('guests.export.fileName', { event: eventName })),
        {
          sheetName: t('guests.export.sheet'),
          rightToLeft: getCurrentLanguage() === 'he',
        },
      )
      showToast({ tone: 'success', message: t('guests.export.done') })
    } catch (error) {
      showToast({ tone: 'danger', message: describeError(t, error) })
    }
  }
}
