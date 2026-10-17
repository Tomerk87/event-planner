import type { TFunction } from 'i18next'
import { isDomainError } from '../../domain/errors.ts'
import {
  fromLocalDateTime,
  isValidTimeZone,
  toLocalDateTime,
} from '../../domain/eventTime.ts'
import { EVENT_LIMITS } from '../../domain/events.ts'
import type { IsoDateTime, RsvpLanguage } from '../../domain/models.ts'
import type { Country } from '../../domain/phone.ts'
import { LOCALES, type Language } from '../../i18n/languages.ts'
import { TIME_ZONE_COUNTRIES } from '../../shared/timeZoneCountries.ts'
import { withoutError } from '../../shared/formErrors.ts'

/** The form's fields, as typed. */
export interface EventFormValues {
  name: string
  date: string
  time: string
  timeZone: string
  maxAttendees: string
  defaultAllowedAttendees: string
  rsvpLanguage: RsvpLanguage
  country: Country
  location: string
  /** The event's photo, or null for the generated cover. */
  coverImage: string | null
}

export type EventFormField =
  'name' | 'startsAt' | 'timeZone' | 'maxAttendees' | 'defaultAllowedAttendees'

export type EventFormErrors = Partial<
  Record<EventFormField, 'invalid' | 'past'>
>

/** The error each form field shows; the date and time share one. */
const ERROR_OF: Partial<Record<keyof EventFormValues, EventFormField>> = {
  name: 'name',
  date: 'startsAt',
  time: 'startsAt',
  timeZone: 'timeZone',
  maxAttendees: 'maxAttendees',
  defaultAllowedAttendees: 'defaultAllowedAttendees',
}

/**
 * The errors once a field has been edited: its message goes (D104), and
 * saving checks it again.
 */
export function clearEventFormError(
  errors: EventFormErrors,
  field: keyof EventFormValues,
): EventFormErrors {
  const shown = ERROR_OF[field]
  return shown ? withoutError(errors, shown) : errors
}

const FALLBACK_TIME_ZONE = 'UTC'

export function browserTimeZone(): string {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  return isValidTimeZone(timeZone) ? timeZone : FALLBACK_TIME_ZONE
}

/** Every time zone the browser knows, always including the given one. */
/** A time zone as people read it: "America/New_York" as "America/New York". */
/**
 * A time zone's choice in a list: its name with its country in the
 * interface language ("America/Sao Paulo · Brazil"), and the country's
 * English name as extra search words, so it is found by country in any
 * language (D104).
 */
export function timeZoneChoice(
  timeZone: string,
  language: Language,
): { label: string; keywords: string } {
  const label = timeZoneLabel(timeZone)
  const code = TIME_ZONE_COUNTRIES[timeZone]
  if (!code) {
    return { label, keywords: '' }
  }
  const country = countryName(code, LOCALES[language])
  return {
    label: country ? `${label} · ${country}` : label,
    keywords: countryName(code, 'en-US') ?? '',
  }
}

function countryName(code: string, locale: string): string | undefined {
  try {
    return new Intl.DisplayNames([locale], { type: 'region' }).of(code)
  } catch {
    return undefined
  }
}

export function timeZoneLabel(timeZone: string): string {
  return timeZone.replaceAll('_', ' ')
}

