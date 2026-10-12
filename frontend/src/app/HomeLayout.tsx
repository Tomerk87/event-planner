import { CalendarDays } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Outlet } from 'react-router'
import { useCurrentUser } from '../services/queries.ts'
import { AppShell } from './shell/AppShell.tsx'
import { DemoBadge, DemoTools } from './shell/DemoControls.tsx'

export function HomeLayout() {
  const { t } = useTranslation()
  const user = useCurrentUser()

  return (
    <AppShell
      navLabel={t('nav.main')}
      navItems={[
        {
          to: '/',
          label: t('nav.myEvents'),
          icon: CalendarDays,
          exact: true,
        },
      ]}
      user={user.data && { name: user.data.name }}
      banner={<DemoBadge />}
      tools={<DemoTools />}
    >
      <Outlet />
    </AppShell>
  )
}
