import { Armchair, Check, CircleAlert, Info } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '../../shared/ui/Button.tsx'
import { ButtonLink } from '../../shared/ui/ButtonLink.tsx'
import { cx } from '../../shared/ui/cx.ts'
import styles from './ClientNoticeBanners.module.css'
import { useHandleNotice, useMarkNoticesRead } from './venueMutations.ts'
import { useVenueNotices } from './venueQueries.ts'
import { useVenueNoticeText } from './venueNoticeText.ts'

/**
 * The venue's changes on the client's pages (D122): every action still
 * needed, in red, until it is done; on the Dashboard, news not yet read.
 */
export function ClientNoticeBanners({
  eventId,
  place,
  onFix,
}: {
  eventId: string
  place: 'dashboard' | 'layout'
  /** On the Layout page, "Fix seating" opens the table there. */
  onFix?: (tableId: string | null) => void
}) {
  const { t } = useTranslation()
  const notices = useVenueNotices(eventId)
  const markRead = useMarkNoticesRead()
  const handle = useHandleNotice(eventId)
  const textOf = useVenueNoticeText()
  const shown = (notices.data ?? []).filter(
    (notice) =>
      notice.open && (notice.severity === 'ACTION' || place === 'dashboard'),
  )
  if (shown.length === 0) {
    return null
  }
  return (
    <ul className={styles.list} aria-label={t('venueNotices.label')}>
      {shown.map((notice) => {
        const text = textOf(notice)
        const action = notice.severity === 'ACTION'
        return (
          <li
            key={notice.id}
            className={cx(styles.banner, action ? styles.action : styles.info)}
            role={action ? 'alert' : undefined}
          >
            {action ? (
              <CircleAlert className={styles.icon} aria-hidden="true" />
            ) : (
              <Info className={styles.icon} aria-hidden="true" />
            )}
            <div className={styles.text}>
              <p className={styles.title}>{text.title}</p>
              <p>{text.body}</p>
              {notice.note && (
                <blockquote className={styles.note}>
                  <span className={styles.noteBy}>
                    {t('venueNotices.noteFrom', {
                      name: notice.actorName ?? notice.venueName,
                    })}
                  </span>
                  <bdi>{notice.note}</bdi>
                </blockquote>
              )}
              <div className={styles.actions}>
                {action &&
                  (onFix ? (
                    <Button
                      size="sm"
                      icon={<Armchair />}
                      onClick={() => onFix(notice.tableId)}
                    >
                      {t('venueNotices.fix')}
                    </Button>
                  ) : (
                    <ButtonLink to={text.href} icon={<Armchair />}>
                      {t('venueNotices.fix')}
                    </ButtonLink>
                  ))}
                {notice.kind === 'TABLE_REMOVED' && (
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={<Check />}
                    loading={handle.isPending}
                    onClick={() => handle.mutate(notice.id)}
                  >
                    {t('venueNotices.handled')}
                  </Button>
                )}
                {!action && (
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={<Check />}
                    loading={markRead.isPending}
                    onClick={() => markRead.mutate([notice.id])}
                  >
                    {t('venueNotices.markRead')}
                  </Button>
                )}
              </div>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
