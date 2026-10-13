import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import type { Dashboard } from '../../services/contracts/index.ts'
import { queryKeys } from '../../services/queries.ts'
import { useServices } from '../../services/servicesContext.ts'

/**
 * The event's dashboard figures. The key sits under the event's own, so any
 * change to the event's guests, messages or tables that refreshes the event
 * refreshes these figures too.
 */
export function useDashboard(eventId: string): UseQueryResult<Dashboard> {
  const { dashboard } = useServices()
  return useQuery({
    queryKey: queryKeys.dashboard(eventId),
    queryFn: () => dashboard.get(eventId),
  })
}
