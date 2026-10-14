import { DomainError } from './errors.ts'
import { toLocalDateTime } from './eventTime.ts'
import type { Event, RsvpSettings } from './models.ts'

export const RSVP_MESSAGE_MAX_LENGTH = 500
export const RSVP_TITLE_MAX_LENGTH = 80
export const CALENDAR_TEXT_MAX_LENGTH = 120
/** A stored background image, as a data address; about 500 KB of picture. */
export const BACKGROUND_IMAGE_MAX_LENGTH = 700_000
/** How long the calendar entry lasts; the event has no end time of its own. */
const CALENDAR_HOURS = 3

const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'youtu.be',
])

type Settings = Omit<RsvpSettings, 'eventId'>
type Calendar = RsvpSettings['calendar']

const pad = (value: number) => String(value).padStart(2, '0')

/** Only a secure YouTube address is offered to guests as a link. */
export function isYouTubeUrl(url: string): boolean {
  try {
    const parsed = new URL(url.trim())
    return parsed.protocol === 'https:' && YOUTUBE_HOSTS.has(parsed.hostname)
  } catch {
    return false
  }
}

function parseDate(date: string): [number, number, number] | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  if (!match) {
    return null
  }
  const [year, month, day] = [
    Number(match[1]),
    Number(match[2]),
    Number(match[3]),
  ]
  const check = new Date(Date.UTC(year, month - 1, day))
  return check.getUTCMonth() === month - 1 && check.getUTCDate() === day
    ? [year, month, day]
    : null
}

function parseTime(time: string): [number, number] | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time)
  return match ? [Number(match[1]), Number(match[2])] : null
}

/** The calendar date and time a new event's calendar entry starts with. */
export function calendarStartOf(
  event: Pick<Event, 'startsAt' | 'timeZone'>,
): Pick<Calendar, 'date' | 'time'> {
  const local = toLocalDateTime(new Date(event.startsAt), event.timeZone)
  return {
    date: `${local.year}-${pad(local.month)}-${pad(local.day)}`,
    time: `${pad(local.hour)}:${pad(local.minute)}`,
  }
}

/**
 * Checks and tidies RSVP settings; throws VALIDATION naming the field.
 * The calendar and YouTube details are only checked while their action is on,
 * so a half-filled action can be switched off and saved.
 */
export function validateRsvpSettings(input: Settings): Settings {
  const messages = {
    welcomeMessage: input.welcomeMessage,
    approvedMessage: input.approvedMessage,
    declinedMessage: input.declinedMessage,
    notSureMessage: input.notSureMessage,
  }
  for (const [field, text] of Object.entries(messages)) {
    if (text.length > RSVP_MESSAGE_MAX_LENGTH) {
      throw new DomainError('VALIDATION', {
        field,
        max: RSVP_MESSAGE_MAX_LENGTH,
      })
    }
  }
  if (
    !Number.isInteger(input.overlayOpacity) ||
    input.overlayOpacity < 0 ||
    input.overlayOpacity > 100
  ) {
    throw new DomainError('VALIDATION', {
      field: 'overlayOpacity',
      min: 0,
      max: 100,
    })
  }
  if (
    input.backgroundImage !== null &&
    (!/^data:image\/(jpeg|png);base64,/.test(input.backgroundImage) ||
      input.backgroundImage.length > BACKGROUND_IMAGE_MAX_LENGTH)
  ) {
    throw new DomainError('VALIDATION', { field: 'backgroundImage' })
  }

  const calendar: Calendar = {
    enabled: input.calendar.enabled,
    title: input.calendar.title.trim(),
    date: input.calendar.date,
    time: input.calendar.time,
    location: input.calendar.location.trim(),
  }
  if (
    calendar.title.length > CALENDAR_TEXT_MAX_LENGTH ||
    (calendar.enabled && calendar.title === '')
  ) {
    throw new DomainError('VALIDATION', { field: 'calendarTitle' })
  }
  if (calendar.location.length > CALENDAR_TEXT_MAX_LENGTH) {
    throw new DomainError('VALIDATION', { field: 'calendarLocation' })
  }
  if (calendar.enabled && !parseDate(calendar.date)) {
    throw new DomainError('VALIDATION', { field: 'calendarDate' })
  }
  if (calendar.enabled && !parseTime(calendar.time)) {
    throw new DomainError('VALIDATION', { field: 'calendarTime' })
  }

  const youtube = {
    enabled: input.youtube.enabled,
    url: input.youtube.url.trim(),
  }
  if (youtube.enabled && !isYouTubeUrl(youtube.url)) {
    throw new DomainError('VALIDATION', { field: 'youtubeUrl' })
  }

  return {
    ...messages,
    backgroundImage: input.backgroundImage,
    overlayOpacity: input.overlayOpacity,
    calendar,
    youtube,
  }
}

/**
 * The address that opens Google Calendar with the entry filled in, or null
 * when the date or time is not usable. Times are wall-clock times in the
 * event's time zone.
 */
export function buildGoogleCalendarUrl(
  calendar: Calendar,
  timeZone: string,
): string | null {
  const date = parseDate(calendar.date)
  const time = parseTime(calendar.time)
  if (!date || !time) {
    return null
  }
  const start = Date.UTC(date[0], date[1] - 1, date[2], time[0], time[1])
  const stamp = (ms: number) => {
    const at = new Date(ms)
    return (
      `${at.getUTCFullYear()}${pad(at.getUTCMonth() + 1)}${pad(at.getUTCDate())}` +
      `T${pad(at.getUTCHours())}${pad(at.getUTCMinutes())}00`
    )
  }
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: calendar.title,
    dates: `${stamp(start)}/${stamp(start + CALENDAR_HOURS * 3_600_000)}`,
    ctz: timeZone,
  })
  if (calendar.location !== '') {
    params.set('location', calendar.location)
  }
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}
