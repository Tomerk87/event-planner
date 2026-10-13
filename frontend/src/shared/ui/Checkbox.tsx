import { useEffect, useRef, type InputHTMLAttributes } from 'react'
import styles from './Checkbox.module.css'
import { cx } from './cx.ts'

interface CheckboxProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type' | 'children'
> {
  label: string
  /** Keep the label for assistive technology only (a table's selection box). */
  hideLabel?: boolean
  /** Some, but not all, of what the box stands for is selected. */
  indeterminate?: boolean
}

export function Checkbox({
  label,
  hideLabel = false,
  indeterminate = false,
  className,
  ...rest
}: CheckboxProps) {
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (ref.current) {
      ref.current.indeterminate = indeterminate
    }
  }, [indeterminate])

  return (
    <label className={cx(styles.checkbox, className)}>
      <input ref={ref} type="checkbox" className={styles.input} {...rest} />
      <span className={hideLabel ? 'visually-hidden' : styles.label}>
        {label}
      </span>
    </label>
  )
}
