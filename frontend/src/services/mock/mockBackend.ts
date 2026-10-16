import { DomainError, isDomainError } from '../../domain/errors.ts'
import type { Country } from '../../domain/phone.ts'
import type {
  AuthService,
  DemoEndReason,
  DemoTime,
  PublicRsvpService,
  Services,
  Session,
} from '../contracts/index.ts'
import { createDemoClock, type StoredDemoClock } from './demoClock.ts'
import { generateDemoState } from './generator.ts'
import { createMockServices, type MockOptions } from './mockServices.ts'
import {
  createMemoryPersistence,
  type DemoPersistence,
  type Persistence,
} from './persistence.ts'
import { isUsableStoredDemo } from './state.ts'

export interface DemoBackendOptions extends Omit<MockOptions, 'persistence'> {
  demoPersistence: DemoPersistence
  /** Remembers that this browser has the demo open. */
  sessionPersistence: Persistence<Session>
  /** Ready-made demo services, in place of ones built on `demoPersistence`. */
  demoServices?: Services
  /** Where the demo's start and last activity are kept (D99). */
  clockPersistence?: Persistence<StoredDemoClock>
  /**
   * Whose sample events a new demo starts with (D103), asked when one is
   * generated: Brazil's for a visitor using Portuguese. Israel's by default.
   */
  market?: () => Country
}

/** The public demo: open to anyone, with its data kept by each browser. */
export interface DemoBackend {
  auth: Pick<AuthService, 'getSession' | 'enterDemo' | 'signOut'>
  servicesFor(session: Session): Services
  publicRsvp: PublicRsvpService
  onExternalChange(listener: () => void): () => void
  time: DemoTime
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
  const {
    demoPersistence,
    sessionPersistence,
    demoServices,
    clockPersistence = createMemoryPersistence<StoredDemoClock>(),
    market = () => 'IL',
    ...mockOptions
  } = options
  const {
    delayMs = 0,
    failOperations = new Set<string>(),
    now = () => new Date(),
  } = mockOptions
  const clock = createDemoClock(clockPersistence, now)

  let demo: Services | undefined = demoServices
  // Set when a guest's RSVP link belongs to the other market's sample events.
  let marketOverride: Country | null = null
  const marketNow = () => marketOverride ?? market()
  let endedAtStart: DemoEndReason | null = null
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
    if (!demo) {
      const created = createMockServices({
        seed: (at) => generateDemoState(at, marketNow()),
        ...mockOptions,
        persistence: demoPersistence,
      })
      demo = withClock(created)
    }
    return demo
  }

  /** Reset Demo starts the demo's time again; the badge tells its end. */
  function withClock(created: Services): Services {
    const control = created.demo
    return {
      ...created,
      demo: control && {
        ...control,
        // A reset starts from the sample events of the current language.
        reset: async () => {
          marketOverride = null
          await control.reset()
          clock.start()
        },
        getEndsAt: () =>
          run('demo.getEndsAt', () => clock.endsAt()?.toISOString() ?? null),
      },
    }
  }

  const inDemo = () => isDemoSession(sessionPersistence.load())

  /** Whose sample events are stored in this browser, if any. */
  function storedMarket(): Country | null {
    const stored = demoPersistence.load()
    return isUsableStoredDemo(stored) ? (stored.state.market ?? 'IL') : null
  }

  /** Forgets the stored sample events, so the next use generates new ones. */
  function discardData() {
    demoPersistence.clear()
    if (!demoServices) {
      demo = undefined
    }
  }

  // The RSVP links of each market's sample events, worked out once each.
  const slugs = new Map<Country, Set<string>>()
  function slugsOf(country: Country): Set<string> {
    let found = slugs.get(country)
    if (!found) {
      found = new Set(
        generateDemoState(now(), country).events.map((event) => event.rsvpSlug),
      )
      slugs.set(country, found)
    }
    return found
  }

  /**
   * Answers a demo RSVP link. The link may come from the other market's
   * sample events: a guest whose browser is in English opening a link from a
   * Brazilian demo, as from WhatsApp. With no demo open here, this browser
   * switches to those sample events, so the guest gets the page; a demo that
   * is open is never replaced.
   */
  async function answerLink<Result>(
    slug: string,
    answer: (services: Services) => Promise<Result>,
  ): Promise<Result> {
    try {
      return await answer(services())
    } catch (error) {
      const other = (['IL', 'BR'] as const).find(
        (country) => country !== marketNow() && slugsOf(country).has(slug),
      )
      if (
        !isDomainError(error, 'NOT_FOUND') ||
        !other ||
        demoServices ||
        inDemo() ||
        clock.state().status === 'running'
      ) {
        throw error
      }
      marketOverride = other
      discardData()
      return answer(services())
    }
  }

  /**
   * Ends a demo whose time is up (D99): its data, clock and session go, so
   * the next Try Demo starts afresh. Returns why, or null.
   */
  function endIfDue(): DemoEndReason | null {
    const reason = clock.due()
    if (reason) {
      demoPersistence.clear()
      clock.end(reason)
      sessionPersistence.clear()
      // Services made by this backend reload; ready-made ones are kept.
      if (!demoServices) {
        demo = undefined
      }
    }
    return reason
  }

  // A demo opened before the time limits existed starts its clock now.
  if (
    clock.state().status === 'none' &&
    (demoPersistence.load() !== null || inDemo())
  ) {
    clock.start()
  }

  return {
    auth: {
      getSession: async () => {
        const wasInDemo = inDemo()
        const reason = endIfDue()
        // Only a visitor who was in the demo is told it ended.
        if (reason && wasInDemo) {
          endedAtStart = reason
        }
        const stored = sessionPersistence.load()
        return isDemoSession(stored) ? stored : null
      },

      enterDemo: () =>
        run('auth.enterDemo', () => {
          endIfDue()
          if (clock.state().status !== 'running') {
            // A new demo has the sample events of the visitor's language.
            marketOverride = null
            const stored = storedMarket()
            if (stored !== null && stored !== market()) {
              discardData()
            }
            clock.start()
          }
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
      getPublicEvent: (slug) =>
        answerLink(slug, (demo) => demo.rsvp.getPublicEvent(slug)),
      submit: (slug, input) =>
        answerLink(slug, (demo) => demo.rsvp.submit(slug, input)),
    },

    time: {
      check: () => {
        if (!inDemo()) {
          // Another tab may have ended it.
          const state = clock.state()
          return state.status === 'ended' ? state.reason : null
        }
        return endIfDue()
      },
      noteActivity: () => {
        if (inDemo()) {
          clock.touch()
        }
      },
      consumeEndedAtStart: () => {
        const reason = endedAtStart
        endedAtStart = null
        return reason
      },
    },

    onExternalChange(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}
