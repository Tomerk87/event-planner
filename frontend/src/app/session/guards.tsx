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
