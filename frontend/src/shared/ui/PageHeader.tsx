import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useDocumentTitle } from '../useDocumentTitle.ts'
import { DESKTOP_QUERY, useMediaQuery } from '../useMediaQuery.ts'
import { BottomActionBar } from './BottomActionBar.tsx'
import styles from './PageHeader.module.css'

interface PageHeaderProps {
  title: string
  subtitle?: string
  actions?: ReactNode
  /**
   * Where the actions go below the desktop width. Form pages that are saved
   * use `bar`, which pins them to the bottom of the screen; `inline` keeps
   * them under the title.
   */
  compactActions?: 'inline' | 'bar'
}

export function PageHeader({
  title,
  subtitle,
  actions,
  compactActions = 'inline',
}: PageHeaderProps) {
  const { t } = useTranslation()
  const isDesktop = useMediaQuery(DESKTOP_QUERY)
  const actionsInBar = compactActions === 'bar' && !isDesktop
  useDocumentTitle(title)

  return (
    <>
      <header className={styles.header}>
        <div className={styles.text}>
          <h1 className={styles.title}>{title}</h1>
          {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
        </div>
        {actions && !actionsInBar && (
          <div className={styles.actions}>{actions}</div>
        )}
      </header>
      {actions && actionsInBar && (
        <BottomActionBar label={t('common.pageActions')}>
          {actions}
        </BottomActionBar>
      )}
    </>
  )
}
