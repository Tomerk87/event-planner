import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query'
import type { LayoutInput } from '../../domain/layout.ts'
import type { EventLayout } from '../../domain/models.ts'
import { useServices } from '../../services/servicesContext.ts'

/**
 * Under the event's own key, so a change to its tables, which refreshes
 * everything about events, refreshes the floor plan too.
 */
export const layoutKey = (eventId: string) => ['events', eventId, 'layout']

export function useLayout(eventId: string): UseQueryResult<EventLayout> {
  const { layout } = useServices()
  return useQuery({
    queryKey: layoutKey(eventId),
    queryFn: () => layout.get(eventId),
  })
}

export function useSaveLayout(eventId: string) {
  const { layout } = useServices()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: LayoutInput) => layout.save(eventId, input),
    onSuccess: (saved) => queryClient.setQueryData(layoutKey(eventId), saved),
  })
}
