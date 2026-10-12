import { ChevronDown } from 'lucide-react'
import {
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'
import { useTranslation } from 'react-i18next'
import { cx } from './cx.ts'
import styles from './Field.module.css'

interface FieldCommonProps {
  label: string
  hint?: string
  error?: string
  hideLabel?: boolean
}

interface ControlAria {
  id: string
  'aria-describedby': string | undefined
  'aria-invalid': true | undefined
}

interface FieldShellProps extends FieldCommonProps {
  required: boolean | undefined
  trailing?: ReactNode
  children: (aria: ControlAria) => ReactNode
}

function FieldShell({
  label,
  hint,
  error,
  hideLabel = false,
  required,
  trailing,
  children,
}: FieldShellProps) {
  const { t } = useTranslation()
  const id = useId()
  const hintId = `${id}-hint`
  const errorId = `${id}-error`
  const describedBy =
    [hint && hintId, error && errorId].filter(Boolean).join(' ') || undefined

  return (
    <div className={styles.field}>
      <div className={cx(styles.labelRow, hideLabel && 'visually-hidden')}>
        <label htmlFor={id} className={styles.label}>
          {label}
          {required && (
            <>
              <span className={styles.required} aria-hidden="true">
                {' *'}
              </span>
              <span className="visually-hidden">
                {` (${t('common.required')})`}
              </span>
            </>
          )}
        </label>
        {trailing}
      </div>
      {children({
        id,
        'aria-describedby': describedBy,
        'aria-invalid': error ? true : undefined,
      })}
      {hint && (
        <p id={hintId} className={styles.hint}>
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className={styles.error}>
          {error}
        </p>
      )}
    </div>
  )
}

type TextFieldProps = FieldCommonProps &
  Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> & { icon?: ReactNode }

export function TextField({
  label,
  hint,
  error,
  hideLabel,
  icon,
  className,
  ...rest
}: TextFieldProps) {
  return (
    <FieldShell
      label={label}
      hint={hint}
      error={error}
      hideLabel={hideLabel}
      required={rest.required}
    >
      {(aria) => (
        <div className={styles.control}>
          {icon && (
            <span className={styles.leadingIcon} aria-hidden="true">
              {icon}
            </span>
          )}
          <input
            className={cx(
              styles.input,
              icon ? styles.withLeadingIcon : undefined,
              className,
            )}
            {...aria}
            {...rest}
          />
        </div>
      )}
    </FieldShell>
  )
}

type TextAreaProps = FieldCommonProps &
  Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'>

export function TextArea({
  label,
  hint,
  error,
  hideLabel,
  className,
  ...rest
}: TextAreaProps) {
  const { t } = useTranslation()
  const length = typeof rest.value === 'string' ? rest.value.length : undefined
  const counter =
    rest.maxLength !== undefined && length !== undefined ? (
      <span className={styles.counter}>
        {t('common.characterCount', { count: length, max: rest.maxLength })}
      </span>
    ) : undefined

  return (
    <FieldShell
      label={label}
      hint={hint}
      error={error}
      hideLabel={hideLabel}
      required={rest.required}
      trailing={counter}
    >
      {(aria) => (
        <textarea
          className={cx(styles.input, styles.textarea, className)}
          {...aria}
          {...rest}
        />
      )}
    </FieldShell>
  )
}

type SelectFieldProps = FieldCommonProps &
  Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id'> & { icon?: ReactNode }

export function SelectField({
  label,
  hint,
  error,
  hideLabel,
  icon,
  className,
  children,
  ...rest
}: SelectFieldProps) {
  return (
    <FieldShell
      label={label}
      hint={hint}
      error={error}
      hideLabel={hideLabel}
      required={rest.required}
    >
      {(aria) => (
        <div className={styles.control}>
          {icon && (
            <span className={styles.leadingIcon} aria-hidden="true">
              {icon}
            </span>
          )}
          <select
            className={cx(
              styles.input,
              styles.select,
              icon ? styles.withLeadingIcon : undefined,
              className,
            )}
            {...aria}
            {...rest}
          >
            {children}
          </select>
          <ChevronDown className={styles.chevron} aria-hidden="true" />
        </div>
      )}
    </FieldShell>
  )
}
