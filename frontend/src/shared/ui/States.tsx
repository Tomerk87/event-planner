import { LoaderCircle, TriangleAlert } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from './Button.tsx'
import styles from './States.module.css'

interface EmptyStateProps {
  icon: ReactNode
  title: string
  description?: string
  action?: ReactNode
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <div className={styles.state}>
      <span className={styles.icon} aria-hidden="true">
        {icon}
      </span>
      <p className={styles.title}>{title}</p>
      {description && <p className={styles.description}>{description}</p>}
      {action}
    </div>
  )
}

export function LoadingState({ label }: { label?: string }) {
  const { t } = useTranslation()

  return (
    <div className={styles.state} role="status">
      <LoaderCircle className={styles.spinner} aria-hidden="true" />
      <p className={styles.description}>{label ?? t('common.loading')}</p>
    </div>
  )
}

interface ErrorStateProps {
  title?: string
  description?: string
  onRetry?: () => void
}

export function ErrorState({ title, description, onRetry }: ErrorStateProps) {
  const { t } = useTranslation()

  return (
    <div className={styles.state} role="alert">
      <span className={`${styles.icon} ${styles.danger}`} aria-hidden="true">
        <TriangleAlert />
      </span>
      <p className={styles.title}>{title ?? t('states.errorTitle')}</p>
      <p className={styles.description}>
        {description ?? t('states.errorBody')}
      </p>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          {t('common.retry')}
        </Button>
      )}
    </div>
  )
}