export function listTimeZones(include: string): string[] {
  const supported =
    typeof Intl.supportedValuesOf === 'function'
      ? Intl.supportedValuesOf('timeZone')
      : []
  return [...new Set([include, FALLBACK_TIME_ZONE, ...supported])].sort()
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

/** The date and time fields showing an instant in a time zone. */
export function toDateAndTime(
  instant: Date,
  timeZone: string,
): Pick<EventFormValues, 'date' | 'time'> {
  const local = toLocalDateTime(instant, timeZone)
  return {
    date: `${local.year}-${pad(local.month)}-${pad(local.day)}`,
    time: `${pad(local.hour)}:${pad(local.minute)}`,
  }
}

/** The instant the date and time fields mean in a time zone, if complete. */
export function toStartsAt(
  date: string,
  time: string,
  timeZone: string,
): IsoDateTime | null {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(time)
  if (!dateMatch || !timeMatch || !isValidTimeZone(timeZone)) {
    return null
  }
  const instant = fromLocalDateTime(
    {
      year: Number(dateMatch[1]),
      month: Number(dateMatch[2]),
      day: Number(dateMatch[3]),
      hour: Number(timeMatch[1]),
      minute: Number(timeMatch[2]),
    },
    timeZone,
  )
  return Number.isNaN(instant.getTime()) ? null : instant.toISOString()
}

/**
 * A new event's fields. An organizer using Portuguese gets an event in
 * Brazil with its RSVP page in Portuguese (D103); otherwise Israel and
 * English, as before.
 */
export function defaultEventFormValues(
  timeZone: string,
  language: Language = 'en',
): EventFormValues {
  const brazilian = language === 'pt'
  return {
    name: '',
    date: '',
    time: '',
    timeZone,
    maxAttendees: String(EVENT_LIMITS.maxAttendees.default),
    defaultAllowedAttendees: String(EVENT_LIMITS.allowedAttendees.default),
    rsvpLanguage: brazilian ? 'pt' : 'en',
    country: brazilian ? 'BR' : 'IL',
    location: '',
    coverImage: null,
  }
}

/**
 * The earliest date and time an event may start, as the date and time
 * fields write them, in the event's time zone: the next minute. Null when
 * the time zone is not known.
 */
export function earliestStart(
  timeZone: string,
  now: Date = new Date(),
): { date: string; time: string } | null {
  if (!isValidTimeZone(timeZone)) {
    return null
  }
  const next = toLocalDateTime(new Date(now.getTime() + 60_000), timeZone)
  return {
    date: `${next.year}-${pad(next.month)}-${pad(next.day)}`,
    time: `${pad(next.hour)}:${pad(next.minute)}`,
  }
}

/** Whether the typed date and time are complete and not in the future. */
export function isTypedStartPast(
  values: Pick<EventFormValues, 'date' | 'time' | 'timeZone'>,
  now: Date = new Date(),
): boolean {
  const startsAt = toStartsAt(values.date, values.time, values.timeZone)
  return startsAt !== null && new Date(startsAt).getTime() <= now.getTime()
}

/** Whole numbers only; anything else fails the range check that follows. */
export function toInteger(value: string): number {
  return /^\d+$/.test(value.trim()) ? Number(value.trim()) : Number.NaN
}

interface Range {
  min: number
  max: number
}

/**
 * A whole number typed outside its range, brought back to the nearest end
 * of it, as when the field is left; anything else is kept as typed.
 */
export function clampToRange(value: string, range: Range): string {
  const number = toInteger(value)
  if (!Number.isInteger(number)) {
    return value
  }
  return String(Math.min(Math.max(number, range.min), range.max))
}

function isInRange(value: number, range: Range) {
  return Number.isInteger(value) && value >= range.min && value <= range.max
}

/** What is wrong with the form as typed; empty when it can be saved. */
export function validateEventForm(
  values: EventFormValues,
  startsAt: IsoDateTime | null,
  maxAttendeesRange: Range = EVENT_LIMITS.maxAttendees,
): EventFormErrors {
  const errors: EventFormErrors = {}
  if (values.name.trim() === '') {
    errors.name = 'invalid'
  }
  if (startsAt === null) {
    errors.startsAt = 'invalid'
  } else if (new Date(startsAt).getTime() <= Date.now()) {
    errors.startsAt = 'past'
  }
  if (!isInRange(toInteger(values.maxAttendees), maxAttendeesRange)) {
    errors.maxAttendees = 'invalid'
  }
  if (
    !isInRange(
      toInteger(values.defaultAllowedAttendees),
      EVENT_LIMITS.allowedAttendees,
    )
  ) {
    errors.defaultAllowedAttendees = 'invalid'
  }
  return errors
}

/** The message shown under a field, or undefined when the field is fine. */
export function eventFormErrorMessage(
  t: TFunction,
  errors: EventFormErrors,
  field: EventFormField,
  maxAttendeesRange: Range = EVENT_LIMITS.maxAttendees,
): string | undefined {
  const error = errors[field]
  if (error === undefined) {
    return undefined
  }
  if (field === 'startsAt') {
    return t(
      error === 'past'
        ? 'events.form.errors.startsAtPast'
        : 'events.form.errors.startsAt',
    )
  }
  if (field === 'maxAttendees') {
    return t('events.form.errors.maxAttendees', { ...maxAttendeesRange })
  }
  if (field === 'defaultAllowedAttendees') {
    return t(
      'events.form.errors.defaultAllowedAttendees',
      EVENT_LIMITS.allowedAttendees,
    )
  }
  return t(`events.form.errors.${field}`)
}

function isFormField(value: unknown): value is EventFormField {
  return (
    value === 'name' ||
    value === 'startsAt' ||
    value === 'timeZone' ||
    value === 'maxAttendees' ||
    value === 'defaultAllowedAttendees'
  )
}

/** The field a rejected save points at, if it names one of this form's. */
export function fieldErrorOf(error: unknown): EventFormErrors | null {
  if (
    !isDomainError(error, 'VALIDATION') ||
    !isFormField(error.details.field)
  ) {
    return null
  }
  return {
    [error.details.field]: error.details.reason === 'past' ? 'past' : 'invalid',
  }
}
