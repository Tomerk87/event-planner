import { CircleCheck, Info, TriangleAlert } from 'lucide-react'
import type { ReactNode } from 'react'
import { cx } from './cx.ts'
import styles from './Notice.module.css'

type NoticeTone = 'info' | 'success' | 'warning' | 'danger'

interface NoticeProps {
  tone?: NoticeTone
  title: string
  children?: ReactNode
  action?: ReactNode
  /** Announce to assistive technology when the notice appears. */
  announce?: boolean
}

const icons = {
  info: Info,
  success: CircleCheck,
  warning: TriangleAlert,
  danger: TriangleAlert,
} as const

export function Notice({
  tone = 'info',
  title,
  children,
  action,
  announce = false,
}: NoticeProps) {
  const Icon = icons[tone]
  const role = announce ? (tone === 'danger' ? 'alert' : 'status') : undefined

  return (
    <div className={cx(styles.notice, styles[tone])} role={role}>
      <Icon className={styles.icon} aria-hidden="true" />
      <div className={styles.content}>
        <p className={styles.title}>{title}</p>
        {children && <div className={styles.body}>{children}</div>}
      </div>
      {action && <div className={styles.action}>{action}</div>}
    </div>
  )
}
