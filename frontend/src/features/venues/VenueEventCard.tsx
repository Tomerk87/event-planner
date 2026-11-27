import {
  CalendarDays,
  CircleAlert,
  CircleCheck,
  Clock,
  History,
  Mail,
  MapPin,
  User,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { VenueEventStatus } from '../../domain/venues.ts'
import { useFormatters } from '../../i18n/format.ts'
import type { VenueEventSummary } from '../../services/contracts/index.ts'
import { Badge, type Tone } from '../../shared/ui/Badge.tsx'
import { Button } from '../../shared/ui/Button.tsx'
import { cx } from '../../shared/ui/cx.ts'
import { EventCover } from '../../shared/ui/EventCover.tsx'
import type { EventsView } from '../events/EventCard.tsx'
import styles from '../events/EventCard.module.css'
import venueStyles from './VenueEventCard.module.css'

/** How each status shows (D115): never by colour alone. */
const STATUS_LOOK: Record<VenueEventStatus, { tone: Tone; icon: LucideIcon }> =
  {
    AWAITING_CLIENT: { tone: 'warning', icon: Clock },
    INVITATION_SENT: { tone: 'info', icon: Mail },
    INVITATION_EXPIRED: { tone: 'warning', icon: CircleAlert },
    CLIENT_JOINED: { tone: 'success', icon: CircleCheck },
    PAST: { tone: 'neutral', icon: History },
  }

export function VenueStatusBadge({ status }: { status: VenueEventStatus }) {
  const { t } = useTranslation()
  const { tone, icon: Icon } = STATUS_LOOK[status]
  return (
    <Badge tone={tone} icon={<Icon />}>
      {t(`venueEvents.status.${status}`)}
    </Badge>
  )
}

interface VenueEventCardProps {
  summary: VenueEventSummary
  view: EventsView
}

/** One event on a venue's My Events (mockup #2). */
export function VenueEventCard({ summary, view }: VenueEventCardProps) {
  const { t } = useTranslation()
  const format = useFormatters()
  const { event, space, status, client, confirmedAttendees, isPast } = summary
  const startsAt = new Date(event.startsAt)
  const openLabel = t(isPast ? 'events.card.view' : 'events.card.open')
  // Guests exist once the client has joined; before that a note says why not.
  const showsAttendance = status === 'CLIENT_JOINED' || status === 'PAST'
  const noteDate =
    status === 'INVITATION_EXPIRED'
      ? summary.invitationExpiresAt
      : summary.invitationSentAt
  const filled = Math.min(
    100,
    Math.round((confirmedAttendees / event.maxAttendees) * 100),
  )

  return (
    <article className={cx(styles.card, styles[view])}>
      <div className={styles.media}>
        <EventCover eventId={event.id} image={event.coverImage} />
        {view === 'grid' && (
          <span className={styles.status}>
            <VenueStatusBadge status={status} />
          </span>
        )}
      </div>

      <div className={styles.body}>
        <h2 className={styles.name}>{event.name}</h2>
        {view === 'list' && (
          <span className={venueStyles.listStatus}>
            <VenueStatusBadge status={status} />
          </span>
        )}
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
            <MapPin aria-hidden="true" />
            <span className="visually-hidden">{t('venueEvents.space')}</span>
            {space.name}
          </li>
          <li className={client ? undefined : venueStyles.awaiting}>
            <User aria-hidden="true" />
            {client
              ? t('venueEvents.client', { name: client.name })
              : t('venueEvents.awaitingClient')}
          </li>
          <li>
            <Users aria-hidden="true" />
            {t('events.card.maxAttendees', {
              formatted: format.number(event.maxAttendees),
            })}
          </li>
        </ul>
        {showsAttendance ? (
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
              <div
                className={styles.fill}
                style={{ inlineSize: `${filled}%` }}
              />
            </div>
          </div>
        ) : (
          <p className={venueStyles.note}>
            {t(`venueEvents.note.${status}`, {
              date: noteDate
                ? format.date(new Date(noteDate), event.timeZone)
                : '',
            })}
          </p>
        )}
        {view === 'grid' && (
          <div className={styles.footer}>
            {/* Opening a venue event comes with its two sides (PLAN.md Phase 29). */}
            <Button
              variant={isPast ? 'secondary' : 'primary'}
              disabled
              title={t('venueEvents.soon')}
              aria-label={t('events.card.openNamed', {
                action: openLabel,
                name: event.name,
              })}
            >
              {openLabel}
            </Button>
          </div>
        )}
      </div>
    </article>
  )
}
