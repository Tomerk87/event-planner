import { CalendarCheck, FlaskConical } from 'lucide-react'
import type { FormEvent, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { LanguageSwitcher } from '../../app/shell/LanguageSwitcher.tsx'
import { Card } from '../../shared/ui/Card.tsx'
import { Notice } from '../../shared/ui/Notice.tsx'
import { useDocumentTitle } from '../../shared/useDocumentTitle.ts'
import styles from './AuthPage.module.css'

interface AuthPageProps {
  title: string
  subtitle: string
  /** Shown above the fields when the whole submission was refused. */
  failure?: string | null
  onSubmit: (event: FormEvent) => void
  children: ReactNode
  footer: ReactNode
}

/** The frame shared by the sign-in and sign-up pages. */
export function AuthPage({
  title,
  subtitle,
  failure,
  onSubmit,
  children,
  footer,
}: AuthPageProps) {
  const { t } = useTranslation()
  useDocumentTitle(title)

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link to="/" className={styles.logo}>
          <CalendarCheck aria-hidden="true" />
          <span>{t('app.name')}</span>
        </Link>
        <div className={styles.language}>
          <LanguageSwitcher tone="light" />
        </div>
      </header>
      <main id="main-content" tabIndex={-1} className={styles.main}>
        <div className={styles.panel}>
          <Card>
            <h1 className={styles.title}>{title}</h1>
            <p className={styles.subtitle}>{subtitle}</p>
            <form className={styles.form} noValidate onSubmit={onSubmit}>
              <Notice tone="warning" title={t('auth.prototype.title')}>
                {t('auth.prototype.body')}
              </Notice>
              {failure && <Notice tone="danger" title={failure} announce />}
              {children}
            </form>
          </Card>
          <div className={styles.footer}>{footer}</div>
        </div>
      </main>
    </div>
  )
}

/** "Or explore the demo" under either form. */
export function DemoLink({ onClick }: { onClick: () => void }) {
  const { t } = useTranslation()

  return (
    <button type="button" className={styles.demoLink} onClick={onClick}>
      <FlaskConical aria-hidden="true" />
      {t('auth.tryDemoInstead')}
    </button>
  )
}
