import {
  Children,
  isValidElement,
  useId,
  useState,
  type InputHTMLAttributes,
  type OptionHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from 'react'
import { useTranslation } from 'react-i18next'
import { cx } from './cx.ts'
import styles from './Field.module.css'
import { Select, type SelectOption } from './Select.tsx'

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
            <span className={styles.required} aria-hidden="true">
              {' *'}
            </span>
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

interface SelectFieldProps extends FieldCommonProps {
  /** The chosen value; leave out, with `defaultValue`, to let the field keep it. */
  value?: string
  defaultValue?: string
  /** Called with the chosen value, in the shape of a form control's event. */
  onChange?: (event: { target: { value: string } }) => void
  required?: boolean
  disabled?: boolean
  icon?: ReactNode
  /** Styles the button that shows the current choice. */
  className?: string
  /** The choices, written as `<option>` elements. */
  children: ReactNode
}

function textOf(node: ReactNode): string {
  return Children.toArray(node)
    .map((part) =>
      typeof part === 'string' || typeof part === 'number' ? String(part) : '',
    )
    .join('')
}

/** Reads `<option>` elements, however they are nested in lists or fragments. */
function toOptions(children: ReactNode): SelectOption[] {
  return Children.toArray(children).flatMap((child): SelectOption[] => {
    if (!isValidElement<OptionHTMLAttributes<HTMLOptionElement>>(child)) {
      return []
    }
    if (child.type !== 'option') {
      return toOptions(child.props.children)
    }
    const label = textOf(child.props.children)
    return [
      {
        value: String(child.props.value ?? label),
        label,
        disabled: child.props.disabled,
        lang: child.props.lang,
      },
    ]
  })
}

export function SelectField({
  label,
  hint,
  error,
  hideLabel,
  icon,
  className,
  children,
  value,
  defaultValue = '',
  onChange,
  required,
  disabled,
}: SelectFieldProps) {
  const [ownValue, setOwnValue] = useState(defaultValue)
  return (
    <FieldShell
      label={label}
      hint={hint}
      error={error}
      hideLabel={hideLabel}
      required={required}
    >
      {(aria) => (
        <div className={styles.control}>
          <Select
            {...aria}
            value={value ?? ownValue}
            options={toOptions(children)}
            disabled={disabled}
            icon={icon}
            className={className}
            onChange={(chosen) => {
              setOwnValue(chosen)
              onChange?.({ target: { value: chosen } })
            }}
          />
        </div>
      )}
    </FieldShell>
  )
}
