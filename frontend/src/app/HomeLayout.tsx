import { CalendarDays, Server } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Outlet } from 'react-router'
import { useCurrentUser, useSidebarCollapsed } from '../services/queries.ts'
import { useSession } from './session/sessionContext.ts'
import { AppShell } from './shell/AppShell.tsx'
import { useSignOut } from './session/useSignOut.ts'
import { EmailVerificationNotice } from './shell/EmailVerificationNotice.tsx'
import { DemoBadge, DemoTools } from './shell/DemoControls.tsx'
import { NotificationBell } from './notifications/NotificationBell.tsx'

export function HomeLayout() {
  const { t } = useTranslation()
  const user = useCurrentUser()
  const signOut = useSignOut()
  const sidebar = useSidebarCollapsed()
  const { session } = useSession()
  // The System page is for Super Users of real accounts (D91).
  const showSystem =
    session?.workspace === 'account' && user.data?.isSuperUser === true

  return (
    <AppShell
      collapsed={sidebar.collapsed}
      onToggleCollapsed={sidebar.toggle}
      navLabel={t('nav.main')}
      navItems={[
        {
          to: '/events',
          label: t('nav.myEvents'),
          icon: CalendarDays,
          exact: true,
        },
        ...(showSystem
          ? [{ to: '/system', label: t('nav.system'), icon: Server }]
          : []),
      ]}
      user={user.data && { name: user.data.name }}
      onSignOut={signOut}
      signOutInSidebar
      banner={<DemoBadge />}
      notice={<EmailVerificationNotice />}
      bell={<NotificationBell />}
      tools={<DemoTools />}
    >
      <Outlet />
    </AppShell>
  )
}
