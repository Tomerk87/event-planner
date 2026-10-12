import { ArrowLeft } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import styles from './StandalonePage.module.css'
import { ButtonLink } from './ui/ButtonLink.tsx'
import { Card } from './ui/Card.tsx'
import { ErrorState } from './ui/States.tsx'

export function RouteError() {
  const { t } = useTranslation()

  return (
    <main className={styles.page}>
      <div className={styles.panel}>
        <Card>
          <ErrorState
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
