import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { cx } from './cx.ts'
import styles from './Popover.module.css'

interface PopoverProps {
  /** Accessible name of the button, and of the panel it opens. */
  label: string
  /** The button's visible content. */
  trigger: ReactNode
  triggerClassName?: string
  align?: 'start' | 'end'
  /** The panel; given a function, it can close the panel itself. */
  children: ReactNode | ((close: () => void) => ReactNode)
  /** Overrides the panel's own look, such as its width. */
  panelClassName?: string
}

/**
 * A button that opens a small panel of controls beside it. Unlike a dialog it
 * does not take over the page: it closes on Escape, when focus moves away,
 * and on a click outside.
 */
export function Popover({
  label,
  trigger,
  triggerClassName,
  align = 'end',
  children,
  panelClassName,
}: PopoverProps) {
  const panelId = useId()
  const containerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) {
      return
    }
    const isOutside = (target: EventTarget | null) =>
      target instanceof Node && !containerRef.current?.contains(target)
    function closeOnPointer(event: Event) {
      if (isOutside(event.target)) {
        setOpen(false)
      }
    }
    // A click on plain text inside the panel hands focus to the nearest
    // focusable element around it (the page's main area). That element
    // contains the panel, so it is not a move away from it.
    function closeOnFocus(event: Event) {
      const container = containerRef.current
      if (
        isOutside(event.target) &&
        !(container && (event.target as Node).contains(container))
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('pointerdown', closeOnPointer)
    document.addEventListener('focusin', closeOnFocus)
    return () => {
      document.removeEventListener('pointerdown', closeOnPointer)
      document.removeEventListener('focusin', closeOnFocus)
    }
  }, [open])

  return (
    <div
      ref={containerRef}
      className={styles.popover}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && open) {
          event.stopPropagation()
          setOpen(false)
          triggerRef.current?.focus()
        }
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        className={triggerClassName}
        aria-label={label}
        title={label}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((value) => !value)}
      >
        {trigger}
      </button>
      {open && (
        <div
          id={panelId}
          role="group"
          aria-label={label}
          className={cx(styles.panel, styles[align], panelClassName)}
        >
          {typeof children === 'function'
            ? children(() => setOpen(false))
            : children}
        </div>
      )}
    </div>
  )
}
