import { ArrowLeft } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Outlet, useParams } from 'react-router'
import type { EventAccess } from '../domain/access.ts'
import { isDomainError } from '../domain/errors.ts'
import { isVenueSide } from '../domain/roles.ts'
import { useVenueEvents } from '../features/venues/venueQueries.ts'
import {
  useCurrentUser,
  useEventAccessInfo,
  useEvents,
  useSidebarCollapsed,
} from '../services/queries.ts'
import { EventAccessContext } from '../shared/access/eventAccessContext.ts'
import { describeError } from '../shared/errorMessage.ts'
import { NotFoundPage } from '../shared/NotFoundPage.tsx'
import { Card } from '../shared/ui/Card.tsx'
import { ErrorState, LoadingState } from '../shared/ui/States.tsx'
import { AppShell } from './shell/AppShell.tsx'
import { useSignOut } from './session/useSignOut.ts'
import { EmailVerificationNotice } from './shell/EmailVerificationNotice.tsx'
import { DemoBadge, DemoTools, DemoViewBanner } from './shell/DemoControls.tsx'
import { getEventNavItems } from './shell/eventNav.ts'
import { NotificationBell } from './notifications/NotificationBell.tsx'

export function EventLayout() {
  const { t } = useTranslation()
  const { eventId = '' } = useParams()
  const user = useCurrentUser()
  const events = useEvents()
  const info = useEventAccessInfo(eventId)
  const signOut = useSignOut()
  const sidebar = useSidebarCollapsed()
  const role = info.data?.role
  const isPastEvent = info.data?.isPast
  // The venue's side of a venue event moves among the venue's events (#15).
  const venue = info.data?.venue ?? null
  const venueSide = venue !== null && isVenueSide(role ?? null)
  const venueEvents = useVenueEvents(venueSide ? venue.organizationId : '')
  const selectable = venueSide
    ? venueEvents.data?.map(({ event }) => event)
    : events.data?.map(({ event }) => event)
  const access = useMemo<EventAccess | null>(
    () =>
      role === undefined || isPastEvent === undefined
        ? null
        : { role, isPastEvent },
    [role, isPastEvent],
  )

  if (isDomainError(info.error, 'NOT_FOUND')) {
    return <NotFoundPage />
  }

  return (
    <AppShell
      collapsed={sidebar.collapsed}
      onToggleCollapsed={sidebar.toggle}
      navLabel={t('nav.event')}
      navItems={getEventNavItems(t, eventId, role)}
      footerLink={{
        to: venueSide ? `/venues/${venue.organizationId}/events` : '/events',
        label: t('nav.backToMyEvents'),
        icon: ArrowLeft,
        directional: true,
        exact: true,
      }}
      event={
        info.data && {
          id: info.data.event.id,
          name: info.data.event.name,
          coverImage: info.data.event.coverImage,
          subtitle:
            venue === null
              ? undefined
              : venueSide
                ? venue.space.name
                : t('events.card.managedBy', { venue: venue.name }),
        }
      }
      events={selectable?.map((event) => ({
        id: event.id,
        name: event.name,
        coverImage: event.coverImage,
      }))}
      user={user.data && { name: user.data.name, role }}
      onSignOut={signOut}
      banner={<DemoBadge />}
      notice={
        <>
          <EmailVerificationNotice />
          <DemoViewBanner onVenuePage={venue !== null} />
        </>
      }
      bell={<NotificationBell />}
      tools={<DemoTools showRole={venue === null} />}
    >
      {info.isPending ? (
        <Card>
          <h1 className="visually-hidden">{t('common.loading')}</h1>
          <LoadingState />
        </Card>
      ) : info.isError ? (
        <Card>
          <ErrorState
            asPageHeading
            description={describeError(t, info.error)}
            onRetry={() => void info.refetch()}
          />
        </Card>
      ) : (
        <EventAccessContext.Provider value={access}>
          <Outlet />
        </EventAccessContext.Provider>
      )}
    </AppShell>
  )
}
