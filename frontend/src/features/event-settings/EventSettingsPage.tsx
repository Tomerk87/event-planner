import { useTranslation } from 'react-i18next'
import { PlaceholderPage } from '../../shared/PlaceholderPage.tsx'

export function EventSettingsPage() {
  const { t } = useTranslation()

  return <PlaceholderPage title={t('pages.eventSettings')} />
}
