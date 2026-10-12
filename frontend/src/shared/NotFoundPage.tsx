import { ArrowLeft, SearchX } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import styles from './StandalonePage.module.css'
import { ButtonLink } from './ui/ButtonLink.tsx'
import { Card } from './ui/Card.tsx'
import { EmptyState } from './ui/States.tsx'

export function NotFoundPage() {
  const { t } = useTranslation()

  return (
    <main className={styles.page}>
      <div className={styles.panel}>
        <h1>{t('notFound.title')}</h1>
        <Card>
          <EmptyState
            icon={<SearchX />}
            title={t('notFound.body')}
            action={
              <ButtonLink to="/" icon={<ArrowLeft />}>
                {t('nav.backToMyEvents')}
              </ButtonLink>
            }
          />
        </Card>
      </div>
    </main>
  )
}
