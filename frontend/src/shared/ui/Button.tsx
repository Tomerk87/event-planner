import { LoaderCircle } from 'lucide-react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import styles from './Button.module.css'
import { cx } from './cx.ts'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
type ButtonSize = 'md' | 'sm' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  icon?: ReactNode
  iconPosition?: 'start' | 'end'
  loading?: boolean
  fullWidth?: boolean
}

export function Button({
  variant = 'primary',
  size = 'md',
  icon,
  iconPosition = 'start',
  loading = false,
  fullWidth = false,
  type = 'button',
  disabled,
  className,
  children,
  ...rest
}: ButtonProps) {
  const iconElement = icon && (
    <span
      className={cx(styles.icon, iconPosition === 'end' && styles.directional)}
      aria-hidden="true"
    >
      {icon}
    </span>
  )

  return (
    <button
      type={type}
      className={cx(
        styles.button,
        styles[variant],
        styles[size],
        fullWidth && styles.fullWidth,
        className,
      )}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? (
        <LoaderCircle className={styles.spinner} aria-hidden="true" />
      ) : (
        iconPosition === 'start' && iconElement
      )}
      <span>{children}</span>
      {!loading && iconPosition === 'end' && iconElement}
    </button>
  )
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string
  variant?: 'secondary' | 'ghost' | 'danger'
  children: ReactNode
}

export function IconButton({
  label,
  variant = 'secondary',
  type = 'button',
  className,
  children,
  ...rest
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cx(styles.button, styles.iconOnly, styles[variant], className)}
      {...rest}
    >
      <span className={styles.icon} aria-hidden="true">
        {children}
      </span>
    </button>
  )
}
