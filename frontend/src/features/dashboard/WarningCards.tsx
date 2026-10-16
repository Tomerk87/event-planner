import { ChevronRight, type LucideIcon } from 'lucide-react'
import type { CSSProperties } from 'react'
import { Link } from 'react-router'
import { cx } from '../../shared/ui/cx.ts'
import styles from './WarningCards.module.css'

export type WarningTone = 'danger' | 'warning' | 'info' | 'success'

export interface Warning {
  id: string
  tone: WarningTone
  icon: LucideIcon
  title: string
  lines: string[]
  /** Where the card leads; a card without it only informs. */
  to?: string
}

function WarningCard({ warning }: { warning: Warning }) {
  const Icon = warning.icon
  const content = (
    <>
      <Icon className={styles.warningIcon} aria-hidden="true" />
      <span className={styles.warningText}>
        <span className={styles.warningTitle}>{warning.title}</span>
        {warning.lines.map((line) => (
          <span key={line} className={styles.warningLine}>
            {line}
          </span>
        ))}
      </span>
    </>
  )
  const className = cx(styles.warningCard, styles[warning.tone])

  return (
    <li>
      {warning.to ? (
        <Link to={warning.to} className={className}>
          {content}
          <ChevronRight className={styles.chevron} aria-hidden="true" />
        </Link>
      ) : (
        <div className={className}>{content}</div>
      )}
    </li>
  )
}

/**
 * Notices that need attention, each in a card of its own, as the Dashboard
 * shows them; Event Layout uses the same cards (owner, 2026-10-16).
 */
export function WarningCards({
  label,
  warnings,
  slots,
}: {
  label: string
  warnings: readonly Warning[]
  /** Cards a row has room for, when fewer are shown than elsewhere. */
  slots?: number
}) {
  if (warnings.length === 0) {
    return null
  }
  return (
    <ul
      className={cx(styles.warnings, slots ? styles.slotted : undefined)}
      style={slots ? ({ '--slots': slots } as CSSProperties) : undefined}
      aria-label={label}
    >
      {warnings.map((warning) => (
        <WarningCard key={warning.id} warning={warning} />
      ))}
    </ul>
  )
}
