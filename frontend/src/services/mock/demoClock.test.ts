import { describe, expect, it } from 'vitest'
import {
  createDemoClock,
  DEMO_IDLE_LIMIT_MS,
  DEMO_LIFETIME_MS,
  demoEndReason,
  type StoredDemoClock,
} from './demoClock.ts'
import { createMemoryPersistence } from './persistence.ts'

const START = new Date('2026-10-12T09:00:00.000Z')
const at = (ms: number) => new Date(START.getTime() + ms)
const HOUR = 60 * 60 * 1000

describe('demo clock (D99)', () => {
  it('ends after 3 days, or 12 hours without activity, whichever is first', () => {
    const fresh = { startedAt: START, lastActiveAt: START }
    expect(DEMO_LIFETIME_MS).toBe(72 * HOUR)
    expect(DEMO_IDLE_LIMIT_MS).toBe(12 * HOUR)
    expect(demoEndReason(fresh, at(12 * HOUR - 1))).toBeNull()
    expect(demoEndReason(fresh, at(12 * HOUR))).toBe('idle')

    const busy = { startedAt: START, lastActiveAt: at(71 * HOUR) }
    expect(demoEndReason(busy, at(72 * HOUR - 1))).toBeNull()
    expect(demoEndReason(busy, at(72 * HOUR))).toBe('lifetime')
  })

  it('writes activity down at most once a minute', () => {
    const persistence = createMemoryPersistence<StoredDemoClock>()
    let now = START
    const clock = createDemoClock(persistence, () => now)
    clock.start()

    now = at(59_000)
    clock.touch()
    expect(clock.state()).toMatchObject({ lastActiveAt: START })
    now = at(60_000)
    clock.touch()
    expect(clock.state()).toMatchObject({ lastActiveAt: at(60_000) })
    expect(clock.endsAt()).toEqual(at(72 * HOUR))
  })

  it('remembers why the demo ended, and reads anything else as no clock', () => {
    const persistence = createMemoryPersistence<StoredDemoClock>()
    const clock = createDemoClock(persistence, () => START)
    expect(clock.state()).toEqual({ status: 'none' })
    expect(clock.due()).toBeNull()
    clock.touch()
    expect(clock.state()).toEqual({ status: 'none' })

    clock.end('idle')
    expect(clock.state()).toEqual({ status: 'ended', reason: 'idle' })
    expect(clock.endsAt()).toBeNull()

    for (const stored of [
      'text',
      { startedAt: 'not a date' },
      { reason: 'x' },
    ]) {
      expect(
        createDemoClock(createMemoryPersistence(stored), () => START).state(),
      ).toEqual({ status: 'none' })
    }
  })
})
