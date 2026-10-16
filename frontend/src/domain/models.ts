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

/**
 * Access offered to an email that has no account yet. It becomes a
 * membership when an account is created with that email.
 */
export interface EventInvitation {
  id: Id
  eventId: Id
  /** Normalized: trimmed and in lower case. */
  email: string
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
  /** How much the background image is enlarged, in percent: 100–300. */
  imageZoom: number
  /**
   * The point of the background image kept in view, in percent from the
   * start (left) and from the top: 0–100 each; 50 is the centre.
   */
  imagePositionX: number
  imagePositionY: number
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

export const VENUE_OBJECT_KINDS = [
  'WALL',
  'STAGE',
  'BAR',
  'STEPS',
  'FOOD_STATION',
  'ENTRANCE',
  'PLANT',
] as const

export type VenueObjectKind = (typeof VENUE_OBJECT_KINDS)[number]

/**
 * Something in the room that is not a table (D100). Sizes and positions are
 * in centimetres; x and y are its centre, from the room's top-left corner.
 */
export interface VenueObject {
  id: Id
  kind: VenueObjectKind
  x: number
  y: number
  width: number
  height: number
  /** Clockwise, in degrees: 0–359. */
  rotation: number
  /** Shown on the object instead of its kind, such as "Dance floor". */
  label: string | null
}

/** Where a table stands in the room: its centre, in centimetres (D100). */
export interface TablePlacement {
  tableId: Id
  x: number
  y: number
  /** Clockwise, in degrees: 0–359. */
  rotation: number
}

/**
 * The event's floor plan (D100): one room with tables placed in it, other
 * objects, and an optional picture of the venue drawn as its floor. A table
 * without a placement is not on the plan yet.
 */
export interface EventLayout {
  eventId: Id
  /** The room's size in centimetres. */
  roomWidth: number
  roomDepth: number
  floorImage: string | null
  /** How see-through the floor picture is, in percent. */
  floorImageTransparency: number
  /** How much the floor picture is enlarged, in percent. */
  floorImageZoom: number
  /** Clockwise, in degrees: −180 to 180. */
  floorImageRotation: number
  placements: TablePlacement[]
  objects: VenueObject[]
  /** Goes up with every save, so a save over someone else's is noticed. */
  version: number
}

export const NOTIFICATION_KINDS = [
  'ACCESS_GRANTED',
  'ROLE_CHANGED',
  'ACCESS_REMOVED',
  'UNKNOWN_RSVP',
] as const

export type NotificationKind = (typeof NOTIFICATION_KINDS)[number]

/** Something that happened to the account, shown under the bell (D95). */
export interface AccountNotification {
  id: Id
  kind: NotificationKind
  /** Null once the event was deleted. */
  eventId: Id | null
  /** The event's name when it happened. */
  eventName: string
  /** Who did it; null when nobody did, e.g. an invitation accepted at sign-up. */
  actorName: string | null
  /** The role given, for access given and a changed role. */
  role: EventRole | null
  createdAt: IsoDateTime
  read: boolean
}
