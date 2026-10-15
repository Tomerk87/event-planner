import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Backend, Session } from '../../services/contracts/index.ts'
import {
  PublicRsvpContext,
  ServicesContext,
} from '../../services/servicesContext.ts'
import styles from '../../shared/StandalonePage.module.css'
import { LoadingState } from '../../shared/ui/States.tsx'
import { SessionContext, type SessionContextValue } from './sessionContext.ts'

type SessionState =
  { status: 'loading' } | { status: 'ready'; session: Session | null }

interface SessionProviderProps {
  backend: Backend
  children: ReactNode
}

/**
 * Knows who is using the application and gives the pages beneath it the data
 * operations of that session. Cached data never outlives the session it was
 * loaded for.
 */
export function SessionProvider({ backend, children }: SessionProviderProps) {
  const queryClient = useQueryClient()
  const [state, setState] = useState<SessionState>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    void backend.auth
      .getSession()
      .catch(() => null)
      .then((session) => {
        if (!cancelled) {
          setState({ status: 'ready', session })
        }
      })
    return () => {
      cancelled = true
    }
  }, [backend])

  // Another tab changed the data, for example a guest answered the RSVP.
  useEffect(
    () => backend.onExternalChange(() => void queryClient.invalidateQueries()),
    [backend, queryClient],
  )

  // The server no longer accepts the account's session (expired or
  // revoked): back to signed out, which the route guards turn into the
  // landing page. Nothing happens for a visitor with no account session.
  const current = useRef<Session | null>(null)
  useEffect(() => {
    current.current = state.status === 'ready' ? state.session : null
  }, [state])
  useEffect(
    () =>
      backend.onSessionEnded(() => {
        if (current.current?.workspace !== 'account') {
          return
        }
        queryClient.clear()
        setState({ status: 'ready', session: null })
      }),
    [backend, queryClient],
  )

  const session = state.status === 'ready' ? state.session : null

  const value = useMemo<SessionContextValue>(() => {
    function change(next: Session | null) {
      queryClient.clear()
      setState({ status: 'ready', session: next })
    }
    return {
      session,
      demoAvailable: backend.demoAvailable,
      signUp: async (input) => change(await backend.auth.signUp(input)),
      signIn: async (input) => change(await backend.auth.signIn(input)),
      enterDemo: async () => change(await backend.auth.enterDemo()),
      signOut: async () => {
        await backend.auth.signOut()
        change(null)
      },
    }
  }, [backend, queryClient, session])

  const services = useMemo(
    () => (session ? backend.servicesFor(session) : null),
    [backend, session],
  )

  if (state.status === 'loading') {
    return (
      <main className={styles.page}>
        <LoadingState />
      </main>
    )
  }

  return (
    <SessionContext.Provider value={value}>
      <ServicesContext.Provider value={services}>
        <PublicRsvpContext.Provider value={backend.publicRsvp}>
          {children}
        </PublicRsvpContext.Provider>
      </ServicesContext.Provider>
    </SessionContext.Provider>
  )
}
