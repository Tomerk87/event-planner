import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import type { VenueSpace } from '../../domain/venues.ts'
import type {
  VenueEventSummary,
  VenueWorkspace,
} from '../../services/contracts/index.ts'
import { useServices } from '../../services/servicesContext.ts'

export const venueKeys = {
  workspaces: ['venues'],
  workspace: (organizationId: string) => ['venues', organizationId],
  spaces: (organizationId: string) => ['venues', organizationId, 'spaces'],
  events: (organizationId: string) => ['venues', organizationId, 'events'],
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
): UseQueryResult<VenueSpace[]> {
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
    enabled: venues !== null,
  })
}
