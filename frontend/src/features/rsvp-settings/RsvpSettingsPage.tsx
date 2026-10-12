import { useTranslation } from 'react-i18next'
import { PlaceholderPage } from '../../shared/PlaceholderPage.tsx'

export function RsvpSettingsPage() {
  const { t } = useTranslation()

  return <PlaceholderPage title={t('pages.rsvpSettings')} />
}
