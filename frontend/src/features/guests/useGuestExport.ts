import { useTranslation } from 'react-i18next'
import {
  GUEST_EXPORT_COLUMNS,
  type GuestExportLabels,
} from '../../domain/exports.ts'
import { GUEST_DISPLAY_STATUSES } from '../../domain/guestStatus.ts'
import type { Guest } from '../../domain/models.ts'
import { getCurrentLanguage } from '../../i18n/i18n.ts'
import { useServices } from '../../services/servicesContext.ts'
import { downloadBlob, safeFileName } from '../../shared/download.ts'
import { describeError } from '../../shared/errorMessage.ts'
import { useToast } from '../../shared/ui/toastContext.ts'
import type { FileFormat } from './guestFiles.ts'

/**
 * Saves guests as a file. The file always has every field, whatever columns
 * the table is showing, with headings in the interface language.
 */
export function useGuestExport(eventId: string, eventName: string) {
  const { t } = useTranslation()
  const { showToast } = useToast()
  const { files } = useServices()

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
      const blob = await files.exportGuests(eventId, {
        format,
        guestIds: guests.map((guest) => guest.id),
        labels,
        sheetName: t('guests.export.sheet'),
        rightToLeft: getCurrentLanguage() === 'he',
      })
      downloadBlob(
        blob,
        `${safeFileName(t('guests.export.fileName', { event: eventName }))}.${format}`,
      )
      showToast({ tone: 'success', message: t('guests.export.done') })
    } catch (error) {
      showToast({ tone: 'danger', message: describeError(t, error) })
    }
  }
}
