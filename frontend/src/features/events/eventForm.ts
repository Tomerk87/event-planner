import type { TFunction } from 'i18next'
import { isDomainError } from '../../domain/errors.ts'
import {
  fromLocalDateTime,
  isValidTimeZone,
  toLocalDateTime,
} from '../../domain/eventTime.ts'
import { EVENT_LIMITS } from '../../domain/events.ts'
import type { IsoDateTime, RsvpLanguage } from '../../domain/models.ts'

/** The form's fields, as typed. */
export interface EventFormValues {
  name: string
  date: string
  time: string
  timeZone: string
  maxAttendees: string
  defaultAllowedAttendees: string
  rsvpLanguage: RsvpLanguage
  location: string
  /** The event's photo, or null for the generated cover. */
  coverImage: string | null
}

export type EventFormField =
  'name' | 'startsAt' | 'timeZone' | 'maxAttendees' | 'defaultAllowedAttendees'

export type EventFormErrors = Partial<
  Record<EventFormField, 'invalid' | 'past'>
>

const FALLBACK_TIME_ZONE = 'UTC'

export function browserTimeZone(): string {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  return isValidTimeZone(timeZone) ? timeZone : FALLBACK_TIME_ZONE
}

/** Every time zone the browser knows, always including the given one. */
/** A time zone as people read it: "America/New_York" as "America/New York". */
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

export function defaultEventFormValues(timeZone: string): EventFormValues {
  return {
    name: '',
    date: '',
    time: '',
    timeZone,
    maxAttendees: String(EVENT_LIMITS.maxAttendees.default),
    defaultAllowedAttendees: String(EVENT_LIMITS.allowedAttendees.default),
    rsvpLanguage: 'en',
    location: '',
    coverImage: null,
  }
}

/** Whole numbers only; anything else fails the range check that follows. */
export function toInteger(value: string): number {
  return /^\d+$/.test(value.trim()) ? Number(value.trim()) : Number.NaN
}

function isInRange(value: number, range: { min: number; max: number }) {
  return Number.isInteger(value) && value >= range.min && value <= range.max
}

/** What is wrong with the form as typed; empty when it can be saved. */
export function validateEventForm(
  values: EventFormValues,
  startsAt: IsoDateTime | null,
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
  if (!isInRange(toInteger(values.maxAttendees), EVENT_LIMITS.maxAttendees)) {
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
    return t('events.form.errors.maxAttendees', EVENT_LIMITS.maxAttendees)
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
