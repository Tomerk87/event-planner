import { Check, ChevronDown } from 'lucide-react'
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import { cx } from './cx.ts'
import listStyles from './Listbox.module.css'
import styles from './Select.module.css'

export interface SelectOption {
  value: string
  label: string
  disabled?: boolean
  /** The language the label is written in, when it differs from the page's. */
  lang?: string
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
  'aria-label'?: string
  'aria-describedby'?: string
  'aria-invalid'?: true
}

const GAP = 4
const EDGE = 8
const TYPEAHEAD_MS = 600

/**
 * Chooses one of a list of options. It behaves like the browser's own select
 * (arrow keys, Home and End, typing to jump, Escape) but opens the product's
 * list, the same one the group picker uses.
 */
export function Select({
  id,
  value,
  options,
  onChange,
  disabled = false,
  className,
  icon,
  ...aria
}: SelectProps) {
  const listId = useId()
  const buttonRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const typed = useRef({ text: '', at: 0 })
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [position, setPosition] = useState<CSSProperties | null>(null)
  const selectedIndex = options.findIndex((option) => option.value === value)
  const selected = options[selectedIndex]

  // Placed against the screen rather than the page, so a table or a dialog
  // that scrolls cannot cut the list off. It opens upwards near the bottom.
  function place() {
    const button = buttonRef.current
    const list = listRef.current
    if (!button || !list) {
      return
    }
    const anchor = button.getBoundingClientRect()
    const width = Math.max(list.offsetWidth, anchor.width)
    const height = list.offsetHeight
    const below = window.innerHeight - anchor.bottom
    const openUp = below < height + GAP + EDGE && anchor.top > below
    const isRtl = getComputedStyle(button).direction === 'rtl'
    const left = isRtl ? anchor.right - width : anchor.left
    setPosition({
      left: Math.max(EDGE, Math.min(left, window.innerWidth - width - EDGE)),
      minInlineSize: anchor.width,
      ...(openUp
        ? { bottom: window.innerHeight - anchor.top + GAP }
        : { top: anchor.bottom + GAP }),
    })
  }

  useLayoutEffect(() => {
    const list = listRef.current
    if (!open || !list) {
      return
    }
    place()
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
  }, [open, activeIndex])

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
      }
    }
    // The list follows its button when the page scrolls or is resized.
    function follow(event: Event) {
      if (!(
        event.target instanceof Node && listRef.current?.contains(event.target)
      )) {
        place()
      }
    }
    document.addEventListener('pointerdown', closeIfOutside)
    window.addEventListener('scroll', follow, true)
    window.addEventListener('resize', follow)
    return () => {
      document.removeEventListener('pointerdown', closeIfOutside)
      window.removeEventListener('scroll', follow, true)
      window.removeEventListener('resize', follow)
    }
  }, [open])

  function show() {
    typed.current = { text: '', at: 0 }
    setPosition(null)
    setActiveIndex(selectedIndex)
    setOpen(true)
  }

  function choose(index: number) {
    const option = options[index]
    if (option && !option.disabled) {
      setOpen(false)
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

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const { key } = event
    if (key === 'ArrowDown' || key === 'ArrowUp') {
      event.preventDefault()
      if (!open) {
        show()
      } else {
        const step = key === 'ArrowDown' ? 1 : -1
        setActiveIndex(enabledFrom(activeIndex + step, step))
      }
    } else if (key === 'Home' || key === 'End') {
      if (open) {
        event.preventDefault()
        setActiveIndex(
          key === 'Home'
            ? enabledFrom(0, 1)
            : enabledFrom(options.length - 1, -1),
        )
      }
    } else if (key === 'Enter' || key === ' ') {
      event.preventDefault()
      if (open) {
        choose(activeIndex)
      } else {
        show()
      }
    } else if (key === 'Escape') {
      if (open) {
        // Closes the list only, not the dialog the field may be in.
        event.preventDefault()
        event.stopPropagation()
        setOpen(false)
      }
    } else if (key === 'Tab') {
      setOpen(false)
    } else if (key.length === 1 && !event.ctrlKey && !event.metaKey) {
      jumpTo(key)
    }
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        id={id}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={
          open && activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined
        }
        className={cx(styles.trigger, className)}
        disabled={disabled}
        value={value}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={handleKeyDown}
        {...aria}
      >
        {icon && (
          <span className={styles.icon} aria-hidden="true">
            {icon}
          </span>
        )}
        <span className={styles.value} lang={selected?.lang}>
          {selected?.label ?? ''}
        </span>
        <ChevronDown className={styles.chevron} aria-hidden="true" />
      </button>
      {open && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          aria-labelledby={id}
          className={cx(listStyles.list, styles.list)}
          style={position ?? { visibility: 'hidden' }}
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
        </ul>
      )}
    </>
  )
}
