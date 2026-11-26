import { readLimits, type Limits } from '../domain/limits.ts'
import { DEFAULT_DEMO_TIME, type DemoTimeLimits } from './mock/demoClock.ts'
import { DEMO_LIMITS, type DemoLimits } from './mock/mockServices.ts'

/**
 * The demo's settings (D110), read when the site is built, since the demo
 * has no server. Each is the product's setting with the build's prefix and a
 * _DEMO suffix (VITE_TABLE_MAX_SEATS_DEMO), plus the demo's own:
 *
 *   VITE_EVENTS_MAX_DEMO            events a demo holds (10)
 *   VITE_GUESTS_PER_EVENT_MAX_DEMO  guests in one demo event (3000)
 *   VITE_STORAGE_MAX_CHARS_DEMO     characters of stored data (4,000,000)
 *   VITE_LIFETIME_DAYS_DEMO         days a demo lasts (3)
 *   VITE_IDLE_HOURS_DEMO            hours without activity before it ends (12)
 *
 * Anything not set takes its default; a bad value stops the application, so
 * a typo is not taken silently.
 */
export interface DemoSettings {
  /** The product's limits, as the demo applies them. */
  limits: Limits
  /** What one visitor's demo may hold (D109). */
  demo: DemoLimits
  /** How long a demo lasts (D99). */
  time: DemoTimeLimits
}

type BuildSettings = Readonly<Record<string, string | boolean | undefined>>

const HOUR_MS = 60 * 60 * 1000

/** The name of a demo setting, from the product setting's. */
export function demoSettingName(name: string): string {
  return `VITE_${name}_DEMO`
}

function wholeNumber(
  settings: BuildSettings,
  name: string,
  fallback: number,
  [low, high]: [number, number],
): number {
  const full = demoSettingName(name)
  const raw = settings[full]
  const text = typeof raw === 'string' ? raw.trim() : ''
  if (!text) {
    return fallback
  }
  const value = Number(text)
  if (!Number.isInteger(value) || value < low || value > high) {
    throw new Error(
      `${full} must be a whole number from ${low} to ${high}: "${text}"`,
    )
  }
  return value
}

export function readDemoSettings(settings: BuildSettings = {}): DemoSettings {
  let limits: Limits
  try {
    limits = readLimits((name) => {
      const raw = settings[demoSettingName(name)]
      return typeof raw === 'string' ? raw : undefined
    })
  } catch (error) {
    // The shared check names the product's settings; say which ones these are.
    throw new Error(
      `In the demo's settings (each with the VITE_ prefix and the _DEMO suffix): ${(error as Error).message}`,
    )
  }
  return {
    limits,
    demo: {
      events: wholeNumber(settings, 'EVENTS_MAX', DEMO_LIMITS.events, [1, 100]),
      guestsPerEvent: wholeNumber(
        settings,
        'GUESTS_PER_EVENT_MAX',
        DEMO_LIMITS.guestsPerEvent,
        [1, 100_000],
      ),
      // Browsers keep about 5 million characters for a site.
      storedLength: wholeNumber(
        settings,
        'STORAGE_MAX_CHARS',
        DEMO_LIMITS.storedLength,
        [500_000, 5_000_000],
      ),
    },
    time: {
      lifetimeMs:
        wholeNumber(
          settings,
          'LIFETIME_DAYS',
          DEFAULT_DEMO_TIME.lifetimeMs / (24 * HOUR_MS),
          [1, 365],
        ) *
        24 *
        HOUR_MS,
      idleMs:
        wholeNumber(
          settings,
          'IDLE_HOURS',
          DEFAULT_DEMO_TIME.idleMs / HOUR_MS,
          [1, 24 * 365],
        ) * HOUR_MS,
    },
  }
}
