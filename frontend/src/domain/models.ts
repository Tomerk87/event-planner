import type { EventRole } from './roles.ts'

export type Id = string

/** An instant in time as an ISO 8601 string in UTC. */
export type IsoDateTime = string

export type RsvpLanguage = 'en' | 'he'

export const RSVP_STATUSES = [
  'NO_RESPONSE',
  'APPROVED',
  'NOT_SURE',
  'DECLINED',
] as const

export type RsvpStatus = (typeof RSVP_STATUSES)[number]

/** A status a guest can choose; NO_RESPONSE is only ever the initial state. */
export type RsvpResponse = Exclude<RsvpStatus, 'NO_RESPONSE'>

export const TABLE_SHAPES = ['CIRCLE', 'RECTANGLE', 'SQUARE'] as const

export type TableShape = (typeof TABLE_SHAPES)[number]

export interface User {
  id: Id
  name: string
  email: string
  /** System-level permission; set only in the database, never through the UI. */
  isSuperUser: boolean
}

export interface Event {
  id: Id
  name: string
  startsAt: IsoDateTime
  /** IANA time zone the event's date and time are expressed in. */
  timeZone: string
  maxAttendees: number
  defaultAllowedAttendees: number
  rsvpLanguage: RsvpLanguage
  location: string | null
  /** Short title shown on the public RSVP page; falls back to the name. */
  rsvpTitle: string | null
  coverImage: string | null
  /** Identifier in the single public RSVP address shared by all guests. */
  rsvpSlug: string
}

export interface EventMembership {
  eventId: Id
  userId: Id
  role: EventRole
}

/** One invitation (a party), which may stand for several attendees. */
export interface Guest {
  id: Id
  eventId: Id
  firstName: string
  lastName: string
  /** The name the guest typed on the RSVP form; never overwrites the above. */
  invitationName: string | null
  phone: string
  normalizedPhone: string
  allowedAttendees: number
  confirmedAttendees: number | null
  rsvpStatus: RsvpStatus
  invitationSentCount: number
  lastInvitationSentAt: IsoDateTime | null
  lastRsvpResponseAt: IsoDateTime | null
  tableId: Id | null
  /** The organizer's own grouping, such as "Family"; unrelated to seating. */
  group: string | null
  /** Soft-delete marker; persisted as `deleted = 1` in the database. */
  deleted: boolean
}

/** An RSVP whose phone matched no active guest, awaiting organizer review. */
export interface UnknownRsvp {
  id: Id
  eventId: Id
  name: string
  phone: string
  normalizedPhone: string
  rsvpStatus: RsvpResponse
  confirmedAttendees: number | null
  submittedAt: IsoDateTime
  /**
   * When an organizer rejected the response; null while it awaits review. A
   * rejected response is kept, out of the review list, and can be restored.
   */
  rejectedAt: IsoDateTime | null
}

export interface RsvpSettings {
  eventId: Id
  welcomeMessage: string
  approvedMessage: string
  declinedMessage: string
  notSureMessage: string
  backgroundImage: string | null
  /** Darkening of the background image, 0–100. */
  overlayOpacity: number
  /** The calendar entry offered after approval; its own date and time. */
  calendar: {
    enabled: boolean
    title: string
    /** `YYYY-MM-DD`, in the event's time zone. */
    date: string
    /** `HH:mm`, in the event's time zone. */
    time: string
    location: string
  }
  youtube: { enabled: boolean; url: string }
}

export interface MessageTemplate {
  eventId: Id
  body: string
}

/** One WhatsApp send initiated from the system (not a confirmed delivery). */
export interface MessageSend {
  id: Id
  eventId: Id
  guestId: Id
  sentAt: IsoDateTime
  message: string
}

export interface EventTable {
  id: Id
  eventId: Id
  number: number
  capacity: number
  shape: TableShape
}
