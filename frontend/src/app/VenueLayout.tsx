import { CalendarDays, Map as MapIcon, Settings, Users } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Outlet, useParams } from 'react-router'
import { isDomainError } from '../domain/errors.ts'
import { venueCan } from '../domain/venues.ts'
import {
  useVenueWorkspace,
  useVenueWorkspaces,
} from '../features/venues/venueQueries.ts'
import { useCurrentUser, useSidebarCollapsed } from '../services/queries.ts'
import { useServices } from '../services/servicesContext.ts'
import { describeError } from '../shared/errorMessage.ts'
import { NotFoundPage } from '../shared/NotFoundPage.tsx'
import { Card } from '../shared/ui/Card.tsx'
import { ErrorState, LoadingState } from '../shared/ui/States.tsx'
import { NotificationBell } from './notifications/NotificationBell.tsx'
import { useSignOut } from './session/useSignOut.ts'
import { AppShell } from './shell/AppShell.tsx'
import { DemoBadge, DemoTools } from './shell/DemoControls.tsx'

/**
 * The frame of a venue's pages (V2.2): the workspace switcher and the venue's
 * own navigation. A venue the user does not belong to, or any venue while the
 * deployment has none, is not found.
 */
export function VenueLayout() {
  const { t } = useTranslation()
  const { organizationId = '' } = useParams()
  const { venues } = useServices()
  const workspace = useVenueWorkspace(organizationId)
  const workspaces = useVenueWorkspaces()
  const user = useCurrentUser()
  const signOut = useSignOut()
  const sidebar = useSidebarCollapsed()

  if (venues === null || isDomainError(workspace.error, 'NOT_FOUND')) {
    return <NotFoundPage />
  }

  const base = `/venues/${organizationId}`
  return (
    <AppShell
      collapsed={sidebar.collapsed}
      onToggleCollapsed={sidebar.toggle}
      navLabel={t('venueNav.label')}
      workspaces={{
        currentVenueId: organizationId,
        workspaces: workspaces.data ?? [],
      }}
      navItems={[
        { to: `${base}/events`, label: t('nav.myEvents'), icon: CalendarDays },
        { to: `${base}/spaces`, label: t('venueNav.spaces'), icon: MapIcon },
        { to: `${base}/team`, label: t('venueNav.team'), icon: Users },
        // Settings are the Owner's; a Manager does not see them (D112).
        ...(venueCan(workspace.data?.role ?? null, 'MANAGE_SETTINGS')
          ? [
              {
                to: `${base}/settings`,
                label: t('venueNav.settings'),
                icon: Settings,
              },
            ]
          : []),
      ]}
      user={user.data && { name: user.data.name }}
      onSignOut={signOut}
      signOutInSidebar
      banner={<DemoBadge />}
      bell={<NotificationBell />}
      tools={<DemoTools />}
    >
      {workspace.isPending ? (
        <Card>
          <h1 className="visually-hidden">{t('common.loading')}</h1>
          <LoadingState />
        </Card>
      ) : workspace.isError ? (
        <Card>
          <ErrorState
            asPageHeading
            description={describeError(t, workspace.error)}
            onRetry={() => void workspace.refetch()}
          />
        </Card>
      ) : (
        <Outlet />
      )}
    </AppShell>
  )
}
