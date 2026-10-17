import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import type { Country } from '../../domain/phone.ts'
import { getCurrentLanguage } from '../../i18n/i18n.ts'
import {
  defaultPlaceSuggester,
  type PlaceSuggester,
  type PlaceSuggestion,
} from '../places.ts'
import { cx } from './cx.ts'
import fieldStyles from './Field.module.css'
import { FieldShell, TextField, type FieldCommonProps } from './Field.tsx'
import listStyles from './Listbox.module.css'
import styles from './PlaceField.module.css'

const MIN_LETTERS = 3
const PAUSE_MS = 300

interface PlaceFieldProps extends FieldCommonProps {
  value: string
  onChange: (value: string) => void
  /** Favours places in the event's country. */
  country: Country
  maxLength?: number
  disabled?: boolean
  /** Where suggestions come from; the deployment's Google key by default. */
  suggester?: PlaceSuggester | null
}

/**
 * A location field that suggests places as it is typed (D104), like Google
 * Maps: a pause in typing asks once, and choosing a place fills the field
 * with its name and address. Anything typed is kept as it is, and with no
 * suggester (no key) it is a plain text field.
 */
export function PlaceField({
  suggester = defaultPlaceSuggester,
  ...props
}: PlaceFieldProps) {
  if (!suggester) {
    const { value, onChange, country: _country, ...rest } = props
    return (
      <TextField
        {...rest}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    )
  }
  return <SuggestingField suggester={suggester} {...props} />
}

function SuggestingField({
  label,
  hint,
  error,
  hideLabel,
  value,
  onChange,
  country,
  maxLength,
  disabled,
  suggester,
}: PlaceFieldProps & { suggester: PlaceSuggester }) {
  const listId = useId()
  const containerRef = useRef<HTMLDivElement>(null)
  const session = useRef<object | null>(null)
  const asked = useRef(0)
  const [typed, setTyped] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([])
  const [activeIndex, setActiveIndex] = useState(-1)
  const open = typed !== null && suggestions.length > 0

  // Asks once the typing pauses; a later answer replaces an earlier one, and
  // an answer to an older question is dropped.
  useEffect(() => {
    if (typed === null || typed.trim().length < MIN_LETTERS) {
      return
    }
    const question = ++asked.current
    const timer = setTimeout(() => {
      void (async () => {
        try {
          session.current ??= await suggester.newSession()
          const found = await suggester.suggest(typed.trim(), {
            language: getCurrentLanguage(),
            country,
            session: session.current,
          })
          if (question === asked.current) {
            setSuggestions(found)
            setActiveIndex(-1)
          }
        } catch {
          // No suggestions (offline, quota reached): the field still works.
          if (question === asked.current) {
            setSuggestions([])
          }
        }
      })()
    }, PAUSE_MS)
    return () => clearTimeout(timer)
  }, [typed, country, suggester])

  function close() {
    asked.current += 1
    setTyped(null)
    setSuggestions([])
    setActiveIndex(-1)
  }

  function choose(suggestion: PlaceSuggestion) {
    onChange(suggestion.text)
    // The next search is a new session.
    session.current = null
    close()
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!open) {
      return
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const step = event.key === 'ArrowDown' ? 1 : -1
      setActiveIndex(
        (current) => (current + step + suggestions.length) % suggestions.length,
      )
    } else if (event.key === 'Enter' && suggestions[activeIndex]) {
      // Chooses the highlighted place instead of submitting the form.
      event.preventDefault()
      choose(suggestions[activeIndex])
    } else if (event.key === 'Escape') {
      // Closes the list only, not the dialog the field may be in.
      event.preventDefault()
      event.stopPropagation()
      close()
    }
  }

  return (
    <FieldShell
      label={label}
      hint={hint}
      error={error}
      hideLabel={hideLabel}
      required={false}
    >
      {(aria) => (
        <div ref={containerRef} className={fieldStyles.control}>
          <input
            {...aria}
            className={fieldStyles.input}
            role="combobox"
            aria-expanded={open}
            aria-controls={open ? listId : undefined}
            aria-autocomplete="list"
            aria-activedescendant={
              open && activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined
            }
            autoComplete="off"
            maxLength={maxLength}
            disabled={disabled}
            value={value}
            onChange={(event) => {
              onChange(event.target.value)
              setTyped(event.target.value)
              if (event.target.value.trim().length < MIN_LETTERS) {
                setSuggestions([])
              }
            }}
            onKeyDown={handleKeyDown}
            onBlur={(event) => {
              if (!containerRef.current?.contains(event.relatedTarget)) {
                close()
              }
            }}
          />
          {open && (
            <div className={styles.popup}>
              <ul id={listId} role="listbox" aria-label={label}>
                {suggestions.map((suggestion, index) => (
                  <li
                    key={`${suggestion.text}-${index}`}
                    id={`${listId}-${index}`}
                    role="option"
                    aria-selected={index === activeIndex}
                    className={cx(
                      listStyles.option,
                      index === activeIndex && listStyles.active,
                    )}
                    // Keeps focus in the text box, so choosing does not blur it.
                    onPointerDown={(event) => event.preventDefault()}
                    onClick={() => choose(suggestion)}
                  >
                    <span className={listStyles.optionLabel}>
                      {suggestion.main}
                      {suggestion.secondary && (
                        <span className={styles.secondary}>
                          {suggestion.secondary}
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
              <p className={styles.attribution} lang="en">
                Google Maps
              </p>
            </div>
          )}
        </div>
      )}
    </FieldShell>
  )
}
