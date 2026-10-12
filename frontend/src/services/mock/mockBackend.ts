import {
  findAccountByEmail,
  validateSignIn,
  validateSignUp,
} from '../../domain/accounts.ts'
import { DomainError } from '../../domain/errors.ts'
import type { Id, User } from '../../domain/models.ts'
import type { Backend, Services, Session } from '../contracts/index.ts'
import { createMockServices, type MockOptions } from './mockServices.ts'
import type { DemoPersistence, Persistence } from './persistence.ts'
import {
  createEmptyState,
  DATASET_VERSION,
  isUsableStoredDemo,
  type DemoState,
} from './state.ts'

export interface MockBackendOptions extends Omit<
  MockOptions,
  'persistence' | 'actingUserId' | 'seed' | 'demoControls'
> {
  demoPersistence: DemoPersistence
  accountsPersistence: DemoPersistence
  sessionPersistence: Persistence<Session>
  /** Ready-made demo services, in place of ones built on `demoPersistence`. */
  demoServices?: Services
}

function isSession(value: unknown): value is Session {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const candidate = value as { workspace?: unknown; userId?: unknown }
  return (
    candidate.workspace === 'demo' ||
    (candidate.workspace === 'account' && typeof candidate.userId === 'string')
  )
}

/**
 * The browser-local provider behind the whole application until the backend
 * exists. It holds two workspaces that never share data: the generated demo,
 * and the accounts created through the simulated sign-up.
 *
 * Sign-up and sign-in here are a simulation for reviewing the screens. No
 * password is stored or verified, so this is not authentication and must
 * never guard real data.
 */
export function createMockBackend(options: MockBackendOptions): Backend {
  const {
    demoPersistence,
    accountsPersistence,
    sessionPersistence,
    demoServices,
    ...mockOptions
  } = options
  const { delayMs = 0, failOperations = new Set<string>() } = mockOptions

  let demo: Services | undefined = demoServices
  let account: { userId: Id; services: Services } | undefined

  async function run<Result>(
    operation: string,
    action: () => Result,
  ): Promise<Result> {
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    } else {
      await Promise.resolve()
    }
    if (failOperations.has(operation)) {
      throw new DomainError('UNAVAILABLE', { operation })
    }
    return action()
  }

  function loadAccounts(): DemoState {
    const stored = accountsPersistence.load()
    return isUsableStoredDemo(stored, { requireCurrentUser: false })
      ? stored.state
      : createEmptyState()
  }

  function start(session: Session): Session {
    sessionPersistence.save(session)
    return session
  }

  return {
    auth: {
      getSession: async () => {
        const stored = sessionPersistence.load()
        if (!isSession(stored)) {
          return null
        }
        if (
          stored.workspace === 'account' &&
          !loadAccounts().users.some((user) => user.id === stored.userId)
        ) {
          sessionPersistence.clear()
          return null
        }
        return stored
      },

      signUp: (input) =>
        run('auth.signUp', () => {
          const state = loadAccounts()
          const details = validateSignUp(input, state.users)
          const user: User = {
            ...details,
            id: `usr-n${state.nextId}`,
            isSuperUser: false,
          }
          accountsPersistence.save({
            version: DATASET_VERSION,
            state: {
              ...state,
              nextId: state.nextId + 1,
              users: [...state.users, user],
            },
          })
          // Services read the workspace once, so they are rebuilt after it changes.
          account = undefined
          return start({ workspace: 'account', userId: user.id })
        }),

      signIn: (input) =>
        run('auth.signIn', () => {
          const email = validateSignIn(input)
          const user = findAccountByEmail(loadAccounts().users, email)
          if (!user) {
            throw new DomainError('ACCOUNT_NOT_FOUND')
          }
          return start({ workspace: 'account', userId: user.id })
        }),

      enterDemo: () =>
        run('auth.enterDemo', () => start({ workspace: 'demo' })),

      signOut: () =>
        run('auth.signOut', () => {
          sessionPersistence.clear()
        }),
    },

    servicesFor(session) {
      if (session.workspace === 'demo') {
        demo ??= createMockServices({
          ...mockOptions,
          persistence: demoPersistence,
        })
        return demo
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
          }),
        }
      }
      return account.services
    },
  }
}
