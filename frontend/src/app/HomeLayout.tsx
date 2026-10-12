import { CalendarDays } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Outlet } from 'react-router'
import { AppShell } from './shell/AppShell.tsx'

export function HomeLayout() {
  const { t } = useTranslation()

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
    >
      <Outlet />
    </AppShell>
  )
}
