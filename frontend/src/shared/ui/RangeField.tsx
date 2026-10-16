import { useId } from 'react'
import styles from './RangeField.module.css'

/**
 * A labelled slider showing its value, such as "40%" or "90°". It runs left
 * to right in every language, because what it changes, a picture, is not
 * mirrored.
 */
export function RangeField({
  label,
  min,
  max,
  step,
  value,
  unit = '%',
  disabled = false,
  onChange,
}: {
  label: string
  min: number
  max: number
  step: number
  value: number
  unit?: string
  disabled?: boolean
  onChange: (value: number) => void
}) {
  const id = useId()
  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      <div className={styles.slider}>
        <input
          id={id}
          type="range"
          dir="ltr"
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          value={value}
          aria-valuetext={`${value}${unit}`}
          onChange={(change) => onChange(Number(change.target.value))}
        />
        <output htmlFor={id} dir="ltr">
          {value}
          {unit}
        </output>
      </div>
    </div>
  )
}
