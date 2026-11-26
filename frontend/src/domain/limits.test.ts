import { afterEach, describe, expect, it } from 'vitest'
import { DomainError } from './errors.ts'
import { EVENT_LIMITS } from './events.ts'
import {
  DEFAULT_LIMITS,
  limits,
  readLimits,
  setLimits,
  type Limits,
} from './limits.ts'
import { TABLE_LIMITS, validateTableInput } from './seating.ts'

const settings =
  (values: Record<string, string>) =>
  (name: string): string | undefined =>
    values[name]

function withLimits(change: Partial<Limits>): Limits {
  return { ...DEFAULT_LIMITS, ...change }
}

afterEach(() => {
  setLimits(DEFAULT_LIMITS)
})

describe('Adjustable limits (D110)', () => {
  it('takes the defaults when nothing is set', () => {
    expect(readLimits(settings({}))).toEqual(DEFAULT_LIMITS)
    expect(DEFAULT_LIMITS).toEqual({
      tableMaxSeats: 30,
      eventMaxAttendees: { min: 50, max: 3000, default: 50 },
      guestMaxAttendees: { max: 10, default: 5 },
      importMaxRows: 5000,
      importMaxFileMb: 5,
      imageMaxFileMb: 5,
    })
  })

  it('reads each setting by its name, over the default', () => {
    expect(
      readLimits(
        settings({
          TABLE_MAX_SEATS: '40',
          EVENT_MAX_ATTENDEES_MIN: '20',
          EVENT_MAX_ATTENDEES_MAX: ' 500 ',
          EVENT_MAX_ATTENDEES_DEFAULT: '100',
          GUEST_MAX_ATTENDEES_MAX: '12',
          GUEST_MAX_ATTENDEES_DEFAULT: '4',
          IMPORT_MAX_ROWS: '800',
          IMPORT_MAX_FILE_MB: '2',
          IMAGE_MAX_FILE_MB: '8',
        }),
      ),
    ).toEqual({
      tableMaxSeats: 40,
      eventMaxAttendees: { min: 20, max: 500, default: 100 },
      guestMaxAttendees: { max: 12, default: 4 },
      importMaxRows: 800,
      importMaxFileMb: 2,
      imageMaxFileMb: 8,
    })
  })

  it.each([
    [{ TABLE_MAX_SEATS: 'thirty' }, /TABLE_MAX_SEATS must be a whole number/],
    [{ TABLE_MAX_SEATS: '0' }, /TABLE_MAX_SEATS/],
    [{ TABLE_MAX_SEATS: '1001' }, /TABLE_MAX_SEATS/],
    [{ EVENT_MAX_ATTENDEES_DEFAULT: '4000' }, /EVENT_MAX_ATTENDEES/],
    [
      { EVENT_MAX_ATTENDEES_MIN: '600', EVENT_MAX_ATTENDEES_MAX: '500' },
      /EVENT_MAX_ATTENDEES/,
    ],
    [{ GUEST_MAX_ATTENDEES_DEFAULT: '11' }, /GUEST_MAX_ATTENDEES/],
    [{ GUEST_MAX_ATTENDEES_MAX: '101' }, /GUEST_MAX_ATTENDEES/],
    [{ IMPORT_MAX_ROWS: '2.5' }, /IMPORT_MAX_ROWS/],
    [{ IMPORT_MAX_FILE_MB: '51' }, /IMPORT_MAX_FILE_MB/],
    [{ IMAGE_MAX_FILE_MB: '0' }, /IMAGE_MAX_FILE_MB/],
  ])('refuses %j, saying which setting is wrong', (values, message) => {
    expect(() => readLimits(settings(values))).toThrow(message)
  })

  it('refuses limits that break the rules when put in force', () => {
    expect(() =>
      setLimits(withLimits({ guestMaxAttendees: { max: 3, default: 5 } })),
    ).toThrow(/GUEST_MAX_ATTENDEES/)
    expect(limits()).toEqual(DEFAULT_LIMITS)
  })

  it('makes the rules follow the limits in force', () => {
    const input = { number: 1, capacity: 40, shape: 'CIRCLE' as const }
    let refused: unknown
    try {
      validateTableInput(input, [], null)
    } catch (error) {
      refused = error
    }
    expect(refused).toBeInstanceOf(DomainError)

    setLimits(
      withLimits({
        tableMaxSeats: 40,
        eventMaxAttendees: { min: 10, max: 200, default: 20 },
        guestMaxAttendees: { max: 6, default: 2 },
      }),
    )
    expect(validateTableInput(input, [], null).capacity).toBe(40)
    expect(TABLE_LIMITS.capacity).toEqual({ min: 1, max: 40 })
    expect(EVENT_LIMITS.maxAttendees).toEqual({
      min: 10,
      max: 200,
      default: 20,
    })
    expect(EVENT_LIMITS.allowedAttendees).toEqual({
      min: 1,
      max: 6,
      default: 2,
    })
  })
})
