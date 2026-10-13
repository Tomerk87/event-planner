import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query'
import type { User } from '../domain/models.ts'
import type {
  DemoRole,
  EventAccessInfo,
  EventSummary,
} from './contracts/index.ts'
import { useServices } from './servicesContext.ts'

/**
 * Data hooks shared across the application frame. Feature pages add their own
 * next to the feature; all of them go through `useServices`.
 */
export const queryKeys = {
  currentUser: ['session', 'currentUser'],
  events: ['events'],
  eventAccess: (eventId: string) => ['events', eventId, 'access'],
  dashboard: (eventId: string) => ['events', eventId, 'dashboard'],
  demoRole: ['demo', 'role'],
  sidebarCollapsed: ['preferences', 'sidebarCollapsed'],
} as const

export function useCurrentUser(): UseQueryResult<User> {
  const { session } = useServices()
  return useQuery({
    queryKey: queryKeys.currentUser,
    queryFn: () => session.getCurrentUser(),
  })
}

export function useEvents(): UseQueryResult<EventSummary[]> {
  const { events } = useServices()
  return useQuery({ queryKey: queryKeys.events, queryFn: () => events.list() })
}

export function useEventAccessInfo(
  eventId: string,
): UseQueryResult<EventAccessInfo> {
  const { events } = useServices()
  return useQuery({
    queryKey: queryKeys.eventAccess(eventId),
    queryFn: () => events.get(eventId),
  })
}

export function useDemoRole(): UseQueryResult<DemoRole | null> {
  const { demo } = useServices()
  return useQuery({
    queryKey: queryKeys.demoRole,
    queryFn: () => demo?.getRole() ?? null,
    enabled: demo !== null,
  })
}

/** A simulated role changes what every view may show, so everything reloads. */
export function useSetDemoRole() {
  const { demo } = useServices()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (role: DemoRole | null) => {
      await demo?.setRole(role)
    },
    onSettled: () => queryClient.invalidateQueries(),
  })
}

export function useResetDemo() {
  const { demo } = useServices()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      await demo?.reset()
    },
    onSettled: () => queryClient.invalidateQueries(),
  })
}

/**
 * Whether the desktop side menu shows icons only, and a way to flip it. The
 * choice is remembered for this browser.
 */
export function useSidebarCollapsed(): {
  collapsed: boolean
  toggle: () => void
} {
  const { preferences } = useServices()
  const queryClient = useQueryClient()
  const { data: collapsed = false } = useQuery({
    queryKey: queryKeys.sidebarCollapsed,
    queryFn: () => preferences.getSidebarCollapsed(),
    staleTime: Infinity,
  })
  return {
    collapsed,
    toggle: () => {
      queryClient.setQueryData(queryKeys.sidebarCollapsed, !collapsed)
      void preferences.setSidebarCollapsed(!collapsed)
    },
  }
}
