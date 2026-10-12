import { Clock } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import styles from '../../shared/StandalonePage.module.css'
import { Card } from '../../shared/ui/Card.tsx'
import { EmptyState } from '../../shared/ui/States.tsx'

export function PublicRsvpPage() {
  const { t } = useTranslation()

  return (
    <main className={styles.page}>
      <div className={styles.panel}>
        <h1>{t('pages.publicRsvp')}</h1>
        <Card>
          <EmptyState
            icon={<Clock />}
            title={t('placeholder.title')}
            description={t('placeholder.body')}
          />
        </Card>
      </div>
    </main>
  )
}
