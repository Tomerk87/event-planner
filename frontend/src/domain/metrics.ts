import type {
  Event,
  EventTable,
  Guest,
  Id,
  IsoDateTime,
  MessageSend,
  RsvpResponse,
} from './models.ts'
import { findTableConflicts, type TableConflict } from './seating.ts'

export interface DashboardMetrics {
  totalGuests: number
  invitationsSent: number
  invitationsNotSent: number
  awaitingResponse: number
  rsvpApproved: number
  rsvpNotSure: number
  rsvpDeclined: number
  confirmedAttendees: number
  seatingCapacity: number
  unassignedConfirmedAttendees: number
}

/**
 * Dashboard figures, derived from the records (PRD section 10). Soft-deleted
 * guests are excluded everywhere. Guest counts are counts of invitations;
 * attendee figures are sums of confirmed attendees of Approved guests.
 */
export function computeDashboardMetrics(
  guests: readonly Guest[],
  tables: readonly EventTable[],
): DashboardMetrics {
  const active = guests.filter((guest) => !guest.deleted)
  const approved = active.filter((guest) => guest.rsvpStatus === 'APPROVED')
  const sent = active.filter((guest) => guest.invitationSentCount > 0)
  const attendees = (list: readonly Guest[]) =>
    list.reduce((sum, guest) => sum + (guest.confirmedAttendees ?? 0), 0)

  return {
    totalGuests: active.length,
    invitationsSent: sent.length,
    invitationsNotSent: active.length - sent.length,
    awaitingResponse: sent.filter((guest) => guest.rsvpStatus === 'NO_RESPONSE')
      .length,
    rsvpApproved: approved.length,
    rsvpNotSure: active.filter((guest) => guest.rsvpStatus === 'NOT_SURE')
      .length,
    rsvpDeclined: active.filter((guest) => guest.rsvpStatus === 'DECLINED')
      .length,
    confirmedAttendees: attendees(approved),
    seatingCapacity: tables.reduce((sum, table) => sum + table.capacity, 0),
    unassignedConfirmedAttendees: attendees(
      approved.filter((guest) => guest.tableId === null),
    ),
  }
}

export interface DashboardWarnings {
  /** Confirmed attendees beyond the event maximum; 0 when within it. */
  attendeesOverMaximum: number
  /** Chairs minus the event maximum: positive when above, negative when below. */
  seatingVersusMaximum: number
  tablesOverCapacity: TableConflict[]
  /** Confirmed attendees still waiting for a table. */
  attendeesAwaitingTable: number
}

/** The warnings in PRD section 10.1. None of them blocks saving. */
export function computeDashboardWarnings(
  event: Pick<Event, 'maxAttendees'>,
  metrics: DashboardMetrics,
  guests: readonly Guest[],
  tables: readonly EventTable[],
): DashboardWarnings {
  return {
    attendeesOverMaximum: Math.max(
      0,
      metrics.confirmedAttendees - event.maxAttendees,
    ),
    seatingVersusMaximum: metrics.seatingCapacity - event.maxAttendees,
    tablesOverCapacity: findTableConflicts(tables, guests),
    attendeesAwaitingTable: metrics.unassignedConfirmedAttendees,
  }
}

export type ActivityEntry =
  | {
      kind: 'RSVP'
      guestId: Id
      at: IsoDateTime
      status: RsvpResponse
      confirmedAttendees: number | null
    }
  | { kind: 'INVITATION_SENT'; guestId: Id; at: IsoDateTime }

/**
 * Recent guest activity, newest first, derived from existing records: every
 * recorded send, and each active guest's latest RSVP response. A guest who
 * changed their answer appears once, with the latest answer.
 */
export function deriveRecentActivity(
  guests: readonly Guest[],
  sends: readonly MessageSend[],
  limit: number,
): ActivityEntry[] {
  const activeIds = new Set(
    guests.filter((guest) => !guest.deleted).map((guest) => guest.id),
  )
  const entries: ActivityEntry[] = []

  for (const guest of guests) {
    if (
      !guest.deleted &&
      guest.lastRsvpResponseAt !== null &&
      guest.rsvpStatus !== 'NO_RESPONSE'
    ) {
      entries.push({
        kind: 'RSVP',
        guestId: guest.id,
        at: guest.lastRsvpResponseAt,
        status: guest.rsvpStatus,
        confirmedAttendees: guest.confirmedAttendees,
      })
    }
  }
  for (const send of sends) {
    if (activeIds.has(send.guestId)) {
      entries.push({
        kind: 'INVITATION_SENT',
        guestId: send.guestId,
        at: send.sentAt,
      })
    }
  }

  return entries
    .sort(
      (a, b) => b.at.localeCompare(a.at) || a.guestId.localeCompare(b.guestId),
    )
    .slice(0, limit)
}
