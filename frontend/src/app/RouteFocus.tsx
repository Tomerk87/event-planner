import { useEffect, useRef } from 'react'
import { Outlet, useLocation } from 'react-router'

/**
 * Moves keyboard and screen-reader focus to the main content after each
 * navigation, so the new page is announced and Tab continues from its start.
 */
export function RouteFocus() {
  const { pathname } = useLocation()
  const previousPathname = useRef(pathname)

  useEffect(() => {
    if (previousPathname.current !== pathname) {
      previousPathname.current = pathname
      document.getElementById('main-content')?.focus()
    }
  }, [pathname])

  return <Outlet />
}
