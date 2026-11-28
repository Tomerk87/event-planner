import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { TableInput } from '../../domain/seating.ts'
import type {
  Services,
  TableChangeOptions,
} from '../../services/contracts/index.ts'
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
    // Seating and tables open and close the venue's notices (D122).
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.events }),
        queryClient.invalidateQueries({ queryKey: ['venues', 'notices'] }),
      ]),
  })
}

export function useCreateTable(eventId: string) {
  return useTableChange((services, input: TableInput) =>
    services.tables.create(eventId, input),
  )
}

export function useUpdateTable(eventId: string) {
  return useTableChange(
    (
      services,
      {
        tableId,
        input,
        options,
      }: { tableId: string; input: TableInput; options?: TableChangeOptions },
    ) => services.tables.update(eventId, tableId, input, options),
  )
}

export function useRemoveTable(eventId: string) {
  return useTableChange(
    (
      services,
      { tableId, options }: { tableId: string; options?: TableChangeOptions },
    ) => services.tables.remove(eventId, tableId, options),
  )
}
