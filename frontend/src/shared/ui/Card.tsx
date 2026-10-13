import type { ReactNode } from 'react'
import type { Tone } from './Badge.tsx'
import styles from './Card.module.css'
import { cx } from './cx.ts'

interface CardProps {
  title?: string
  subtitle?: string
  actions?: ReactNode
  children: ReactNode
}

export function Card({ title, subtitle, actions, children }: CardProps) {
  return (
    <section className={styles.card}>
      {(title || actions) && (
        <header className={styles.header}>
          <div>
            {title && <h2 className={styles.title}>{title}</h2>}
            {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
          </div>
          {actions}
        </header>
      )}
      {children}
    </section>
  )
}

/** Lays out KPI cards: two per row on a phone, one row on wide screens. */
export function KpiGrid({
  label,
  dense = false,
  children,
}: {
  label: string
  /** Narrower cards, for a strip of six or more that should stay on one row. */
  dense?: boolean
  children: ReactNode
}) {
  return (
    <section
      aria-label={label}
      className={cx(styles.kpiGrid, dense && styles.kpiGridDense)}
    >
      {children}
    </section>
  )
}

interface KpiCardProps {
  label: string
  value: ReactNode
  icon: ReactNode
  tone?: Tone
  /** What the figure counts, when the label alone could be misread. */
  hint?: string
}

export function KpiCard({
  label,
  value,
  icon,
  tone = 'info',
  hint,
}: KpiCardProps) {
  return (
    <div className={cx(styles.card, styles.kpi)}>
      <div>
        <p className={styles.kpiLabel}>{label}</p>
        <p className={styles.kpiValue}>{value}</p>
        {hint && <p className={styles.kpiHint}>{hint}</p>}
      </div>
      <span className={cx(styles.kpiIcon, styles[tone])} aria-hidden="true">
        {icon}
      </span>
    </div>
  )
}
