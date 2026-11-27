import { DomainError } from '../../domain/errors.ts'
import { isEventPast } from '../../domain/eventTime.ts'
import { computeDashboardMetrics } from '../../domain/metrics.ts'
import type { Id } from '../../domain/models.ts'
import {
  invitationExpiresAt,
  venueCan,
  venueEventStatus,
  type VenueAction,
} from '../../domain/venues.ts'
import type {
  VenueEventSummary,
  VenuesService,
  VenueWorkspace,
} from '../contracts/index.ts'
import type { DemoState } from './state.ts'

/** What the venue operations need from the demo provider they belong to. */
export interface MockVenueContext {
  state: () => DemoState
  run: <Result>(operation: string, action: () => Result) => Promise<Result>
  currentUserId: () => Id
  now: () => Date
}

/**
 * The venue operations of the demo (V2.2). They apply the same rules the
 * backend will: only a member reaches a venue, and anything else is "not
 * found", so a venue's existence is not revealed (D116).
 */
export function createMockVenues(context: MockVenueContext): VenuesService {
  const { run, now } = context

  function workspaces(): VenueWorkspace[] {
    const state = context.state()
    const userId = context.currentUserId()
    return (state.venueMembers ?? [])
      .filter((member) => member.userId === userId)
      .flatMap((member) => {
        const organization = state.organizations?.find(
          (candidate) => candidate.id === member.organizationId,
        )
        return organization ? [{ organization, role: member.role }] : []
      })
      .sort((a, b) => a.organization.name.localeCompare(b.organization.name))
  }

  /** The user's membership of a venue, checked for an action. */
  function authorize(organizationId: Id, action: VenueAction): VenueWorkspace {
    const workspace = workspaces().find(
      (candidate) => candidate.organization.id === organizationId,
    )
    if (!workspace) {
      throw new DomainError('NOT_FOUND', { entity: 'venue' })
    }
    if (!venueCan(workspace.role, action)) {
      throw new DomainError('FORBIDDEN', { action })
    }
    return workspace
  }

  function spacesOf(organizationId: Id) {
    return (context.state().venueSpaces ?? []).filter(
      (space) => space.organizationId === organizationId,
    )
  }

  return {
    listWorkspaces: () => run('venues.listWorkspaces', workspaces),

    getWorkspace: (organizationId) =>
      run('venues.getWorkspace', () => authorize(organizationId, 'VIEW_VENUE')),

    listSpaces: (organizationId) =>
      run('venues.listSpaces', () => {
        authorize(organizationId, 'VIEW_VENUE')
        return spacesOf(organizationId).sort((a, b) =>
          a.name.localeCompare(b.name),
        )
      }),

    listEvents: (organizationId) =>
      run('venues.listEvents', () => {
        authorize(organizationId, 'VIEW_VENUE')
        const state = context.state()
        const at = now()
        const spaces = spacesOf(organizationId)
        const summaries: VenueEventSummary[] = []
        for (const venueEvent of state.venueEvents ?? []) {
          const event = state.events.find(
            (candidate) => candidate.id === venueEvent.eventId,
          )
          const space = spaces.find(
            (candidate) => candidate.id === venueEvent.spaceId,
          )
          if (
            venueEvent.organizationId !== organizationId ||
            !event ||
            !space
          ) {
            continue
          }
          const { client } = venueEvent
          summaries.push({
            event,
            space: { id: space.id, name: space.name },
            status: venueEventStatus(venueEvent, event, at),
            client: client && { name: client.name, email: client.email },
            invitationSentAt: client?.sentAt ?? null,
            invitationExpiresAt:
              client && client.acceptedAt === null
                ? invitationExpiresAt(client).toISOString()
                : null,
            confirmedAttendees: computeDashboardMetrics(
              state.guests.filter((guest) => guest.eventId === event.id),
              [],
            ).confirmedAttendees,
            isPast: isEventPast(event, at),
          })
        }
        // Upcoming soonest first, then past most recent first.
        return summaries.sort((a, b) =>
          a.isPast === b.isPast
            ? (a.isPast ? -1 : 1) *
              a.event.startsAt.localeCompare(b.event.startsAt)
            : a.isPast
              ? 1
              : -1,
        )
      }),
  }
}
