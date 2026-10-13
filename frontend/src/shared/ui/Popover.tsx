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
  children: ReactNode
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
}: PopoverProps) {
  const panelId = useId()
  const containerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) {
      return
    }
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
          className={cx(styles.panel, styles[align])}
        >
          {children}
        </div>
      )}
    </div>
  )
}
