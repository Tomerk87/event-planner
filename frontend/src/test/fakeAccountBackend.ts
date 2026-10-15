import {
  findAccountByEmail,
  validateSignIn,
  validateSignUp,
} from '../domain/accounts.ts'
import { DomainError } from '../domain/errors.ts'
import type { Id, User } from '../domain/models.ts'
import type { ApiBackend } from '../services/api/apiBackend.ts'
import type { Services, Session } from '../services/contracts/index.ts'
import {
  createMockServices,
  type MockOptions,
} from '../services/mock/mockServices.ts'
import {
  createMemoryPersistence,
  type DemoPersistence,
  type Persistence,
} from '../services/mock/persistence.ts'
import {
  createEmptyState,
  isUsableStoredDemo,
  withInvitations,
  type DemoState,
} from '../services/mock/state.ts'

const ACCOUNTS_VERSION = 1

/**
 * A stand-in for the real backend in component tests, which have no server:
 * accounts in memory, applying the same rules through the mock services.
 * Passwords are accepted without being stored or checked; the real server
 * and its own tests cover authentication.
 */
export function createFakeAccountBackend(
  options: Partial<Omit<MockOptions, 'persistence'>> & {
    accountsPersistence?: DemoPersistence
    sessionPersistence?: Persistence<Session>
  } = {},
): ApiBackend & { endSession: () => void } {
  const {
    accountsPersistence = createMemoryPersistence(),
    sessionPersistence = createMemoryPersistence<Session>(),
    ...mockOptions
  } = options
  let account: { userId: Id; services: Services } | undefined
  const ended = new Set<() => void>()

  function load(): DemoState {
    const stored = accountsPersistence.load()
    return isUsableStoredDemo(stored, {
      requireCurrentUser: false,
      version: ACCOUNTS_VERSION,
    })
      ? withInvitations(stored.state)
      : createEmptyState()
  }

  function start(user: User): Session {
    const session: Session = { workspace: 'account', userId: user.id }
    sessionPersistence.save(session)
    return session
  }

  return {
    auth: {
      getSession: async () => {
        const stored = sessionPersistence.load() as Session | null
        return stored?.workspace === 'account' &&
          load().users.some((user) => user.id === stored.userId)
          ? stored
          : null
      },
      signUp: async (input) => {
        const state = load()
        const user: User = {
          ...validateSignUp(input, state.users),
          id: `usr-n${state.nextId}`,
          isSuperUser: false,
        }
        const invited = state.invitations.filter(
          (invitation) => invitation.email === user.email,
        )
        accountsPersistence.save({
          version: ACCOUNTS_VERSION,
          state: {
            ...state,
            nextId: state.nextId + 1,
            users: [...state.users, user],
            memberships: [
              ...state.memberships,
              ...invited.map(({ eventId, role }) => ({
                eventId,
                userId: user.id,
                role,
              })),
            ],
            invitations: state.invitations.filter(
              (invitation) => !invited.includes(invitation),
            ),
          },
        })
        account = undefined
        return start(user)
      },
      signIn: async (input) => {
        const user = findAccountByEmail(load().users, validateSignIn(input))
        if (!user) {
          throw new DomainError('INVALID_CREDENTIALS')
        }
        return start(user)
      },
      signOut: async () => {
        sessionPersistence.clear()
      },
    },

    servicesFor(session) {
      if (session.workspace !== 'account') {
        throw new Error('the account backend serves accounts only')
      }
      if (account?.userId !== session.userId) {
        account = {
          userId: session.userId,
          services: createMockServices({
            ...mockOptions,
            persistence: accountsPersistence,
            actingUserId: session.userId,
            seed: createEmptyState,
            demoControls: false,
            dataVersion: ACCOUNTS_VERSION,
          }),
        }
      }
      return account.services
    },

    publicRsvp: {
      getPublicEvent: (slug) =>
        account
          ? account.services.rsvp.getPublicEvent(slug)
          : Promise.reject(new DomainError('NOT_FOUND', { entity: 'event' })),
      submit: (slug, input) =>
        account
          ? account.services.rsvp.submit(slug, input)
          : Promise.reject(new DomainError('NOT_FOUND', { entity: 'event' })),
    },

    onSessionEnded(listener) {
      ended.add(listener)
      return () => ended.delete(listener)
    },

    /** What the server answering 401 does: the session has ended. */
    endSession: () => {
      sessionPersistence.clear()
      ended.forEach((listener) => listener())
    },
  }
}
