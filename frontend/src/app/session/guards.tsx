import { Navigate, Outlet } from 'react-router'
import { useSession } from './sessionContext.ts'

/** Pages of the application itself: without a session, back to the landing page. */
export function RequireSession() {
  const { session } = useSession()
  return session ? <Outlet /> : <Navigate to="/" replace />
}

/** Landing, sign-in and sign-up: with a session, straight to My Events. */
export function SignedOutOnly() {
  const { session } = useSession()
  return session ? <Navigate to="/events" replace /> : <Outlet />
}

/**
 * Account pages (sign-in, sign-up, email links, System): on a demo-only site,
 * which has no accounts (D102), back to the landing page.
 */
export function AccountsOnly() {
  const { accountsAvailable } = useSession()
  return accountsAvailable ? <Outlet /> : <Navigate to="/" replace />
}
