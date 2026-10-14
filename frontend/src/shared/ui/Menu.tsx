import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import { Link } from 'react-router'
import { cx } from './cx.ts'
import styles from './Menu.module.css'
import { useFloatingPosition } from './useFloatingPosition.ts'

export interface MenuItem {
  id: string
  label: string
  icon?: ReactNode
  tone?: 'danger'
  /** Navigate to an address; otherwise `onSelect` runs. */
  to?: string
  onSelect?: () => void
}

interface MenuProps {
  /** Accessible name of the button that opens the menu. */
  label: string
  items: MenuItem[]
  /** Which edge of the button the menu lines up with. */
  align?: 'start' | 'end'
  triggerClassName?: string
  /** The button's visible content. */
  children: ReactNode
}

/**
 * A button that opens a short list of actions. Arrow keys, Home and End move
 * between the actions; Escape closes the menu and returns focus to the button.
 */
export function Menu({
  label,
  items,
  align = 'end',
  triggerClassName,
  children,
}: MenuProps) {
  const menuId = useId()
  const containerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const itemRefs = useRef(new Map<string, HTMLElement>())
  const listRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  // Floats above the page, so a menu on a table's last row does not make
  // the table scroll.
  const position = useFloatingPosition({
    open,
    anchorRef: triggerRef,
    floatingRef: listRef,
    align,
  })

  useEffect(() => {
    if (!open) {
      return
    }
    containerRef.current
      ?.querySelector<HTMLElement>('[role="menuitem"]')
      ?.focus()
    function closeIfOutside(event: Event) {
      if (
        event.target instanceof Node &&
        !containerRef.current?.contains(event.target)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('pointerdown', closeIfOutside)
    document.addEventListener('focusin', closeIfOutside)
    return () => {
      document.removeEventListener('pointerdown', closeIfOutside)
      document.removeEventListener('focusin', closeIfOutside)
    }
  }, [open])

  function close() {
    setOpen(false)
    triggerRef.current?.focus()
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      if (open) {
        event.stopPropagation()
        close()
      }
      return
    }
    if (!open) {
      return
    }
    const ids = items.map((item) => item.id)
    const current = ids.findIndex(
      (id) => itemRefs.current.get(id) === document.activeElement,
    )
    const last = ids.length - 1
    let next: number
    if (event.key === 'ArrowDown') {
      next = current >= last ? 0 : current + 1
    } else if (event.key === 'ArrowUp') {
      next = current <= 0 ? last : current - 1
    } else if (event.key === 'Home') {
      next = 0
    } else if (event.key === 'End') {
      next = last
    } else {
      return
    }
    event.preventDefault()
    const id = ids[next]
    if (id !== undefined) {
      itemRefs.current.get(id)?.focus()
    }
  }

  function register(id: string) {
    return (element: HTMLElement | null) => {
      if (element) {
        itemRefs.current.set(id, element)
      } else {
        itemRefs.current.delete(id)
      }
    }
  }

  return (
    <div ref={containerRef} className={styles.menu} onKeyDown={handleKeyDown}>
      <button
        ref={triggerRef}
        type="button"
        className={triggerClassName}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((value) => !value)}
      >
        {children}
      </button>
      {open && (
        <div
          ref={listRef}
          id={menuId}
          role="menu"
          aria-label={label}
          className={styles.list}
          style={position}
        >
          {items.map((item) => {
            const className = cx(
              styles.item,
              item.tone === 'danger' && styles.danger,
            )
            const content = (
              <>
                {item.icon && (
                  <span className={styles.icon} aria-hidden="true">
                    {item.icon}
                  </span>
                )}
                <span>{item.label}</span>
              </>
            )
            return item.to === undefined ? (
              <button
                key={item.id}
                ref={register(item.id)}
                type="button"
                role="menuitem"
                tabIndex={-1}
                className={className}
                onClick={() => {
                  close()
                  item.onSelect?.()
                }}
              >
                {content}
              </button>
            ) : (
              <Link
                key={item.id}
                ref={register(item.id)}
                to={item.to}
                role="menuitem"
                tabIndex={-1}
                className={className}
                onClick={() => setOpen(false)}
              >
                {content}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
