import {
  ArrowRight,
  CalendarDays,
  ChevronRight,
  Clock,
  Copy,
  Ellipsis,
  FolderOpen,
  Trash2,
  Users,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { useFormatters } from '../../i18n/format.ts'
import type { EventSummary } from '../../services/contracts/index.ts'
import { Badge } from '../../shared/ui/Badge.tsx'
import { ButtonLink } from '../../shared/ui/ButtonLink.tsx'
import { cx } from '../../shared/ui/cx.ts'
import { EventCover } from '../../shared/ui/EventCover.tsx'
import { Menu, type MenuItem } from '../../shared/ui/Menu.tsx'
import { RoleIcon } from '../../shared/ui/RoleIcon.tsx'
import styles from './EventCard.module.css'

export type EventsView = 'grid' | 'list'

interface EventCardProps {
  summary: EventSummary
  view: EventsView
  onDuplicate: () => void
  onDelete: () => void
}

export function EventCard({
  summary,
  view,
  onDuplicate,
  onDelete,
}: EventCardProps) {
  const { t } = useTranslation()
  const format = useFormatters()
  const { event, role, isPast, confirmedAttendees } = summary
  const startsAt = new Date(event.startsAt)
  const address = `/events/${event.id}/dashboard`
  const openLabel = t(isPast ? 'events.card.view' : 'events.card.open')
  // Only an Owner (or a Super User, who counts as one) may copy or delete.
  const canManage = role === 'OWNER'
  const filled = Math.min(
    100,
    Math.round((confirmedAttendees / event.maxAttendees) * 100),
  )

  const menuItems: MenuItem[] = [
    { id: 'open', label: openLabel, icon: <FolderOpen />, to: address },
    ...(canManage
      ? [
          {
            id: 'duplicate',
            label: t('events.card.duplicate'),
            icon: <Copy />,
            onSelect: onDuplicate,
          },
          {
            id: 'delete',
            label: t('events.card.delete'),
            icon: <Trash2 />,
            tone: 'danger' as const,
            onSelect: onDelete,
          },
        ]
      : []),
  ]

  return (
    <article className={cx(styles.card, styles[view])}>
      <div className={styles.media}>
        <EventCover eventId={event.id} />
        <span className={styles.status}>
          <Badge tone={isPast ? 'neutral' : 'success'}>
            <span className={styles.dot} aria-hidden="true" />
            {t(isPast ? 'events.status.past' : 'events.status.upcoming')}
          </Badge>
        </span>
        <span className={styles.menu}>
          <Menu
            label={t('events.card.actions', { name: event.name })}
            triggerClassName={styles.menuButton}
            items={menuItems}
          >
            <Ellipsis aria-hidden="true" />
          </Menu>
        </span>
      </div>

      <div className={styles.body}>
        <h2 className={styles.name}>
          {view === 'list' ? (
            <Link to={address} className={styles.nameLink}>
              {event.name}
            </Link>
          ) : (
            event.name
          )}
        </h2>
        <ul className={styles.details}>
          <li>
            <CalendarDays aria-hidden="true" />
            <span className="visually-hidden">{t('events.card.date')}</span>
            {format.date(startsAt, event.timeZone)}
          </li>
          <li>
            <Clock aria-hidden="true" />
            <span className="visually-hidden">{t('events.card.time')}</span>
            {format.time(startsAt, event.timeZone)}
          </li>
          <li>
            <Users aria-hidden="true" />
            {t('events.card.maxAttendees', {
              formatted: format.number(event.maxAttendees),
            })}
          </li>
          <li>
            <RoleIcon role={role} />
            <span className="visually-hidden">{t('events.card.role')}</span>
            {t(`roles.${role}`)}
          </li>
        </ul>
        <div className={styles.attendance}>
          <div className={styles.attendanceLabels}>
            <span>
              {t('events.card.confirmed', {
                formatted: format.number(confirmedAttendees),
              })}
            </span>
            <span>
              {t('events.card.capacity', {
                formatted: format.number(event.maxAttendees),
              })}
            </span>
          </div>
          <div
            className={styles.track}
            role="progressbar"
            aria-label={t('events.card.attendance', { name: event.name })}
            aria-valuemin={0}
            aria-valuemax={event.maxAttendees}
            aria-valuenow={Math.min(confirmedAttendees, event.maxAttendees)}
          >
            <div className={styles.fill} style={{ inlineSize: `${filled}%` }} />
          </div>
        </div>
        {view === 'grid' && (
          <div className={styles.footer}>
            <ButtonLink
              to={address}
              variant={isPast ? 'secondary' : 'primary'}
              icon={isPast ? undefined : <ArrowRight />}
              iconPosition="end"
              label={t('events.card.openNamed', {
                action: openLabel,
                name: event.name,
              })}
            >
              {openLabel}
            </ButtonLink>
          </div>
        )}
      </div>
      {view === 'list' && (
        <ChevronRight className={styles.chevron} aria-hidden="true" />
      )}
    </article>
  )
}
