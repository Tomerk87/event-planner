import { useSyncExternalStore } from 'react'

/** Breakpoints documented in src/styles/tokens.css. */
export const PHONE_QUERY = '(max-width: 767px)'
export const DESKTOP_QUERY = '(min-width: 1024px)'

export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query)
      list.addEventListener('change', onChange)
      return () => list.removeEventListener('change', onChange)
    },
    () => window.matchMedia(query).matches,
  )
}
