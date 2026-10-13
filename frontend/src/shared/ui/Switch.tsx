import type { InputHTMLAttributes } from 'react'
import styles from './Switch.module.css'

interface SwitchProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type' | 'role' | 'children'
> {
  label: string
  /** A short explanation under the label. */
  hint?: string
}

/** Turns one setting on or off. */
export function Switch({ label, hint, ...rest }: SwitchProps) {
  return (
    <label className={styles.switch}>
      <input type="checkbox" role="switch" className={styles.input} {...rest} />
      <span className={styles.track} aria-hidden="true" />
      <span className={styles.text}>
        <span className={styles.label}>{label}</span>
        {hint && <span className={styles.hint}>{hint}</span>}
      </span>
    </label>
  )
}
