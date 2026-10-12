import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import styles from './BottomActionBar.module.css'

const SPACE_PROPERTY = '--action-bar-space'

interface BottomActionBarProps {
  label: string
  children: ReactNode
}

/**
 * The actions of a form page on a phone: pinned to the bottom of the screen,
 * aligned with the page content, with the buttons sharing the width equally.
 * While shown, it reserves its own height at the end of the page so it never
 * covers content, focused fields, or toasts (see base.css and Toast.module.css).
 * It is rendered at the end of the document so that keyboard focus reaches it
 * after the page content, matching where it appears, and is a labelled region
 * so that it remains inside a landmark there.
 */
export function BottomActionBar({ label, children }: BottomActionBarProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const bar = ref.current
    if (!bar) {
      return
    }
    const root = document.documentElement
    const reserve = () =>
      root.style.setProperty(SPACE_PROPERTY, `${bar.offsetHeight}px`)

    reserve()
    const observer =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(reserve)
    observer?.observe(bar)

    return () => {
      observer?.disconnect()
      root.style.removeProperty(SPACE_PROPERTY)
    }
  }, [])

  return createPortal(
    <div ref={ref} className={styles.bar} role="region" aria-label={label}>
      <div className={styles.row}>{children}</div>
    </div>,
    document.body,
  )
}
