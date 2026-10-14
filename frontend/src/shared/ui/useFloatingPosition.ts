import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useState,
  type CSSProperties,
  type RefObject,
} from 'react'

const GAP = 4
const EDGE = 8

interface FloatingOptions {
  open: boolean
  /** The control the floating element belongs to. */
  anchorRef: RefObject<HTMLElement | null>
  floatingRef: RefObject<HTMLElement | null>
  /** Which edge of the anchor it lines up with, in reading direction. */
  align?: 'start' | 'end'
  /** At least as wide as the anchor, as a dropdown list is. */
  matchWidth?: boolean
  /** Changes whenever the floating element's size may change while open. */
  measureKey?: unknown
}

/**
 * Places a list or menu against the screen rather than the page, so a table
 * or dialog that scrolls neither cuts it off nor grows a scrollbar for it. It
 * opens upwards when there is no room below, and follows its anchor when the
 * page scrolls or the window is resized. The element needs `position: fixed`;
 * it stays invisible until it has been measured.
 */
export function useFloatingPosition({
  open,
  anchorRef,
  floatingRef,
  align = 'start',
  matchWidth = false,
  measureKey,
}: FloatingOptions): CSSProperties {
  const [position, setPosition] = useState<CSSProperties | null>(null)

  const place = useCallback(() => {
    const anchorElement = anchorRef.current
    const floating = floatingRef.current
    if (!anchorElement || !floating) {
      return
    }
    const anchor = anchorElement.getBoundingClientRect()
    const width = matchWidth
      ? Math.max(floating.offsetWidth, anchor.width)
      : floating.offsetWidth
    const height = floating.offsetHeight
    const below = window.innerHeight - anchor.bottom
    const openUp = below < height + GAP + EDGE && anchor.top > below
    const isRtl = getComputedStyle(anchorElement).direction === 'rtl'
    // The start edge is the left one in English and the right one in Hebrew.
    const alignRight = (align === 'end') !== isRtl
    const left = alignRight ? anchor.right - width : anchor.left
    setPosition({
      left: Math.max(EDGE, Math.min(left, window.innerWidth - width - EDGE)),
      ...(matchWidth ? { minInlineSize: anchor.width } : {}),
      ...(openUp
        ? { bottom: window.innerHeight - anchor.top + GAP }
        : { top: anchor.bottom + GAP }),
    })
  }, [anchorRef, floatingRef, align, matchWidth])

  useLayoutEffect(() => {
    if (open) {
      place()
    }
  }, [open, place, measureKey])

  useEffect(() => {
    if (!open) {
      return
    }
    function follow(event: Event) {
      // Scrolling inside the element itself does not move it.
      if (!(
        event.target instanceof Node &&
        floatingRef.current?.contains(event.target)
      )) {
        place()
      }
    }
    window.addEventListener('scroll', follow, true)
    window.addEventListener('resize', follow)
    return () => {
      window.removeEventListener('scroll', follow, true)
      window.removeEventListener('resize', follow)
    }
  }, [open, place, floatingRef])

  // Measured before the browser paints, so a stale position is never seen.
  // Until then it is transparent rather than hidden, so focus can already
  // move into it.
  return open && position ? position : { opacity: 0, pointerEvents: 'none' }
}
