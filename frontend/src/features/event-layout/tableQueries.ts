import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { TableInput } from '../../domain/seating.ts'
import type { Services } from '../../services/contracts/index.ts'
import { queryKeys } from '../../services/queries.ts'
import { useServices } from '../../services/servicesContext.ts'

/**
 * A change to an event's tables. Everything that shows events is refreshed
 * afterwards, because the Dashboard and the Guests page derive figures and
 * choices from the tables.
 */
function useTableChange<Input, Result>(
  change: (services: Services, input: Input) => Promise<Result>,
) {
  const services = useServices()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: Input) => change(services, input),
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.events }),
  })
}

export function useCreateTable(eventId: string) {
  return useTableChange((services, input: TableInput) =>
    services.tables.create(eventId, input),
  )
}

export function useUpdateTable(eventId: string) {
  return useTableChange(
    (services, { tableId, input }: { tableId: string; input: TableInput }) =>
      services.tables.update(eventId, tableId, input),
  )
}

export function useRemoveTable(eventId: string) {
  return useTableChange((services, tableId: string) =>
    services.tables.remove(eventId, tableId),
  )
}
