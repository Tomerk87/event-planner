import { describe, expect, it } from 'vitest'
import { DEFAULT_LIMITS } from '../domain/limits.ts'
import { readDemoSettings } from './demoSettings.ts'

const HOUR = 60 * 60 * 1000

describe('Demo settings (D110)', () => {
  it('takes the defaults when nothing is set', () => {
    expect(readDemoSettings({})).toEqual({
      limits: DEFAULT_LIMITS,
      demo: { events: 10, guestsPerEvent: 3000, storedLength: 4_000_000 },
      time: { lifetimeMs: 72 * HOUR, idleMs: 12 * HOUR },
    })
  })

  it('reads the product’s settings with the VITE_ prefix and the _DEMO suffix, and the demo’s own', () => {
    const settings = readDemoSettings({
      VITE_TABLE_MAX_SEATS_DEMO: '20',
      VITE_IMPORT_MAX_ROWS_DEMO: '500',
      // The product's own name does not count in the demo.
      TABLE_MAX_SEATS: '40',
      VITE_EVENTS_MAX_DEMO: '8',
      VITE_GUESTS_PER_EVENT_MAX_DEMO: '1000',
      VITE_STORAGE_MAX_CHARS_DEMO: '3000000',
      VITE_LIFETIME_DAYS_DEMO: '7',
      VITE_IDLE_HOURS_DEMO: '24',
    })
    expect(settings.limits).toMatchObject({
      tableMaxSeats: 20,
      importMaxRows: 500,
    })
    expect(settings.demo).toEqual({
      events: 8,
      guestsPerEvent: 1000,
      storedLength: 3_000_000,
    })
    expect(settings.time).toEqual({
      lifetimeMs: 7 * 24 * HOUR,
      idleMs: 24 * HOUR,
    })
  })

  it.each([
    [{ VITE_EVENTS_MAX_DEMO: 'ten' }, /VITE_EVENTS_MAX_DEMO/],
    [{ VITE_EVENTS_MAX_DEMO: '0' }, /VITE_EVENTS_MAX_DEMO/],
    [{ VITE_STORAGE_MAX_CHARS_DEMO: '9000000' }, /VITE_STORAGE_MAX_CHARS_DEMO/],
    [{ VITE_LIFETIME_DAYS_DEMO: '1.5' }, /VITE_LIFETIME_DAYS_DEMO/],
    [{ VITE_TABLE_MAX_SEATS_DEMO: '2000' }, /_DEMO suffix.*TABLE_MAX_SEATS/],
  ])('refuses %j, naming the setting', (settings, message) => {
    expect(() => readDemoSettings(settings)).toThrow(message)
  })
})
