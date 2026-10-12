import { ArrowLeft } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Outlet, useParams } from 'react-router'
import { AppShell } from './shell/AppShell.tsx'
import { getEventNavItems } from './shell/eventNav.ts'

export function EventLayout() {
  const { t } = useTranslation()
  const { eventId = '' } = useParams()

  return (
    <AppShell
      navLabel={t('nav.event')}
      navItems={getEventNavItems(t, eventId)}
      footerLink={{
        to: '/',
        label: t('nav.backToMyEvents'),
        icon: ArrowLeft,
        directional: true,
        exact: true,
      }}
    >
      <Outlet />
    </AppShell>
  )
}
