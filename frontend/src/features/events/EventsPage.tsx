import { useTranslation } from 'react-i18next'
import { PlaceholderPage } from '../../shared/PlaceholderPage.tsx'

export function EventsPage() {
  const { t } = useTranslation()

  return <PlaceholderPage title={t('pages.events')} />
}
