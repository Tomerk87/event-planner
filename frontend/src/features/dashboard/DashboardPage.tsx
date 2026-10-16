import {
  Armchair,
  CheckCheck,
  ChevronRight,
  CircleCheck,
  CircleHelp,
  Clock,
  History,
  Mail,
  MessageCircle,
  Send,
  Settings,
  Table2,
  TriangleAlert,
  UserCheck,
  UserX,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import {
  computeRsvpBreakdown,
  type DashboardMetrics,
  type RsvpSegment,
} from '../../domain/metrics.ts'
import { useFormatters } from '../../i18n/format.ts'
import { useSeatingNotice } from './useSeatingNotice.ts'
import type {
  ActivityItem,
  Dashboard,
  EventAccessInfo,
} from '../../services/contracts/index.ts'
import { useEventAccessInfo } from '../../services/queries.ts'
import { ReadOnlyNotice } from '../../shared/access/EventAccess.tsx'
import { describeError } from '../../shared/errorMessage.ts'
import type { Tone } from '../../shared/ui/Badge.tsx'
import { Button } from '../../shared/ui/Button.tsx'
import { ButtonLink } from '../../shared/ui/ButtonLink.tsx'
import { Card, KpiCard, KpiGrid } from '../../shared/ui/Card.tsx'
import { cx } from '../../shared/ui/cx.ts'
import { Dialog } from '../../shared/ui/Dialog.tsx'
import { LtrText } from '../../shared/ui/LtrText.tsx'
import { PageHeader } from '../../shared/ui/PageHeader.tsx'
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from '../../shared/ui/States.tsx'
import { relativeDay } from './activityTime.ts'
import styles from './Dashboard.module.css'
import { useDashboard } from './dashboardQueries.ts'
import { RsvpDonut } from './RsvpDonut.tsx'
import { WarningCards, type Warning } from './WarningCards.tsx'

const ACTIVITY_PREVIEW = 5
const LISTED_TABLE_CONFLICTS = 2

const ACTIVITY_STYLE = {
  APPROVED: { icon: CheckCheck, tone: 'success' },
  DECLINED: { icon: X, tone: 'danger' },
  NOT_SURE: { icon: CircleHelp, tone: 'warning' },
  INVITATION_SENT: { icon: Send, tone: 'info' },
} as const satisfies Record<string, { icon: LucideIcon; tone: Tone }>

/** Times are shown on the viewer's own clock, like the rest of their device. */
function ActivityList({ items }: { items: readonly ActivityItem[] }) {
  const { t } = useTranslation()
  const format = useFormatters()
  const [now] = useState(() => new Date())

  function describe(item: ActivityItem): string {
    if (item.kind === 'INVITATION_SENT') {
      return t('dashboard.activity.sent')
    }
    if (item.status === 'APPROVED') {
      return t('dashboard.activity.approved', {
        attendees: format.number(item.confirmedAttendees ?? 0),
      })
    }
    return t(
      item.status === 'DECLINED'
        ? 'dashboard.activity.declined'
        : 'dashboard.activity.notSure',
    )
  }

  function when(at: Date): string {
    const day = relativeDay(at, now)
    const time = format.time(at)
    return day === 'other'
      ? t('dashboard.activity.onDate', {
          date: format.date(at),
          time,
        })
      : t(`dashboard.activity.${day}`, { time })
  }

  return (
    <ul className={styles.activity}>
      {items.map((item, index) => {
        const style =
          ACTIVITY_STYLE[item.kind === 'RSVP' ? item.status : item.kind]
        const Icon = style.icon
        return (
          <li
            key={`${item.kind}-${item.guestId}-${item.at}-${index}`}
            className={styles.activityItem}
          >
            <span
              className={cx(styles.activityIcon, styles[style.tone])}
              aria-hidden="true"
            >
              <Icon />
            </span>
            <span className={styles.activityText}>
              <span className={styles.activityName}>{item.guestName}</span>
              <span className={styles.activityWhat}>{describe(item)}</span>
            </span>
            <time className={styles.activityTime} dateTime={item.at}>
              {when(new Date(item.at))}
            </time>
          </li>
        )
      })}
    </ul>
  )
}

function DashboardContent({
  eventId,
  info,
  data,
}: {
  eventId: string
  info: EventAccessInfo
  data: Dashboard
}) {
  const { t } = useTranslation()
  const format = useFormatters()
  const [activityOpen, setActivityOpen] = useState(false)
  const { metrics, warnings, recentActivity } = data
  const { maxAttendees } = info.event
  const seating = useSeatingNotice(data, maxAttendees)
  const base = `/events/${eventId}`
  const number = format.number

  const invitations = t('dashboard.unit.invitations')
  const people = t('dashboard.unit.people')
  const kpis: {
    id: keyof DashboardMetrics
    value: number
    icon: LucideIcon
    tone: Tone
    hint: string
  }[] = [
    {
      id: 'totalGuests',
      value: metrics.totalGuests,
      icon: Users,
      tone: 'info',
      hint: invitations,
    },
    {
      id: 'invitationsSent',
      value: metrics.invitationsSent,
      icon: Mail,
      tone: 'info',
      hint: invitations,
    },
    {
      id: 'invitationsNotSent',
      value: metrics.invitationsNotSent,
      icon: Send,
      tone: 'neutral',
      hint: invitations,
    },
    {
      id: 'awaitingResponse',
      value: metrics.awaitingResponse,
      icon: Clock,
      tone: 'warning',
      hint: invitations,
    },
    {
      id: 'rsvpApproved',
      value: metrics.rsvpApproved,
      icon: CheckCheck,
      tone: 'success',
      hint: invitations,
    },
    {
      id: 'rsvpNotSure',
      value: metrics.rsvpNotSure,
      icon: CircleHelp,
      tone: 'warning',
      hint: invitations,
    },
    {
      id: 'rsvpDeclined',
      value: metrics.rsvpDeclined,
      icon: X,
      tone: 'danger',
      hint: invitations,
    },
    {
      id: 'confirmedAttendees',
      value: metrics.confirmedAttendees,
      icon: UserCheck,
      tone: 'success',
      hint: people,
    },
    {
      id: 'seatingCapacity',
      value: metrics.seatingCapacity,
      icon: Armchair,
      tone: 'info',
      hint: t('dashboard.unit.chairs'),
    },
    {
      id: 'unassignedConfirmedAttendees',
      value: metrics.unassignedConfirmedAttendees,
      icon: UserX,
      tone: metrics.unassignedConfirmedAttendees > 0 ? 'warning' : 'neutral',
      hint: people,
    },
  ]

  const shown: Warning[] = []
  if (warnings.attendeesOverMaximum > 0) {
    shown.push({
      id: 'overMaximum',
      tone: 'danger',
      icon: TriangleAlert,
      title: t('dashboard.warnings.overMaximum.title'),
      lines: [
        t('dashboard.warnings.overMaximum.body', {
          over: number(warnings.attendeesOverMaximum),
          confirmed: number(metrics.confirmedAttendees),
          max: number(maxAttendees),
        }),
      ],
      to: `${base}/settings`,
    })
  }
  if (seating) {
    shown.push({
      id: 'seating',
      tone: seating.tone,
      icon: seating.tone === 'warning' ? TriangleAlert : CircleCheck,
      title: seating.title,
      lines: [seating.body],
      to: `${base}/layout`,
    })
  }
  if (warnings.tablesOverCapacity.length > 0) {
    const conflicts = warnings.tablesOverCapacity
    const listed = conflicts.slice(0, LISTED_TABLE_CONFLICTS)
    shown.push({
      id: 'tables',
      tone: 'danger',
      icon: Users,
      title: t('dashboard.warnings.tables.title', {
        count: number(conflicts.length),
      }),
      lines: [
        ...listed.map((conflict) =>
          t('dashboard.warnings.tables.line', {
            table: number(conflict.tableNumber),
            over: number(conflict.over),
          }),
        ),
        ...(conflicts.length > listed.length
          ? [
              t('dashboard.warnings.tables.more', {
                count: number(conflicts.length - listed.length),
              }),
            ]
          : []),
      ],
      to: `${base}/layout`,
    })
  }
  if (warnings.attendeesAwaitingTable > 0) {
    shown.push({
      id: 'awaitingTable',
      tone: 'info',
      icon: Armchair,
      title: t('dashboard.warnings.awaitingTable.title'),
      lines: [
        t('dashboard.warnings.awaitingTable.body', {
          count: number(warnings.attendeesAwaitingTable),
        }),
      ],
      to: `${base}/layout`,
    })
  }

  const shares = computeRsvpBreakdown(metrics)
  const segmentLabel = (segment: RsvpSegment) =>
    t(`dashboard.rsvp.segments.${segment}`)

  // Both bars share one scale, wide enough for whichever figure is largest.
  const scale = Math.max(
    maxAttendees,
    metrics.confirmedAttendees,
    metrics.seatingCapacity,
  )
  const bars = [
    {
      id: 'confirmed',
      label: t('dashboard.capacity.confirmed'),
      value: metrics.confirmedAttendees,
      className:
        metrics.confirmedAttendees > maxAttendees
          ? styles.fillOver
          : styles.fillConfirmed,
    },
    {
      id: 'seating',
      label: t('dashboard.capacity.seating'),
      value: metrics.seatingCapacity,
      className: styles.fillSeating,
    },
  ]

  const quickActions = [
    { id: 'guests', to: `${base}/guests`, icon: Users, tone: 'info' },
    {
      id: 'messages',
      to: `${base}/messages`,
      icon: MessageCircle,
      tone: 'success',
    },
    { id: 'rsvp', to: `${base}/rsvp`, icon: Mail, tone: 'info' },
    { id: 'tables', to: `${base}/layout`, icon: Table2, tone: 'warning' },
  ] as const

  return (
    <div className={styles.page}>
      <ReadOnlyNotice />

      <KpiGrid label={t('dashboard.kpis.label')}>
        {kpis.map(({ id, value, icon: Icon, tone, hint }) => (
          <KpiCard
            key={id}
            label={t(`dashboard.kpis.${id}`)}
            value={number(value)}
            hint={hint}
            icon={<Icon />}
            tone={tone}
          />
        ))}
      </KpiGrid>

      <WarningCards label={t('dashboard.warnings.label')} warnings={shown} />

      <div className={styles.columns}>
        <Card
          title={t('dashboard.rsvp.title')}
          subtitle={t('dashboard.rsvp.subtitle')}
        >
          {metrics.totalGuests === 0 ? (
            <EmptyState
              icon={<Users />}
              title={t('dashboard.rsvp.emptyTitle')}
              description={t('dashboard.rsvp.emptyBody')}
              action={
                <ButtonLink to={`${base}/guests`} variant="secondary">
                  {t('dashboard.actions.guests.title')}
                </ButtonLink>
              }
            />
          ) : (
            <div className={styles.rsvp}>
              <RsvpDonut
                shares={shares}
                label={t('dashboard.rsvp.chartLabel', {
                  count: number(metrics.totalGuests),
                })}
                total={number(metrics.totalGuests)}
                totalLabel={t('dashboard.rsvp.guests')}
              />
              <table className={styles.legend}>
                <caption className="visually-hidden">
                  {t('dashboard.rsvp.title')}
                </caption>
                <thead className="visually-hidden">
                  <tr>
                    <th scope="col">{t('dashboard.rsvp.columns.status')}</th>
                    <th scope="col">{t('dashboard.rsvp.columns.guests')}</th>
                    <th scope="col">{t('dashboard.rsvp.columns.share')}</th>
                  </tr>
                </thead>
                <tbody>
                  {shares.map((share) => (
                    <tr key={share.segment}>
                      <th scope="row">
                        <span
                          className={cx(
                            styles.dot,
                            styles[`dot_${share.segment}`],
                          )}
                          aria-hidden="true"
                        />
                        {segmentLabel(share.segment)}
                      </th>
                      <td className={styles.legendCount}>
                        {number(share.count)}
                      </td>
                      <td className={styles.legendShare}>
                        {t('dashboard.rsvp.percent', {
                          percent: number(share.percent),
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card
          title={t('dashboard.capacity.title')}
          subtitle={t('dashboard.capacity.subtitle')}
        >
          <div className={styles.bars}>
            {bars.map((bar) => (
              <div key={bar.id}>
                <div className={styles.barLabels}>
                  <span>{bar.label}</span>
                  <LtrText>
                    {t('dashboard.capacity.ofMaximum', {
                      value: number(bar.value),
                      max: number(maxAttendees),
                    })}
                  </LtrText>
                </div>
                <div
                  className={styles.track}
                  role="progressbar"
                  aria-label={bar.label}
                  aria-valuemin={0}
                  aria-valuemax={scale}
                  aria-valuenow={bar.value}
                  aria-valuetext={t('dashboard.capacity.ofMaximum', {
                    value: number(bar.value),
                    max: number(maxAttendees),
                  })}
                >
                  <div
                    className={cx(styles.fill, bar.className)}
                    style={{ inlineSize: `${(bar.value / scale) * 100}%` }}
                  />
                  <span
                    className={styles.marker}
                    style={{
                      insetInlineStart: `${(maxAttendees / scale) * 100}%`,
                    }}
                    aria-hidden="true"
                  />
                </div>
              </div>
            ))}
            <p className={styles.barNote}>
              {t('dashboard.capacity.note', { max: number(maxAttendees) })}
            </p>
          </div>
        </Card>
      </div>

      <div className={styles.columns}>
        <Card
          title={t('dashboard.activity.title')}
          subtitle={t('dashboard.activity.subtitle')}
          actions={
            recentActivity.length > ACTIVITY_PREVIEW && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setActivityOpen(true)}
              >
                {t('dashboard.activity.viewAll')}
              </Button>
            )
          }
        >
          {recentActivity.length === 0 ? (
            <EmptyState
              icon={<History />}
              title={t('dashboard.activity.emptyTitle')}
              description={t('dashboard.activity.emptyBody')}
            />
          ) : (
            <ActivityList items={recentActivity.slice(0, ACTIVITY_PREVIEW)} />
          )}
        </Card>

        <Card
          title={t('dashboard.actions.title')}
          subtitle={t('dashboard.actions.subtitle')}
        >
          <ul className={styles.actions}>
            {quickActions.map(({ id, to, icon: Icon, tone }) => (
              <li key={id}>
                <Link to={to} className={styles.action}>
                  <span
                    className={cx(styles.actionIcon, styles[tone])}
                    aria-hidden="true"
                  >
                    <Icon />
                  </span>
                  <span className={styles.actionText}>
                    <span className={styles.actionTitle}>
                      {t(`dashboard.actions.${id}.title`)}
                    </span>
                    <span className={styles.actionBody}>
                      {t(`dashboard.actions.${id}.body`)}
                    </span>
                  </span>
                  <ChevronRight className={styles.chevron} aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Dialog
        open={activityOpen}
        onClose={() => setActivityOpen(false)}
        title={t('dashboard.activity.title')}
        scrollableContent
      >
        <ActivityList items={recentActivity} />
      </Dialog>
    </div>
  )
}

export function DashboardPage() {
  const { t } = useTranslation()
  const { eventId = '' } = useParams()
  // The layout has already loaded the event, so this read comes from the cache.
  const info = useEventAccessInfo(eventId)
  const dashboard = useDashboard(eventId)

  return (
    <>
      <PageHeader
        title={t('pages.dashboard')}
        subtitle={t('dashboard.subtitle')}
        actions={
          <ButtonLink
            to={`/events/${eventId}/settings`}
            variant="secondary"
            icon={<Settings />}
          >
            {t('nav.eventSettings')}
          </ButtonLink>
        }
      />
      {dashboard.isError ? (
        <Card>
          <ErrorState
            description={describeError(t, dashboard.error)}
            onRetry={() => void dashboard.refetch()}
          />
        </Card>
      ) : !dashboard.data || !info.data ? (
        <Card>
          <LoadingState />
        </Card>
      ) : (
        <DashboardContent
          eventId={eventId}
          info={info.data}
          data={dashboard.data}
        />
      )}
    </>
  )
}
