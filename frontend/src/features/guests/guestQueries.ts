import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query'
import type { GuestInput } from '../../domain/guests.ts'
import type { EventTable, Guest, UnknownRsvp } from '../../domain/models.ts'
import type {
  GuestRsvpInput,
  Services,
  TableWithOccupancy,
} from '../../services/contracts/index.ts'
import { queryKeys } from '../../services/queries.ts'
import { useServices } from '../../services/servicesContext.ts'

const keys = {
  guests: (eventId: string) => ['events', eventId, 'guests'],
  tables: (eventId: string) => ['events', eventId, 'tables'],
  unknown: (eventId: string) => ['events', eventId, 'unknown'],
  rejected: (eventId: string) => ['events', eventId, 'unknown-rejected'],
  guestColumns: ['preferences', 'guestColumns'],
} as const

export function useGuests(eventId: string): UseQueryResult<Guest[]> {
  const { guests } = useServices()
  return useQuery({
    queryKey: keys.guests(eventId),
    queryFn: () => guests.list(eventId),
  })
}

export function useTables(
  eventId: string,
): UseQueryResult<TableWithOccupancy[]> {
  const { tables } = useServices()
  return useQuery({
    queryKey: keys.tables(eventId),
    queryFn: () => tables.list(eventId),
  })
}

export function useUnknownGuests(
  eventId: string,
): UseQueryResult<UnknownRsvp[]> {
  const { unknownGuests } = useServices()
  return useQuery({
    queryKey: keys.unknown(eventId),
    queryFn: () => unknownGuests.list(eventId),
  })
}

export function useRejectedUnknownGuests(
  eventId: string,
): UseQueryResult<UnknownRsvp[]> {
  const { unknownGuests } = useServices()
  return useQuery({
    queryKey: keys.rejected(eventId),
    queryFn: () => unknownGuests.listRejected(eventId),
  })
}

export function useGuestColumns(): UseQueryResult<string[] | null> {
  const { preferences } = useServices()
  return useQuery({
    queryKey: keys.guestColumns,
    queryFn: () => preferences.getGuestColumns(),
  })
}

export function useSetGuestColumns() {
  const { preferences } = useServices()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (columns: readonly string[]) =>
      preferences.setGuestColumns(columns),
    // Shown at once; the stored value follows.
    onMutate: (columns) => {
      queryClient.setQueryData(keys.guestColumns, [...columns])
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: keys.guestColumns }),
  })
}

/**
 * A change to an event's guests. Everything that shows events is refreshed
 * afterwards — this page, the Dashboard, and the cards on My Events — because
 * their figures all derive from the guests.
 */
function useGuestChange<Input, Result>(
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

export function useCreateGuest(eventId: string) {
  return useGuestChange((services, input: GuestInput) =>
    services.guests.create(eventId, input),
  )
}

export function useUpdateGuest(eventId: string) {
  return useGuestChange(
    (services, { guestId, input }: { guestId: string; input: GuestInput }) =>
      services.guests.update(eventId, guestId, input),
  )
}

export function useRemoveGuests(eventId: string) {
  return useGuestChange((services, guestIds: readonly string[]) =>
    services.guests.removeMany(eventId, guestIds),
  )
}

export function useSetGuestRsvp(eventId: string) {
  return useGuestChange(
    (
      services,
      { guestId, input }: { guestId: string; input: GuestRsvpInput },
    ) => services.guests.setRsvp(eventId, guestId, input),
  )
}

export function useAssignTable(eventId: string) {
  return useGuestChange(
    (
      services,
      { guestId, tableId }: { guestId: string; tableId: string | null },
    ) => services.guests.assignTable(eventId, guestId, tableId),
  )
}

export function useImportGuests(eventId: string) {
  return useGuestChange((services, inputs: readonly GuestInput[]) =>
    services.guests.importMany(eventId, inputs),
  )
}

export function useConvertUnknown(eventId: string) {
  return useGuestChange(
    (
      services,
      {
        unknownId,
        input,
      }: { unknownId: string; input: Omit<GuestInput, 'phone'> },
    ) => services.unknownGuests.convertToGuest(eventId, unknownId, input),
  )
}

export function useMergeUnknown(eventId: string) {
  return useGuestChange(
    (
      services,
      { unknownId, guestId }: { unknownId: string; guestId: string },
    ) => services.unknownGuests.mergeIntoGuest(eventId, unknownId, guestId),
  )
}

export function useRejectUnknown(eventId: string) {
  return useGuestChange((services, unknownId: string) =>
    services.unknownGuests.reject(eventId, unknownId),
  )
}

export function useRestoreUnknown(eventId: string) {
  return useGuestChange((services, unknownId: string) =>
    services.unknownGuests.restore(eventId, unknownId),
  )
}

export function tablesOf(
  tables: readonly TableWithOccupancy[] | undefined,
): EventTable[] {
  return (tables ?? []).map(({ table }) => table)
}
