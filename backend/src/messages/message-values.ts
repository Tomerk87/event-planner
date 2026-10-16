import type { MessageValues } from '../domain/messages.ts'
import type { Event, Guest, RsvpLanguage } from '../domain/models.ts'

/**
 * The server's copy of `frontend/src/services/mock/messageValues.ts`, so a
 * message is worded the same in the demo and in the real application.
 */

const LOCALES: Record<RsvpLanguage, string> = {
  en: 'en-US',
  he: 'he-IL',
  pt: 'pt-BR',
}

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
  const locale = LOCALES[event.rsvpLanguage]
  return {
    first_name: guest.firstName,
    last_name: guest.lastName,
    event_name: event.name,
    event_date: new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      timeZone: event.timeZone,
    }).format(start),
    event_time: new Intl.DateTimeFormat(locale, {
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
      timeZone: event.timeZone,
    }).format(start),
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
