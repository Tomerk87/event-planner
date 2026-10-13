import { describe, expect, it } from 'vitest'
import { relativeDay } from './activityTime.ts'

const ZONE = 'Asia/Jerusalem'
// 12 October 2026, 09:00 in Jerusalem (UTC+3).
const NOW = new Date('2026-10-12T06:00:00.000Z')

describe('relativeDay', () => {
  it.each([
    ['earlier the same day', '2026-10-11T21:30:00.000Z', 'today'],
    ['the same moment', '2026-10-12T06:00:00.000Z', 'today'],
    ['late the day before', '2026-10-11T20:59:00.000Z', 'yesterday'],
    ['early the day before', '2026-10-10T21:00:00.000Z', 'yesterday'],
    ['two days before', '2026-10-10T20:59:00.000Z', 'other'],
    ['long before', '2025-01-01T00:00:00.000Z', 'other'],
    ['the day after', '2026-10-12T21:00:00.000Z', 'other'],
  ] as const)('is right for %s', (_, at, expected) => {
    expect(relativeDay(new Date(at), NOW, ZONE)).toBe(expected)
  })

  it('goes by the calendar of the given time zone, not the instant', () => {
    const at = new Date('2026-10-11T22:00:00.000Z')

    expect(relativeDay(at, NOW, 'Asia/Jerusalem')).toBe('today')
    expect(relativeDay(at, NOW, 'UTC')).toBe('yesterday')
  })

  it('crosses a month and a year boundary', () => {
    expect(
      relativeDay(
        new Date('2026-12-31T12:00:00.000Z'),
        new Date('2027-01-01T12:00:00.000Z'),
        'UTC',
      ),
    ).toBe('yesterday')
  })

  it('uses the viewer’s own calendar when no time zone is given', () => {
    const now = new Date(2026, 9, 12, 9, 0)

    expect(relativeDay(new Date(2026, 9, 12, 0, 5), now)).toBe('today')
    expect(relativeDay(new Date(2026, 9, 11, 23, 55), now)).toBe('yesterday')
    expect(relativeDay(new Date(2026, 9, 10, 23, 55), now)).toBe('other')
  })
})
