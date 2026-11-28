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

/**
 * Where a floor plan comes from and goes to (D100): an event's own layout, or
 * a venue's layout template (V2.2, Phase 26). The plan editor works on
 * either, without knowing which.
 */
export interface LayoutSource {
  /** The stored plan; undefined while it loads. */
  layout: EventLayout | undefined
  error: unknown
  isError: boolean
  /** Reads the stored plan again, such as after a refused save. */
  reload: () => Promise<EventLayout | undefined>
  save: (input: LayoutInput) => Promise<unknown>
  saving: boolean
}

/** The floor plan of an event. */
export function useEventLayoutSource(eventId: string): LayoutSource {
  const layout = useLayout(eventId)
  const save = useSaveLayout(eventId)
  return {
    layout: layout.data,
    error: layout.error,
    isError: layout.isError,
    reload: async () => (await layout.refetch()).data,
    save: (input) => save.mutateAsync(input),
    saving: save.isPending,
  }
}
