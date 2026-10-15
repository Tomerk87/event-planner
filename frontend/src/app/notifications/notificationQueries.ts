import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query'
import type { NotificationList } from '../../services/contracts/index.ts'
import { useServices } from '../../services/servicesContext.ts'

const KEY = ['notifications'] as const
/** How often the bell looks for news while the page stays open (D95). */
const REFRESH_MS = 60_000

export function useNotifications(): UseQueryResult<NotificationList> {
  const { notifications } = useServices()
  return useQuery({
    queryKey: KEY,
    queryFn: () => notifications.list(),
    refetchInterval: REFRESH_MS,
    refetchOnWindowFocus: true,
  })
}

/** Marks one notice read, or all of them without an id. */
export function useMarkNotificationsRead() {
  const { notifications } = useServices()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id?: string) => notifications.markRead(id),
    onSettled: () => queryClient.invalidateQueries({ queryKey: KEY }),
  })
}
