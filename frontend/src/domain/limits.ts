/**
 * The product's adjustable limits (D110), set from outside the code: the
 * server's settings for the product, the build's _DEMO settings for the
 * demo. Each side applies them once at start with `setLimits`; the rules and
 * the screens read the current values through `limits()`.
 */
export interface Limits {
  /** Chairs at one table. */
  tableMaxSeats: number
  /** An event's Maximum Attendees: the lowest, the highest, a new event's. */
  eventMaxAttendees: { min: number; max: number; default: number }
  /**
   * Maximum Attendees per Guest, the people one invitation may confirm: the
   * highest that can be chosen, and a new event's.
   */
  guestMaxAttendees: { max: number; default: number }
  /** Rows in one guest import. */
  importMaxRows: number
  /** Size of an imported guest file, in megabytes. */
  importMaxFileMb: number
  /** Size of a chosen picture, in megabytes, before it is reduced. */
  imageMaxFileMb: number
}

export const DEFAULT_LIMITS: Limits = {
  tableMaxSeats: 30,
  eventMaxAttendees: { min: 50, max: 3000, default: 50 },
  guestMaxAttendees: { max: 10, default: 5 },
  importMaxRows: 5000,
  importMaxFileMb: 5,
  imageMaxFileMb: 5,
}

/**
 * The most each limit may be set to: what the database accepts, and what
 * the screens and the browser can carry.
 */
export const LIMIT_CEILINGS = {
  tableMaxSeats: 1000,
  eventMaxAttendees: 100_000,
  guestMaxAttendees: 100,
  importMaxRows: 100_000,
  fileMb: 50,
} as const

/** The setting that sets each limit (without the demo's prefix and suffix). */
export const LIMIT_SETTINGS = {
  tableMaxSeats: 'TABLE_MAX_SEATS',
  eventMaxAttendeesMin: 'EVENT_MAX_ATTENDEES_MIN',
  eventMaxAttendeesMax: 'EVENT_MAX_ATTENDEES_MAX',
  eventMaxAttendeesDefault: 'EVENT_MAX_ATTENDEES_DEFAULT',
  guestMaxAttendeesMax: 'GUEST_MAX_ATTENDEES_MAX',
  guestMaxAttendeesDefault: 'GUEST_MAX_ATTENDEES_DEFAULT',
  importMaxRows: 'IMPORT_MAX_ROWS',
  importMaxFileMb: 'IMPORT_MAX_FILE_MB',
  imageMaxFileMb: 'IMAGE_MAX_FILE_MB',
} as const

let current: Limits = DEFAULT_LIMITS

/** The limits in force. */
export function limits(): Limits {
  return current
}

/** Puts limits in force, after checking them. */
export function setLimits(next: Limits): void {
  const problem = limitsProblem(next)
  if (problem) {
    throw new Error(problem)
  }
  current = next
}

/** A sentence saying what is wrong with the limits, or null. */
export function limitsProblem(next: Limits): string | null {
  const whole = (value: number, low: number, high: number) =>
    Number.isInteger(value) && value >= low && value <= high
  const { eventMaxAttendees: event, guestMaxAttendees: guest } = next
  if (!whole(next.tableMaxSeats, 1, LIMIT_CEILINGS.tableMaxSeats)) {
    return `TABLE_MAX_SEATS must be a whole number from 1 to ${LIMIT_CEILINGS.tableMaxSeats}`
  }
  if (
    !whole(event.min, 1, LIMIT_CEILINGS.eventMaxAttendees) ||
    !whole(event.max, event.min, LIMIT_CEILINGS.eventMaxAttendees) ||
    !whole(event.default, event.min, event.max)
  ) {
    return `EVENT_MAX_ATTENDEES_MIN ≤ EVENT_MAX_ATTENDEES_DEFAULT ≤ EVENT_MAX_ATTENDEES_MAX must hold, whole numbers from 1 to ${LIMIT_CEILINGS.eventMaxAttendees}`
  }
  if (
    !whole(guest.max, 1, LIMIT_CEILINGS.guestMaxAttendees) ||
    !whole(guest.default, 1, guest.max)
  ) {
    return `GUEST_MAX_ATTENDEES_DEFAULT ≤ GUEST_MAX_ATTENDEES_MAX must hold, whole numbers from 1 to ${LIMIT_CEILINGS.guestMaxAttendees}`
  }
  if (!whole(next.importMaxRows, 1, LIMIT_CEILINGS.importMaxRows)) {
    return `IMPORT_MAX_ROWS must be a whole number from 1 to ${LIMIT_CEILINGS.importMaxRows}`
  }
  if (!whole(next.importMaxFileMb, 1, LIMIT_CEILINGS.fileMb)) {
    return `IMPORT_MAX_FILE_MB must be a whole number from 1 to ${LIMIT_CEILINGS.fileMb}`
  }
  if (!whole(next.imageMaxFileMb, 1, LIMIT_CEILINGS.fileMb)) {
    return `IMAGE_MAX_FILE_MB must be a whole number from 1 to ${LIMIT_CEILINGS.fileMb}`
  }
  return null
}

/**
 * Reads the limits from settings, each defaulting to DEFAULT_LIMITS when not
 * set. `setting` returns a setting's text by its name in LIMIT_SETTINGS; the
 * server reads the environment, the demo its _DEMO build settings. Throws on
 * a value that is not a whole number or breaks the rules above.
 */
export function readLimits(
  setting: (name: string) => string | undefined,
): Limits {
  const number = (name: string, fallback: number): number => {
    const raw = setting(name)?.trim()
    if (!raw) {
      return fallback
    }
    const value = Number(raw)
    if (!Number.isInteger(value)) {
      throw new Error(`${name} must be a whole number: "${raw}"`)
    }
    return value
  }
  const names = LIMIT_SETTINGS
  const read: Limits = {
    tableMaxSeats: number(names.tableMaxSeats, DEFAULT_LIMITS.tableMaxSeats),
    eventMaxAttendees: {
      min: number(
        names.eventMaxAttendeesMin,
        DEFAULT_LIMITS.eventMaxAttendees.min,
      ),
      max: number(
        names.eventMaxAttendeesMax,
        DEFAULT_LIMITS.eventMaxAttendees.max,
      ),
      default: number(
        names.eventMaxAttendeesDefault,
        DEFAULT_LIMITS.eventMaxAttendees.default,
      ),
    },
    guestMaxAttendees: {
      max: number(
        names.guestMaxAttendeesMax,
        DEFAULT_LIMITS.guestMaxAttendees.max,
      ),
      default: number(
        names.guestMaxAttendeesDefault,
        DEFAULT_LIMITS.guestMaxAttendees.default,
      ),
    },
    importMaxRows: number(names.importMaxRows, DEFAULT_LIMITS.importMaxRows),
    importMaxFileMb: number(
      names.importMaxFileMb,
      DEFAULT_LIMITS.importMaxFileMb,
    ),
    imageMaxFileMb: number(names.imageMaxFileMb, DEFAULT_LIMITS.imageMaxFileMb),
  }
  const problem = limitsProblem(read)
  if (problem) {
    throw new Error(problem)
  }
  return read
}

/** Megabytes as bytes. */
export function megabytes(value: number): number {
  return value * 1024 * 1024
}
