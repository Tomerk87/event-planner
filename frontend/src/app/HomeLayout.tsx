import { CalendarDays } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Outlet } from 'react-router'
import { useCurrentUser } from '../services/queries.ts'
import { AppShell } from './shell/AppShell.tsx'
import { useSignOut } from './session/useSignOut.ts'
import { DemoBadge, DemoTools } from './shell/DemoControls.tsx'

export function HomeLayout() {
  const { t } = useTranslation()
  const user = useCurrentUser()
  const signOut = useSignOut()

  return (
    <AppShell
      navLabel={t('nav.main')}
      navItems={[
        {
          to: '/events',
          label: t('nav.myEvents'),
          icon: CalendarDays,
          exact: true,
        },
      ]}
      user={user.data && { name: user.data.name }}
      onSignOut={signOut}
      signOutInSidebar
      banner={<DemoBadge />}
      tools={<DemoTools />}
    >
      <Outlet />
    </AppShell>
  )
}
