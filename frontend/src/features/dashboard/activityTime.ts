import { toLocalDateTime } from '../../domain/eventTime.ts'

export type RelativeDay = 'today' | 'yesterday' | 'other'

/**
 * Whether an instant fell today or yesterday, by the calendar of a time
 * zone. Without one, the viewer's own time zone is used.
 */
export function relativeDay(
  at: Date,
  now: Date,
  timeZone?: string,
): RelativeDay {
  const dayNumber = (instant: Date) => {
    const local =
      timeZone === undefined
        ? {
            year: instant.getFullYear(),
            month: instant.getMonth() + 1,
            day: instant.getDate(),
          }
        : toLocalDateTime(instant, timeZone)
    return Date.UTC(local.year, local.month - 1, local.day) / 86_400_000
  }
  const difference = dayNumber(now) - dayNumber(at)
  return difference === 0 ? 'today' : difference === 1 ? 'yesterday' : 'other'
}
