import { useTranslation } from 'react-i18next'
import type { VenueNoticeView } from '../../services/contracts/index.ts'
import { useFormatters } from '../../i18n/format.ts'
import { isolate } from '../../shared/ltr.ts'

/**
 * The words of a venue change (D122), the same in the bell and in the
 * banners: a title, what to do, and where "Fix seating" leads.
 */
export function useVenueNoticeText() {
  const { t } = useTranslation()
  const format = useFormatters()
  return (notice: VenueNoticeView) => {
    const values = {
      event: isolate(notice.eventName),
      venue: isolate(notice.venueName),
      table: format.number(notice.tableNumber ?? 0),
      over: format.number(notice.overBy),
      parties: format.number(notice.parties),
      people: format.number(notice.people),
      count: notice.parties,
      changes: format.list(
        notice.changes.map((change) => t(`venueNotices.changes.${change}`)),
      ),
    }
    const body =
      notice.kind === 'TABLE_OVER_CAPACITY'
        ? notice.open
          ? t('venueNotices.overCapacity', values)
          : t('venueNotices.overCapacityFixed', values)
        : notice.kind === 'TABLE_REMOVED'
          ? t('venueNotices.removed', values)
          : t('venueNotices.details', values)
    const href =
      notice.kind === 'DETAILS_CHANGED'
        ? `/events/${notice.eventId}/settings`
        : notice.kind === 'TABLE_OVER_CAPACITY' && notice.tableId
          ? `/events/${notice.eventId}/layout?table=${notice.tableId}`
          : `/events/${notice.eventId}/layout`
    return {
      title:
        notice.severity === 'ACTION'
          ? t('venueNotices.actionTitle', values)
          : t('venueNotices.infoTitle', values),
      body,
      href,
    }
  }
}
