import type { ReactNode } from 'react'
import { Link } from 'react-router'
import styles from './Button.module.css'
import { cx } from './cx.ts'

interface ButtonLinkProps {
  to: string
  variant?: 'primary' | 'secondary'
  icon?: ReactNode
  children: ReactNode
}

/** A navigation link with the appearance of a button. */
export function ButtonLink({
  to,
  variant = 'primary',
  icon,
  children,
}: ButtonLinkProps) {
  return (
    <Link to={to} className={cx(styles.button, styles.link, styles[variant])}>
      {icon && (
        <span className={styles.icon} aria-hidden="true">
          {icon}
        </span>
      )}
      <span>{children}</span>
    </Link>
  )
}
