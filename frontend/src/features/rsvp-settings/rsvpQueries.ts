import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query'
import type { EventInput } from '../../domain/events.ts'
import type { Event, RsvpSettings } from '../../domain/models.ts'
import type { RsvpSettingsInput } from '../../services/contracts/index.ts'
import { queryKeys } from '../../services/queries.ts'
import { useServices } from '../../services/servicesContext.ts'

// Under the event's own key, so any change to the event refreshes it.
const settingsKey = (eventId: string) => ['events', eventId, 'rsvp', 'settings']

export function useRsvpSettings(eventId: string): UseQueryResult<RsvpSettings> {
  const { rsvp } = useServices()
  return useQuery({
    queryKey: settingsKey(eventId),
    queryFn: () => rsvp.getSettings(eventId),
  })
}

interface SaveInput {
  settings: RsvpSettingsInput
  /** The event's details, when the RSVP language or title changed. */
  event: EventInput | null
}

/**
 * Saves the page in one step. The RSVP language and title belong to the
 * event, so they are saved through it.
 */
export function useSaveRsvpSettings(eventId: string) {
  const { rsvp, events } = useServices()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      settings,
      event,
    }: SaveInput): Promise<{
      settings: RsvpSettings
      event: Event | null
    }> => ({
      event: event ? await events.update(eventId, event) : null,
      settings: await rsvp.updateSettings(eventId, settings),
    }),
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.events }),
  })
}
