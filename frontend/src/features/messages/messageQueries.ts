import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query'
import type { MessageValues } from '../../domain/messages.ts'
import type { MessageTemplate } from '../../domain/models.ts'
import type {
  MessagePreview,
  SentMessage,
} from '../../services/contracts/index.ts'
import { queryKeys } from '../../services/queries.ts'
import { useServices } from '../../services/servicesContext.ts'

// All under the event's own key, so any change to the event refreshes them.
const keys = {
  template: (eventId: string) => ['events', eventId, 'messages', 'template'],
  sends: (eventId: string) => ['events', eventId, 'messages', 'sends'],
  values: (eventId: string, guestId: string | null) => [
    'events',
    eventId,
    'messages',
    'values',
    guestId,
  ],
  preview: (eventId: string, guestId: string) => [
    'events',
    eventId,
    'messages',
    'preview',
    guestId,
  ],
} as const

export function useMessageTemplate(
  eventId: string,
): UseQueryResult<MessageTemplate> {
  const { messages } = useServices()
  return useQuery({
    queryKey: keys.template(eventId),
    queryFn: () => messages.getTemplate(eventId),
  })
}

export function useSentMessages(
  eventId: string,
): UseQueryResult<SentMessage[]> {
  const { messages } = useServices()
  return useQuery({
    queryKey: keys.sends(eventId),
    queryFn: () => messages.listSends(eventId),
  })
}

/** What the variables stand for, for one guest or for a sample one. */
export function useMessageValues(
  eventId: string,
  guestId: string | null,
  enabled: boolean,
): UseQueryResult<MessageValues> {
  const { messages } = useServices()
  return useQuery({
    queryKey: keys.values(eventId, guestId),
    queryFn: () => messages.getValues(eventId, guestId),
    enabled,
  })
}

/** The saved message for one guest with its WhatsApp link; null when closed. */
export function useSendPreview(
  eventId: string,
  guestId: string | null,
): UseQueryResult<MessagePreview> {
  const { messages } = useServices()
  return useQuery({
    queryKey: keys.preview(eventId, guestId ?? ''),
    queryFn: () => messages.preview(eventId, guestId ?? ''),
    enabled: guestId !== null,
    // Always the message as it is now, never one prepared earlier.
    gcTime: 0,
  })
}

function useRefreshEvents() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: queryKeys.events })
}

export function useSaveTemplate(eventId: string) {
  const { messages } = useServices()
  const refresh = useRefreshEvents()
  return useMutation({
    mutationFn: (body: string) => messages.updateTemplate(eventId, body),
    onSuccess: refresh,
  })
}

export function useDefaultTemplate(eventId: string) {
  const { messages } = useServices()
  return useMutation({
    mutationFn: () => messages.getDefaultTemplate(eventId),
  })
}

/** A send changes the guest's counter, so the event's figures reload. */
export function useSendMessage(eventId: string) {
  const { messages } = useServices()
  const refresh = useRefreshEvents()
  return useMutation({
    mutationFn: (guestId: string) => messages.send(eventId, guestId),
    onSettled: refresh,
  })
}
