import { isDomainError } from '../../domain/errors.ts'
import type { User } from '../../domain/models.ts'
import type {
  AuthService,
  PreferencesService,
  PublicRsvpService,
  Services,
  Session,
} from '../contracts/index.ts'
import { createApiServices, createPublicRsvpApi } from './apiServices.ts'
import { createHttp, type HttpOptions } from './http.ts'

/** The real application: accounts, sessions and data on the server. */
export interface ApiBackend {
  /** No demo here: `enterDemo` belongs to the browser-local demo backend. */
  auth: Omit<AuthService, 'enterDemo'>
  servicesFor(session: Session): Services
  publicRsvp: PublicRsvpService
  onSessionEnded(listener: () => void): () => void
}

/**
 * Sign-up and sign-in against the API. The session lives in an httpOnly
 * cookie the browser keeps; nothing about it is stored by this code.
 */
export function createApiBackend(
  options: Omit<HttpOptions, 'onUnauthenticated'> & {
    preferences: PreferencesService
  },
): ApiBackend {
  const listeners = new Set<() => void>()
  const http = createHttp({
    ...options,
    onUnauthenticated: () => listeners.forEach((listener) => listener()),
  })
  // Asking who is signed in expects "nobody" as an answer: it never means
  // that a session ended.
  const quiet = createHttp(options)
  const services = createApiServices(http, options.preferences)
  const sessionOf = (user: User): Session => ({
    workspace: 'account',
    userId: user.id,
  })

  return {
    auth: {
      getSession: async () => {
        try {
          return sessionOf(await quiet.get<User>('/auth/me'))
        } catch (error) {
          if (isDomainError(error, 'UNAUTHENTICATED')) {
            return null
          }
          throw error
        }
      },
      signUp: async (input) =>
        sessionOf(
          await http.post<User>('/auth/sign-up', {
            name: input.name,
            email: input.email,
            password: input.password,
          }),
        ),
      signIn: async (input) =>
        sessionOf(
          await http.post<User>('/auth/sign-in', {
            email: input.email,
            password: input.password,
          }),
        ),
      signOut: () => http.post<void>('/auth/sign-out'),
    },

    servicesFor: () => services,

    publicRsvp: createPublicRsvpApi(http),

    onSessionEnded(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}
