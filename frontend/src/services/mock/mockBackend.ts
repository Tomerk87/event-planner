import { DomainError } from '../../domain/errors.ts'
import type {
  AuthService,
  PublicRsvpService,
  Services,
  Session,
} from '../contracts/index.ts'
import { createMockServices, type MockOptions } from './mockServices.ts'
import type { DemoPersistence, Persistence } from './persistence.ts'

export interface DemoBackendOptions extends Omit<MockOptions, 'persistence'> {
  demoPersistence: DemoPersistence
  /** Remembers that this browser has the demo open. */
  sessionPersistence: Persistence<Session>
  /** Ready-made demo services, in place of ones built on `demoPersistence`. */
  demoServices?: Services
}

/** The public demo: open to anyone, with its data kept by each browser. */
export interface DemoBackend {
  auth: Pick<AuthService, 'getSession' | 'enterDemo' | 'signOut'>
  servicesFor(session: Session): Services
  publicRsvp: PublicRsvpService
  onExternalChange(listener: () => void): () => void
}

function isDemoSession(value: unknown): value is Session {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { workspace?: unknown }).workspace === 'demo'
  )
}

/**
 * Demo Mode's provider: the generated demo dataset, kept in the visitor's
 * browser. It has no accounts and makes no network request.
 */
export function createDemoBackend(options: DemoBackendOptions): DemoBackend {
  const { demoPersistence, sessionPersistence, demoServices, ...mockOptions } =
    options
  const { delayMs = 0, failOperations = new Set<string>() } = mockOptions

  let demo: Services | undefined = demoServices
  const listeners = new Set<() => void>()
  demoPersistence.onChange?.(() => listeners.forEach((listener) => listener()))

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

  function services(): Services {
    demo ??= createMockServices({
      ...mockOptions,
      persistence: demoPersistence,
    })
    return demo
  }

  return {
    auth: {
      getSession: async () => {
        const stored = sessionPersistence.load()
        return isDemoSession(stored) ? stored : null
      },

      enterDemo: () =>
        run('auth.enterDemo', () => {
          const session: Session = { workspace: 'demo' }
          sessionPersistence.save(session)
          return session
        }),

      signOut: () =>
        run('auth.signOut', () => {
          sessionPersistence.clear()
        }),
    },

    servicesFor: () => services(),

    // The public operations check no role, so they need no session.
    publicRsvp: {
      getPublicEvent: (slug) => services().rsvp.getPublicEvent(slug),
      submit: (slug, input) => services().rsvp.submit(slug, input),
    },

    onExternalChange(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}
