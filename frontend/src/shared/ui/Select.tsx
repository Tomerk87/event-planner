import { Check, ChevronDown } from 'lucide-react'
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import { cx } from './cx.ts'
import listStyles from './Listbox.module.css'
import styles from './Select.module.css'
import { useFloatingPosition } from './useFloatingPosition.ts'

export interface SelectOption {
  value: string
  label: string
  disabled?: boolean
  /** The language the label is written in, when it differs from the page's. */
  lang?: string
  /** More words a search finds the option by, such as a country's name. */
  keywords?: string
}

/** Text as a search compares it: lower case, without accents. */
function forSearch(text: string): string {
  return text
    .toLocaleLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

interface SelectProps {
  id?: string
  value: string
  options: readonly SelectOption[]
  onChange: (value: string) => void
  disabled?: boolean
  /** Styles the button that shows the current choice. */
  className?: string
  /** Shown before the current choice. */
  icon?: ReactNode
  /**
   * Makes the field a text box: typing narrows the list, as in the group
   * picker. For long lists, such as an event's guests.
   */
  searchable?: boolean
  /** Shown in the list when nothing matches what was typed. */
  emptyLabel?: string
  /**
   * What the closed field shows in place of the chosen option's label, such
   * as a status badge in a table cell.
   */
  renderValue?: (selected: SelectOption | undefined) => ReactNode
  'aria-label'?: string
  'aria-describedby'?: string
  'aria-invalid'?: true
}

const TYPEAHEAD_MS = 600

/**
 * Chooses one of a list of options. It behaves like the browser's own select
 * (arrow keys, Home and End, typing to jump, Escape) but opens the product's
 * list, the same one the group picker uses.
 */
export function Select({
  id,
  value,
  options: allOptions,
  onChange,
  disabled = false,
  className,
  icon,
  searchable = false,
  emptyLabel,
  renderValue,
  ...aria
}: SelectProps) {
  const listId = useId()
  const buttonRef = useRef<HTMLButtonElement & HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const typed = useRef({ text: '', at: 0 })
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  // What was typed into a searchable field since it opened; null shows all.
  const [query, setQuery] = useState<string | null>(null)
  const selected = allOptions.find((option) => option.value === value)
  const needle = forSearch((query ?? '').trim())
  // The options listed: all of them, or those that match what was typed.
  const options =
    needle === ''
      ? allOptions
      : allOptions.filter((option) =>
          forSearch(`${option.label} ${option.keywords ?? ''}`).includes(
            needle,
          ),
        )
  const selectedIndex = options.findIndex((option) => option.value === value)

  // Placed against the screen, so a table or dialog that scrolls cannot cut
  // the list off. It opens upwards near the bottom.
  const position = useFloatingPosition({
    open,
    anchorRef: buttonRef,
    floatingRef: listRef,
    matchWidth: true,
    measureKey: query,
  })

  useLayoutEffect(() => {
    const list = listRef.current
    if (!open || !list) {
      return
    }
    // Brings the highlighted option into view inside the list only; asking
    // the browser to do it would scroll the page as well.
    const active = list.querySelector<HTMLElement>('[data-active="true"]')
    if (active) {
      const top = active.offsetTop
      const bottom = top + active.offsetHeight
      if (top < list.scrollTop) {
        list.scrollTop = top
      } else if (bottom > list.scrollTop + list.clientHeight) {
        list.scrollTop = bottom - list.clientHeight
      }
    }
  }, [open, activeIndex, query])

  useEffect(() => {
    if (!open) {
      return
    }
    function closeIfOutside(event: Event) {
      const target = event.target
      if (
        target instanceof Node &&
        !buttonRef.current?.contains(target) &&
        !listRef.current?.contains(target)
      ) {
        setOpen(false)
        setQuery(null)
      }
    }
    document.addEventListener('pointerdown', closeIfOutside)
    return () => {
      document.removeEventListener('pointerdown', closeIfOutside)
    }
  }, [open])

  function show() {
    typed.current = { text: '', at: 0 }
    setQuery(null)
    setActiveIndex(allOptions.findIndex((option) => option.value === value))
    setOpen(true)
  }

  function close() {
    setOpen(false)
    setQuery(null)
  }

  function choose(index: number) {
    const option = options[index]
    if (option && !option.disabled) {
      close()
      if (option.value !== value) {
        onChange(option.value)
      }
    }
  }

  /** The next option that can be chosen, from `start`, going `step` at a time. */
  function enabledFrom(start: number, step: 1 | -1): number {
    for (
      let index = start;
      index >= 0 && index < options.length;
      index += step
    ) {
      if (!options[index]?.disabled) {
        return index
      }
    }
    return activeIndex
  }

  function jumpTo(character: string) {
    const now = Date.now()
    const text =
      now - typed.current.at < TYPEAHEAD_MS
        ? typed.current.text + character
        : character
    typed.current = { text, at: now }
    const wanted = text.toLocaleLowerCase()
    const index = options.findIndex(
      (option) =>
        !option.disabled && option.label.toLocaleLowerCase().startsWith(wanted),
    )
    if (index !== -1) {
      if (open) {
        setActiveIndex(index)
      } else {
        choose(index)
      }
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    const { key } = event
    if (key === 'ArrowDown' || key === 'ArrowUp') {
      event.preventDefault()
      if (!open) {
        show()
      } else {
        const step = key === 'ArrowDown' ? 1 : -1
        setActiveIndex(enabledFrom(activeIndex + step, step))
      }
    } else if ((key === 'Home' || key === 'End') && !searchable) {
      if (open) {
        event.preventDefault()
        setActiveIndex(
          key === 'Home'
            ? enabledFrom(0, 1)
            : enabledFrom(options.length - 1, -1),
        )
      }
    } else if (key === 'Enter' || (key === ' ' && !searchable)) {
      if (open) {
        event.preventDefault()
        choose(activeIndex)
      } else if (!searchable) {
        event.preventDefault()
        show()
      }
    } else if (key === 'Escape') {
      if (open) {
        // Closes the list only, not the dialog the field may be in.
        event.preventDefault()
        event.stopPropagation()
        close()
      }
    } else if (key === 'Tab') {
      close()
    } else if (
      !searchable &&
      key.length === 1 &&
      !event.ctrlKey &&
      !event.metaKey
    ) {
      jumpTo(key)
    }
  }

  const shared = {
    ref: buttonRef,
    id,
    role: 'combobox',
    'aria-haspopup': 'listbox',
    'aria-expanded': open,
    'aria-controls': open ? listId : undefined,
    'aria-activedescendant':
      open && activeIndex >= 0 && options[activeIndex]
        ? `${listId}-${activeIndex}`
        : undefined,
    disabled,
    'data-value': value,
    onKeyDown: handleKeyDown,
    ...aria,
  } as const

  return (
    <>
      {searchable ? (
        <span className={styles.search}>
          <input
            {...shared}
            aria-autocomplete="list"
            autoComplete="off"
            className={cx(styles.trigger, styles.searchInput, className)}
            lang={selected?.lang}
            // The current choice until something is typed.
            value={query ?? selected?.label ?? ''}
            onChange={(event) => {
              setQuery(event.target.value)
              setActiveIndex(0)
              if (!open) {
                setOpen(true)
              }
            }}
            onClick={(event) => {
              if (!open) {
                show()
                // Ready to be typed over.
                event.currentTarget.select()
              }
            }}
            onBlur={(event) => {
              if (!listRef.current?.contains(event.relatedTarget)) {
                close()
              }
            }}
          />
          <ChevronDown className={styles.searchChevron} aria-hidden="true" />
        </span>
      ) : (
        <button
          {...shared}
          type="button"
          className={cx(styles.trigger, className)}
          value={value}
          onClick={() => (open ? close() : show())}
        >
          {icon && (
            <span className={styles.icon} aria-hidden="true">
              {icon}
            </span>
          )}
          <span className={styles.value} lang={selected?.lang}>
            {renderValue ? renderValue(selected) : (selected?.label ?? '')}
          </span>
          <ChevronDown className={styles.chevron} aria-hidden="true" />
        </button>
      )}
      {open && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          aria-labelledby={id}
          className={cx(listStyles.list, styles.list)}
          style={position}
        >
          {options.map((option, index) => (
            <li
              key={option.value}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === selectedIndex}
              aria-disabled={option.disabled || undefined}
              data-value={option.value}
              data-active={index === activeIndex}
              lang={option.lang}
              className={cx(
                listStyles.option,
                index === activeIndex && listStyles.active,
              )}
              // Keeps focus on the button, so the keyboard keeps working.
              onPointerDown={(event) => event.preventDefault()}
              onClick={() => choose(index)}
            >
              <span className={styles.optionLabel}>{option.label}</span>
              {index === selectedIndex && <Check aria-hidden="true" />}
            </li>
          ))}
          {options.length === 0 && emptyLabel && (
            <li role="presentation" className={styles.empty}>
              {emptyLabel}
            </li>
          )}
        </ul>
      )}
    </>
  )
}
