import { Bell } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import type { AccountNotification } from '../../domain/models.ts'
import { relativeDay } from '../../features/dashboard/activityTime.ts'
import { useFormatters } from '../../i18n/format.ts'
import { isolate } from '../../shared/ltr.ts'
import { cx } from '../../shared/ui/cx.ts'
import { Popover } from '../../shared/ui/Popover.tsx'
import styles from './NotificationBell.module.css'
import {
  useMarkNotificationsRead,
  useNotifications,
} from './notificationQueries.ts'

const KIND_TEXT = {
  ACCESS_GRANTED: 'notifications.kinds.accessGranted',
  ROLE_CHANGED: 'notifications.kinds.roleChanged',
  ACCESS_REMOVED: 'notifications.kinds.accessRemoved',
  UNKNOWN_RSVP: 'notifications.kinds.unknownRsvp',
} as const

/** Where a notice leads; nowhere once the event is gone or out of reach. */
function linkOf(notice: AccountNotification): string | null {
  if (notice.eventId === null || notice.kind === 'ACCESS_REMOVED') {
    return null
  }
  return notice.kind === 'UNKNOWN_RSVP'
    ? `/events/${notice.eventId}/guests?tab=unknown`
    : `/events/${notice.eventId}/dashboard`
}

/**
 * The bell in the top bar (D95): the account's notices, newest first, with
 * the number not yet read. Opening a notice marks it read.
 */
export function NotificationBell() {
  const { t } = useTranslation()
  const format = useFormatters()
  const notifications = useNotifications()
  const markRead = useMarkNotificationsRead()
  const items = notifications.data?.items ?? []
  const unread = notifications.data?.unread ?? 0

  function textOf(notice: AccountNotification): string {
    // Names keep their own direction inside a sentence of the other one.
    const values = {
      event: isolate(notice.eventName),
      actor: isolate(notice.actorName ?? ''),
      role: notice.role ? t(`roles.${notice.role}`) : '',
    }
    if (notice.kind === 'ACCESS_GRANTED' && notice.actorName === null) {
      return t('notifications.kinds.accessAccepted', values)
    }
    return t(KIND_TEXT[notice.kind], values)
  }

  function when(at: Date): string {
    // From when the list was last fetched, every minute, so "Today" stays
    // right on a page left open overnight.
    const day = relativeDay(at, new Date(notifications.dataUpdatedAt))
    const time = format.time(at)
    return day === 'other'
      ? t('dashboard.activity.onDate', { date: format.date(at), time })
      : t(`dashboard.activity.${day}`, { time })
  }

  return (
    <Popover
      label={
        unread > 0
          ? t('notifications.labelUnread', { count: unread })
          : t('notifications.label')
      }
      triggerClassName={styles.trigger}
      panelClassName={styles.panel}
      trigger={
        <>
          <Bell aria-hidden="true" />
          {unread > 0 && (
            <span className={styles.count} aria-hidden="true">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </>
      }
    >
      {(close) => (
        <>
          <div className={styles.header}>
            <h2 className={styles.title}>{t('notifications.title')}</h2>
            {unread > 0 && (
              <button
                type="button"
                className={styles.markAll}
                onClick={() => markRead.mutate(undefined)}
              >
                {t('notifications.markAll')}
              </button>
            )}
          </div>
          {notifications.data === undefined ? null : items.length === 0 ? (
            <p className={styles.empty}>{t('notifications.empty')}</p>
          ) : (
            <ul className={styles.list}>
              {items.map((notice) => {
                const at = new Date(notice.createdAt)
                const href = linkOf(notice)
                const body = (
                  <>
                    <span className={styles.text}>{textOf(notice)}</span>
                    <time className={styles.time} dateTime={notice.createdAt}>
                      {when(at)}
                    </time>
                    {!notice.read && (
                      <span className="visually-hidden">
                        {t('notifications.unread')}
                      </span>
                    )}
                  </>
                )
                return (
                  <li
                    key={notice.id}
                    className={cx(styles.item, !notice.read && styles.unread)}
                  >
                    {href ? (
                      <Link
                        to={href}
                        className={styles.link}
                        onClick={() => {
                          if (!notice.read) {
                            markRead.mutate(notice.id)
                          }
                          close()
                        }}
                      >
                        {body}
                      </Link>
                    ) : (
                      <div className={styles.link}>{body}</div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </>
      )}
    </Popover>
  )
}
