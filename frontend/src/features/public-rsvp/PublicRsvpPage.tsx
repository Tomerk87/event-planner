import { Clock } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import styles from '../../shared/StandalonePage.module.css'
import { Card } from '../../shared/ui/Card.tsx'
import { EmptyState } from '../../shared/ui/States.tsx'
import { useDocumentTitle } from '../../shared/useDocumentTitle.ts'

export function PublicRsvpPage() {
  const { t } = useTranslation()
  useDocumentTitle(t('pages.publicRsvp'))

  return (
    <main id="main-content" tabIndex={-1} className={styles.page}>
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
