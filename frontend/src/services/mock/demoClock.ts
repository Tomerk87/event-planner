import type { IsoDateTime } from '../../domain/models.ts'
import type { DemoEndReason } from '../contracts/index.ts'
import type { Persistence } from './persistence.ts'

/**
 * How long a demo lasts (D99): three days after it started, or twelve
 * hours after the visitor last did something in it, whichever comes first.
 */
export const DEMO_LIFETIME_MS = 3 * 24 * 60 * 60 * 1000
export const DEMO_IDLE_LIMIT_MS = 12 * 60 * 60 * 1000
/** Activity is written down at most this often. */
const ACTIVITY_STEP_MS = 60 * 1000

/** What this browser keeps about its demo's time. */
export type StoredDemoClock =
  | { startedAt: IsoDateTime; lastActiveAt: IsoDateTime }
  /** The demo ended; kept so its other open tabs learn why. */
  | { endedAt: IsoDateTime; reason: DemoEndReason }

export type DemoClockState =
  | { status: 'none' }
  | { status: 'running'; startedAt: Date; lastActiveAt: Date }
  | { status: 'ended'; reason: DemoEndReason }

function isDate(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value))
}

function read(stored: unknown): DemoClockState {
  if (typeof stored !== 'object' || stored === null) {
    return { status: 'none' }
  }
  const clock = stored as Record<string, unknown>
  if (isDate(clock['startedAt']) && isDate(clock['lastActiveAt'])) {
    return {
      status: 'running',
      startedAt: new Date(clock['startedAt']),
      lastActiveAt: new Date(clock['lastActiveAt']),
    }
  }
  if (clock['reason'] === 'lifetime' || clock['reason'] === 'idle') {
    return { status: 'ended', reason: clock['reason'] }
  }
  return { status: 'none' }
}

/** Why a running demo is over at `now`, or null while it is not. */
export function demoEndReason(
  clock: { startedAt: Date; lastActiveAt: Date },
  now: Date,
): DemoEndReason | null {
  if (now.getTime() - clock.startedAt.getTime() >= DEMO_LIFETIME_MS) {
    return 'lifetime'
  }
  if (now.getTime() - clock.lastActiveAt.getTime() >= DEMO_IDLE_LIMIT_MS) {
    return 'idle'
  }
  return null
}

export interface DemoClock {
  state(): DemoClockState
  /** A new demo starts now. */
  start(): void
  /** The visitor did something; written at most once a minute. */
  touch(): void
  /** Why the running demo is over, or null; it changes nothing. */
  due(): DemoEndReason | null
  /** Records that the demo ended, for its other tabs. */
  end(reason: DemoEndReason): void
  /** When the demo ends at the latest: three days after it started. */
  endsAt(): Date | null
}

export function createDemoClock(
  persistence: Persistence<StoredDemoClock>,
  now: () => Date,
): DemoClock {
  const state = () => read(persistence.load())

  return {
    state,

    start() {
      const at = now().toISOString()
      persistence.save({ startedAt: at, lastActiveAt: at })
    },

    touch() {
      const current = state()
      if (
        current.status === 'running' &&
        now().getTime() - current.lastActiveAt.getTime() >= ACTIVITY_STEP_MS
      ) {
        persistence.save({
          startedAt: current.startedAt.toISOString(),
          lastActiveAt: now().toISOString(),
        })
      }
    },

    due() {
      const current = state()
      return current.status === 'running' ? demoEndReason(current, now()) : null
    },

    end(reason) {
      persistence.save({ endedAt: now().toISOString(), reason })
    },

    endsAt() {
      const current = state()
      return current.status === 'running'
        ? new Date(current.startedAt.getTime() + DEMO_LIFETIME_MS)
        : null
    },
  }
}
