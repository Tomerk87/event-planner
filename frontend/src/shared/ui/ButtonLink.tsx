import type { ReactNode } from 'react'
import { Link } from 'react-router'
import styles from './Button.module.css'
import { cx } from './cx.ts'

interface ButtonLinkProps {
  to: string
  variant?: 'primary' | 'secondary' | 'soft'
  size?: 'md' | 'lg'
  icon?: ReactNode
  iconPosition?: 'start' | 'end'
  /** A fuller accessible name, when several links share the same text. */
  label?: string
  children: ReactNode
}

/** A navigation link with the appearance of a button. */
export function ButtonLink({
  to,
  variant = 'primary',
  size = 'md',
  icon,
  iconPosition = 'start',
  label,
  children,
}: ButtonLinkProps) {
  const iconElement = icon && (
    <span className={styles.icon} aria-hidden="true">
      {icon}
    </span>
  )

  return (
    <Link
      to={to}
      aria-label={label}
      className={cx(
        styles.button,
        styles.link,
        styles[variant],
        size === 'lg' && styles.lg,
      )}
    >
      {iconPosition === 'start' && iconElement}
      <span>{children}</span>
      {iconPosition === 'end' && iconElement}
    </Link>
  )
}
