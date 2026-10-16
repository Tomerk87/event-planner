import { DomainError } from '../../domain/errors.ts'
import type { ApiBackend } from './apiBackend.ts'

function unavailable(): Promise<never> {
  return Promise.reject(new DomainError('UNAVAILABLE'))
}

/**
 * The accounts side of a demo-only site (`VITE_ACCOUNTS_ENABLED=false`,
 * D102), which has no server: nobody is ever signed in, account actions are
 * unavailable, and an RSVP link that is not a demo event's is not found.
 * Nothing here makes a request.
 */
export const noAccountsBackend: ApiBackend = {
  auth: {
    getSession: () => Promise.resolve(null),
    signUp: unavailable,
    signIn: unavailable,
    signOut: () => Promise.resolve(),
  },
  accountEmail: {
    getFeatures: unavailable,
    forgotPassword: unavailable,
    resetPassword: unavailable,
    verifyEmail: unavailable,
  },
  servicesFor: () => {
    throw new DomainError('UNAUTHENTICATED')
  },
  publicRsvp: {
    getPublicEvent: () => Promise.reject(new DomainError('NOT_FOUND')),
    submit: () => Promise.reject(new DomainError('NOT_FOUND')),
  },
  onSessionEnded: () => () => undefined,
}
