import type { ReactNode } from 'react'
import styles from './Badge.module.css'
import { cx } from './cx.ts'

export type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral'

interface BadgeProps {
  tone?: Tone
  icon?: ReactNode
  children: ReactNode
}

export function Badge({ tone = 'neutral', icon, children }: BadgeProps) {
  return (
    <span className={cx(styles.badge, styles[tone])}>
      {icon && (
        <span className={styles.icon} aria-hidden="true">
          {icon}
        </span>
      )}
      {children}
    </span>
  )
}
