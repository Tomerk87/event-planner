import type { Event } from './models.ts'

export interface LocalDateTime {
  year: number
  month: number
  day: number
  hour: number
  minute: number
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone })
    return true
  } catch {
    return false
  }
}

/** The wall-clock date and time of an instant in a time zone. */
export function toLocalDateTime(
  instant: Date,
  timeZone: string,
): LocalDateTime {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(instant)
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value)

  return {
    year: read('year'),
    month: read('month'),
    day: read('day'),
    hour: read('hour'),
    minute: read('minute'),
  }
}

function asUtcMs(local: LocalDateTime): number {
  return Date.UTC(
    local.year,
    local.month - 1,
    local.day,
    local.hour,
    local.minute,
  )
}

function offsetMs(utcMs: number, timeZone: string): number {
  const truncated = utcMs - (utcMs % 60_000)
  return asUtcMs(toLocalDateTime(new Date(truncated), timeZone)) - truncated
}

/**
 * The instant at which a wall-clock date and time occurs in a time zone.
 * Two passes are needed because the offset itself depends on the instant
 * (daylight saving time).
 */
export function fromLocalDateTime(
  local: LocalDateTime,
  timeZone: string,
): Date {
  const wallClock = asUtcMs(local)
  const firstGuess = wallClock - offsetMs(wallClock, timeZone)
  return new Date(wallClock - offsetMs(firstGuess, timeZone))
}

/**
 * An event is past from the instant it starts. From then on it is read-only
 * for every role and its public RSVP is closed.
 */
export function isEventPast(
  event: Pick<Event, 'startsAt'>,
  now: Date,
): boolean {
  return now.getTime() >= new Date(event.startsAt).getTime()
}
