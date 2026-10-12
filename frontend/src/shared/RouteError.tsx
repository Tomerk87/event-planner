import { ArrowLeft } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import styles from './StandalonePage.module.css'
import { useDocumentTitle } from './useDocumentTitle.ts'
import { ButtonLink } from './ui/ButtonLink.tsx'
import { Card } from './ui/Card.tsx'
import { ErrorState } from './ui/States.tsx'

export function RouteError() {
  const { t } = useTranslation()
  useDocumentTitle(t('routeError.title'))

  return (
    <main id="main-content" tabIndex={-1} className={styles.page}>
      <div className={styles.panel}>
        <Card>
          <ErrorState
            asPageHeading
            title={t('routeError.title')}
            description={t('routeError.body')}
          />
          <p className={styles.centered}>
            <ButtonLink to="/" variant="secondary" icon={<ArrowLeft />}>
              {t('nav.backToMyEvents')}
            </ButtonLink>
          </p>
        </Card>
      </div>
    </main>
  )
}
