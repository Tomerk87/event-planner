import { toLocalDateTime } from '../../domain/eventTime.ts'

export type RelativeDay = 'today' | 'yesterday' | 'other'

/** Whether an instant fell today or yesterday, by the calendar of a time zone. */
export function relativeDay(
  at: Date,
  now: Date,
  timeZone: string,
): RelativeDay {
  const dayNumber = (instant: Date) => {
    const local = toLocalDateTime(instant, timeZone)
    return Date.UTC(local.year, local.month - 1, local.day) / 86_400_000
  }
  const difference = dayNumber(now) - dayNumber(at)
  return difference === 0 ? 'today' : difference === 1 ? 'yesterday' : 'other'
}
