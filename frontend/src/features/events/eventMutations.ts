import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { EventInput } from '../../domain/events.ts'
import type { DuplicateEventInput } from '../../services/contracts/index.ts'
import { queryKeys } from '../../services/queries.ts'
import { useServices } from '../../services/servicesContext.ts'

/** Each change to the set of events reloads every list that shows them. */
function useRefreshEvents() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: queryKeys.events })
}

export function useCreateEvent() {
  const { events } = useServices()
  const refresh = useRefreshEvents()
  return useMutation({
    mutationFn: (input: EventInput) => events.create(input),
    onSuccess: refresh,
  })
}

export function useDuplicateEvent(eventId: string) {
  const { events } = useServices()
  const refresh = useRefreshEvents()
  return useMutation({
    mutationFn: (input: DuplicateEventInput) =>
      events.duplicate(eventId, input),
    onSuccess: refresh,
  })
}

export function useDeleteEvent(eventId: string) {
  const { events } = useServices()
  const refresh = useRefreshEvents()
  return useMutation({
    mutationFn: () => events.remove(eventId),
    onSuccess: refresh,
  })
}

/** Waits for the reload, so the page shows the saved event when it settles. */
export function useUpdateEvent(eventId: string) {
  const { events } = useServices()
  const refresh = useRefreshEvents()
  return useMutation({
    mutationFn: (input: EventInput) => events.update(eventId, input),
    onSuccess: refresh,
  })
}
