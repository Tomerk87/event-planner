import type {
  Event,
  EventInvitation,
  EventTable,
  Guest,
  RsvpSettings,
  UnknownRsvp,
  User,
} from '../domain/models.ts'
import type {
  Event as EventRow,
  EventInvitation as InvitationRow,
  EventTable as TableRow,
  Guest as GuestRow,
  RsvpSettings as RsvpSettingsRow,
  UnknownRsvp as UnknownRow,
  User as UserRow,
} from '../generated/prisma/client.ts'
import { imageUrl } from '../storage/image-storage.ts'

/** Database rows as the domain types the rules and the API use. */

function iso(date: Date | null): string | null {
  return date ? date.toISOString() : null
}

export function toUser(row: UserRow): User {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    isSuperUser: row.isSuperUser,
  }
}

export function toEvent(row: EventRow): Event {
  return {
    id: row.id,
    name: row.name,
    startsAt: row.startsAt.toISOString(),
    timeZone: row.timeZone,
    maxAttendees: row.maxAttendees,
    defaultAllowedAttendees: row.defaultAllowedAttendees,
    rsvpLanguage: row.rsvpLanguage,
    location: row.location,
    rsvpTitle: row.rsvpTitle,
    coverImage: row.coverImageKey ? imageUrl(row.coverImageKey) : null,
    rsvpSlug: row.rsvpSlug,
  }
}

export function toInvitation(row: InvitationRow): EventInvitation {
  return { id: row.id, eventId: row.eventId, email: row.email, role: row.role }
}

export function toGuest(row: GuestRow): Guest {
  return {
    id: row.id,
    eventId: row.eventId,
    firstName: row.firstName,
    lastName: row.lastName,
    invitationName: row.invitationName,
    phone: row.phone,
    normalizedPhone: row.normalizedPhone,
    allowedAttendees: row.allowedAttendees,
    confirmedAttendees: row.confirmedAttendees,
    rsvpStatus: row.rsvpStatus,
    invitationSentCount: row.invitationSentCount,
    lastInvitationSentAt: iso(row.lastInvitationSentAt),
    lastRsvpResponseAt: iso(row.lastRsvpResponseAt),
    tableId: row.tableId,
    group: row.group,
    deleted: row.deleted,
  }
}

/** The columns of a domain guest, ready to be written. */
export function guestData(guest: Guest) {
  return {
    firstName: guest.firstName,
    lastName: guest.lastName,
    invitationName: guest.invitationName,
    phone: guest.phone,
    normalizedPhone: guest.normalizedPhone,
    allowedAttendees: guest.allowedAttendees,
    confirmedAttendees: guest.confirmedAttendees,
    rsvpStatus: guest.rsvpStatus,
    invitationSentCount: guest.invitationSentCount,
    lastInvitationSentAt: guest.lastInvitationSentAt
      ? new Date(guest.lastInvitationSentAt)
      : null,
    lastRsvpResponseAt: guest.lastRsvpResponseAt
      ? new Date(guest.lastRsvpResponseAt)
      : null,
    tableId: guest.tableId,
    group: guest.group,
    deleted: guest.deleted,
  }
}

export function toUnknown(row: UnknownRow): UnknownRsvp {
  return {
    id: row.id,
    eventId: row.eventId,
    name: row.name,
    phone: row.phone,
    normalizedPhone: row.normalizedPhone,
    rsvpStatus: row.rsvpStatus as UnknownRsvp['rsvpStatus'],
    confirmedAttendees: row.confirmedAttendees,
    submittedAt: row.submittedAt.toISOString(),
    rejectedAt: iso(row.rejectedAt),
  }
}

export function toTable(row: TableRow): EventTable {
  return {
    id: row.id,
    eventId: row.eventId,
    number: row.number,
    capacity: row.capacity,
    shape: row.shape,
  }
}

/** RSVP settings as stored; the background picture is kept by its key. */
export function rsvpSettingsData(
  settings: RsvpSettings,
  backgroundImageKey: string | null,
) {
  return {
    welcomeMessage: settings.welcomeMessage,
    approvedMessage: settings.approvedMessage,
    declinedMessage: settings.declinedMessage,
    notSureMessage: settings.notSureMessage,
    backgroundImageKey,
    overlayOpacity: settings.overlayOpacity,
    calendarEnabled: settings.calendar.enabled,
    calendarTitle: settings.calendar.title,
    calendarDate: settings.calendar.date,
    calendarTime: settings.calendar.time,
    calendarLocation: settings.calendar.location,
    youtubeEnabled: settings.youtube.enabled,
    youtubeUrl: settings.youtube.url,
  }
}

export function toRsvpSettings(row: RsvpSettingsRow): RsvpSettings {
  return {
    eventId: row.eventId,
    welcomeMessage: row.welcomeMessage,
    approvedMessage: row.approvedMessage,
    declinedMessage: row.declinedMessage,
    notSureMessage: row.notSureMessage,
    backgroundImage: row.backgroundImageKey
      ? imageUrl(row.backgroundImageKey)
      : null,
    overlayOpacity: row.overlayOpacity,
    calendar: {
      enabled: row.calendarEnabled,
      title: row.calendarTitle,
      date: row.calendarDate,
      time: row.calendarTime,
      location: row.calendarLocation,
    },
    youtube: { enabled: row.youtubeEnabled, url: row.youtubeUrl },
  }
}
