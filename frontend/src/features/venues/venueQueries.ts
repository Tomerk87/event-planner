import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import type {
  SpaceDetails,
  ClientInvitationView,
  ClientTeamView,
  TemplateDetails,
  VenueEventPeople,
  SpaceSummary,
  VenueEventSummary,
  VenueTeam,
  VenueWorkspace,
} from '../../services/contracts/index.ts'
import { useServices } from '../../services/servicesContext.ts'

export const venueKeys = {
  workspaces: ['venues'],
  workspace: (organizationId: string) => ['venues', organizationId],
  spaces: (organizationId: string) => ['venues', organizationId, 'spaces'],
  events: (organizationId: string) => ['venues', organizationId, 'events'],
  space: (organizationId: string, spaceId: string) => [
    'venues',
    organizationId,
    'spaces',
    spaceId,
  ],
  team: (organizationId: string) => ['venues', organizationId, 'team'],
  people: (organizationId: string, eventId: string) => [
    'venues',
    organizationId,
    'events',
    eventId,
    'people',
  ],
  clientInvitation: (token: string) => ['venues', 'client-invitations', token],
  clientTeam: (eventId: string) => ['venues', 'client-team', eventId],
  template: (organizationId: string, templateId: string) => [
    'venues',
    organizationId,
    'templates',
    templateId,
  ],
} as const

/**
 * The venues the user belongs to (V2.2); none when this deployment has no
 * venues (`VITE_VENUES_ENABLED`, D116).
 */
export function useVenueWorkspaces(): UseQueryResult<VenueWorkspace[]> {
  const { venues } = useServices()
  return useQuery({
    queryKey: venueKeys.workspaces,
    queryFn: () => venues?.listWorkspaces() ?? [],
  })
}

export function useVenueWorkspace(
  organizationId: string,
): UseQueryResult<VenueWorkspace> {
  const { venues } = useServices()
  return useQuery({
    queryKey: venueKeys.workspace(organizationId),
    queryFn: () => {
      if (!venues) {
        throw new Error('venues are off')
      }
      return venues.getWorkspace(organizationId)
    },
    enabled: venues !== null,
  })
}

export function useVenueSpaces(
  organizationId: string,
): UseQueryResult<SpaceSummary[]> {
  const { venues } = useServices()
  return useQuery({
    queryKey: venueKeys.spaces(organizationId),
    queryFn: () => venues?.listSpaces(organizationId) ?? [],
    enabled: venues !== null,
  })
}

export function useVenueEvents(
  organizationId: string,
): UseQueryResult<VenueEventSummary[]> {
  const { venues } = useServices()
  return useQuery({
    queryKey: venueKeys.events(organizationId),
    queryFn: () => venues?.listEvents(organizationId) ?? [],
    // An empty id means "not a venue's page": nothing to load.
    enabled: venues !== null && organizationId !== '',
  })
}

export function useVenueSpace(
  organizationId: string,
  spaceId: string,
): UseQueryResult<SpaceDetails> {
  const { venues } = useServices()
  return useQuery({
    queryKey: venueKeys.space(organizationId, spaceId),
    queryFn: () => {
      if (!venues) {
        throw new Error('venues are off')
      }
      return venues.getSpace(organizationId, spaceId)
    },
    enabled: venues !== null,
  })
}

export function useVenueTeam(
  organizationId: string,
): UseQueryResult<VenueTeam> {
  const { venues } = useServices()
  return useQuery({
    queryKey: venueKeys.team(organizationId),
    queryFn: () => {
      if (!venues) {
        throw new Error('venues are off')
      }
      return venues.getTeam(organizationId)
    },
    enabled: venues !== null,
  })
}

export function useVenueTemplate(
  organizationId: string,
  templateId: string,
): UseQueryResult<TemplateDetails> {
  const { venues } = useServices()
  return useQuery({
    queryKey: venueKeys.template(organizationId, templateId),
    queryFn: () => {
      if (!venues) {
        throw new Error('venues are off')
      }
      return venues.getTemplate(organizationId, templateId)
    },
    enabled: venues !== null,
  })
}

export function useVenueEventPeople(
  organizationId: string,
  eventId: string,
): UseQueryResult<VenueEventPeople> {
  const { venues } = useServices()
  return useQuery({
    queryKey: venueKeys.people(organizationId, eventId),
    queryFn: () => {
      if (!venues) {
        throw new Error('venues are off')
      }
      return venues.getEventPeople(organizationId, eventId)
    },
    enabled: venues !== null,
  })
}

export function useClientInvitation(
  token: string,
): UseQueryResult<ClientInvitationView> {
  const { venues } = useServices()
  return useQuery({
    queryKey: venueKeys.clientInvitation(token),
    queryFn: () => {
      if (!venues) {
        throw new Error('venues are off')
      }
      return venues.getClientInvitation(token)
    },
    enabled: venues !== null,
    retry: false,
  })
}

/** The client side's team for its Permissions page (#15). */
export function useClientTeam(eventId: string): UseQueryResult<ClientTeamView> {
  const { venues } = useServices()
  return useQuery({
    queryKey: venueKeys.clientTeam(eventId),
    queryFn: () => {
      if (!venues) {
        throw new Error('venues are off')
      }
      return venues.getClientTeam(eventId)
    },
    enabled: venues !== null,
  })
}
