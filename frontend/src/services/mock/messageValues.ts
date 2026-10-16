import type { MessageValues } from '../../domain/messages.ts'
import type { Event, Guest, RsvpLanguage } from '../../domain/models.ts'
import { formatDate, formatTime } from '../../i18n/format.ts'

export function publicRsvpUrl(baseUrl: string, event: Event): string {
  return `${baseUrl}/rsvp/${event.rsvpSlug}`
}

/**
 * Values for the message variables of one guest. The date and time are
 * written in the event's own language and time zone, since the guest reads
 * them, not the organizer.
 */
export function messageValuesFor(
  guest: Pick<Guest, 'firstName' | 'lastName'>,
  event: Event,
  baseUrl: string,
): MessageValues {
  const start = new Date(event.startsAt)
  return {
    first_name: guest.firstName,
    last_name: guest.lastName,
    event_name: event.name,
    event_date: formatDate(start, event.rsvpLanguage, event.timeZone),
    event_time: formatTime(start, event.rsvpLanguage, event.timeZone),
    rsvp_url: publicRsvpUrl(baseUrl, event),
  }
}

/** A made-up guest for previewing a message before the event has any. */
export const SAMPLE_GUEST: Record<
  RsvpLanguage,
  Pick<Guest, 'firstName' | 'lastName'>
> = {
  en: { firstName: 'Dana', lastName: 'Levi' },
  he: { firstName: 'דנה', lastName: 'לוי' },
  pt: { firstName: 'Ana', lastName: 'Souza' },
}
