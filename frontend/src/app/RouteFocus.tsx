import { useEffect, useRef } from 'react'
import { Outlet, useLocation } from 'react-router'

/**
 * After each navigation, shows the new page from its top and moves keyboard
 * and screen-reader focus to the main content, so the page is announced and
 * Tab continues from its start. Filters and tabs kept in the address change
 * the query only, so they leave the scroll position alone.
 */
export function RouteFocus() {
  const { pathname } = useLocation()
  const previousPathname = useRef(pathname)

  useEffect(() => {
    if (previousPathname.current !== pathname) {
      previousPathname.current = pathname
      window.scrollTo(0, 0)
      document.getElementById('main-content')?.focus({ preventScroll: true })
    }
  }, [pathname])

  return <Outlet />
}
