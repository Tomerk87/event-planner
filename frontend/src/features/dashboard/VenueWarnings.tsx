import { CircleCheck, TriangleAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useFormatters } from '../../i18n/format.ts'
import { Badge } from '../../shared/ui/Badge.tsx'
import { ButtonLink } from '../../shared/ui/ButtonLink.tsx'
import { cx } from '../../shared/ui/cx.ts'
import type { Warning } from './WarningCards.tsx'
import styles from './VenueWarnings.module.css'

/** A warning for the venue, with the place it can act on it (#19). */
export interface VenueWarning extends Warning {
  help?: string
  action?: { label: string; to: string; icon: React.ReactNode }
}

/**
 * The venue's warnings on a venue event's Dashboard (mockup #19), in one
 * section: the client's status, tables over capacity, people without a table.
 */
export function VenueWarnings({ warnings }: { warnings: VenueWarning[] }) {
  const { t } = useTranslation()
  const format = useFormatters()
  return (
    <section className={styles.section} aria-labelledby="venue-warnings">
      <header className={styles.header}>
        <span
          className={cx(
            styles.headerIcon,
            warnings.length === 0 && styles.headerIconOk,
          )}
          aria-hidden="true"
        >
          {warnings.length === 0 ? <CircleCheck /> : <TriangleAlert />}
        </span>
        <div>
          <h2 id="venue-warnings" className={styles.title}>
            {t('venueDashboard.warnings.title')}
            {warnings.length > 0 && (
              <Badge tone="warning">
                {t('venueDashboard.warnings.count', {
                  count: warnings.length,
                  formatted: format.number(warnings.length),
                })}
              </Badge>
            )}
          </h2>
          <p className={styles.muted}>
            {warnings.length === 0
              ? t('venueDashboard.warnings.noneBody')
              : t('venueDashboard.warnings.subtitle')}
          </p>
        </div>
      </header>
      {warnings.length > 0 && (
        <ul className={styles.list}>
          {warnings.map((warning) => {
            const Icon = warning.icon
            return (
              <li
                key={warning.id}
                className={cx(styles.item, styles[warning.tone])}
              >
                <Icon className={styles.icon} aria-hidden="true" />
                <div className={styles.text}>
                  <p className={styles.itemTitle}>{warning.title}</p>
                  {warning.lines.map((line) => (
                    <p key={line}>{line}</p>
                  ))}
                  {warning.help && (
                    <p className={styles.help}>{warning.help}</p>
                  )}
                  {warning.action && (
                    <ButtonLink
                      to={warning.action.to}
                      variant="secondary"
                      icon={warning.action.icon}
                    >
                      {warning.action.label}
                    </ButtonLink>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
