import { ChevronDown, Plus } from 'lucide-react'
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import styles from './Combobox.module.css'
import { cx } from './cx.ts'
import fieldStyles from './Field.module.css'

interface ComboboxProps {
  label: string
  value: string
  onChange: (value: string) => void
  /** The existing choices; typing narrows them. */
  options: readonly string[]
  /** The row that empties the field, for example "No Group". */
  clearLabel: string
  /** The row offered for text that matches no option, for example `Create "X"`. */
  createLabel: (text: string) => string
  /** Accessible name of the arrow button that shows the choices. */
  toggleLabel: string
  hint?: string
  maxLength?: number
  /** Open the list above the field, for a field near the bottom of a dialog. */
  openUp?: boolean
}

type Row =
  | { kind: 'clear' }
  | { kind: 'option'; value: string }
  | { kind: 'create'; value: string }

const same = (a: string, b: string) =>
  a.trim().toLocaleLowerCase() === b.trim().toLocaleLowerCase()

/**
 * A text field with a list of existing choices. Typing narrows the list;
 * text that matches no choice can be kept as a new one. The field's value is
 * always the text shown, so a new name needs no extra step here.
 */
export function Combobox({
  label,
  value,
  onChange,
  options,
  clearLabel,
  createLabel,
  toggleLabel,
  hint,
  maxLength,
  openUp = false,
}: ComboboxProps) {
  const id = useId()
  const listId = `${id}-list`
  const hintId = `${id}-hint`
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  // What was typed since the list opened; null shows every choice.
  const [query, setQuery] = useState<string | null>(null)
  const [activeIndex, setActiveIndex] = useState(-1)

  const text = value.trim()
  const needle = (query ?? '').trim().toLocaleLowerCase()
  const rows: Row[] = [
    ...(text !== '' ? [{ kind: 'clear' } as const] : []),
    ...options
      .filter((option) => option.toLocaleLowerCase().includes(needle))
      .map((option) => ({ kind: 'option', value: option }) as const),
    ...(text !== '' && !options.some((option) => same(option, text))
      ? [{ kind: 'create', value: text } as const]
      : []),
  ]

  useEffect(() => {
    if (!open) {
      return
    }
    function closeIfOutside(event: Event) {
      if (
        event.target instanceof Node &&
        !containerRef.current?.contains(event.target)
      ) {
        close()
      }
    }
    document.addEventListener('pointerdown', closeIfOutside)
    return () => document.removeEventListener('pointerdown', closeIfOutside)
  }, [open])

  function show() {
    setOpen(true)
    setQuery(null)
    setActiveIndex(-1)
  }

  function close() {
    setOpen(false)
    setQuery(null)
    setActiveIndex(-1)
  }

  function choose(row: Row) {
    onChange(row.kind === 'clear' ? '' : row.value)
    close()
    inputRef.current?.focus()
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (!open) {
        show()
        return
      }
      if (rows.length > 0) {
        const step = event.key === 'ArrowDown' ? 1 : -1
        setActiveIndex(
          (current) => (current + step + rows.length) % rows.length,
        )
      }
    } else if (event.key === 'Enter' && open && rows[activeIndex]) {
      // Chooses the highlighted row instead of submitting the form.
      event.preventDefault()
      choose(rows[activeIndex])
    } else if (event.key === 'Escape' && open) {
      // Closes the list only, not the dialog the field may be in.
      event.preventDefault()
      event.stopPropagation()
      close()
    }
  }

  const rowLabel = (row: Row) =>
    row.kind === 'clear'
      ? clearLabel
      : row.kind === 'create'
        ? createLabel(row.value)
        : row.value

  return (
    <div className={fieldStyles.field}>
      <div className={fieldStyles.labelRow}>
        <label htmlFor={id} className={fieldStyles.label}>
          {label}
        </label>
      </div>
      <div ref={containerRef} className={fieldStyles.control}>
        <input
          ref={inputRef}
          id={id}
          className={cx(fieldStyles.input, fieldStyles.select)}
          role="combobox"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          aria-autocomplete="list"
          aria-activedescendant={
            open && activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined
          }
          aria-describedby={hint ? hintId : undefined}
          autoComplete="off"
          maxLength={maxLength}
          value={value}
          onChange={(event) => {
            onChange(event.target.value)
            setOpen(true)
            setQuery(event.target.value)
            setActiveIndex(-1)
          }}
          onClick={() => (open ? undefined : show())}
          onKeyDown={handleKeyDown}
          onBlur={(event) => {
            if (!containerRef.current?.contains(event.relatedTarget)) {
              close()
            }
          }}
        />
        <button
          type="button"
          className={styles.toggle}
          aria-label={toggleLabel}
          tabIndex={-1}
          onClick={() => {
            if (open) {
              close()
            } else {
              show()
            }
            inputRef.current?.focus()
          }}
        >
          <ChevronDown aria-hidden="true" />
        </button>
        {open && rows.length > 0 && (
          <ul
            id={listId}
            role="listbox"
            aria-label={label}
            className={cx(styles.list, openUp && styles.up)}
          >
            {rows.map((row, index) => (
              <li
                key={`${row.kind}-${row.kind === 'clear' ? '' : row.value}`}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={row.kind === 'option' && same(row.value, value)}
                className={cx(
                  styles.option,
                  index === activeIndex && styles.active,
                  row.kind !== 'option' && styles.special,
                )}
                // Keeps focus in the text box, so choosing does not blur it.
                onPointerDown={(event) => event.preventDefault()}
                onClick={() => choose(row)}
              >
                {row.kind === 'create' && <Plus aria-hidden="true" />}
                {rowLabel(row)}
              </li>
            ))}
          </ul>
        )}
      </div>
      {hint && (
        <p id={hintId} className={fieldStyles.hint}>
          {hint}
        </p>
      )}
    </div>
  )
}
