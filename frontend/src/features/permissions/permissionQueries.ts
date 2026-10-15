import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query'
import type { EventRole } from '../../domain/roles.ts'
import type {
  EventAccessList,
  Services,
} from '../../services/contracts/index.ts'
import { queryKeys } from '../../services/queries.ts'
import { useServices } from '../../services/servicesContext.ts'

const accessListKey = (eventId: string) => ['events', eventId, 'permissions']

/** Who has access to the event. Asked only for a user who may see it. */
export function useAccessList(
  eventId: string,
  enabled: boolean,
): UseQueryResult<EventAccessList> {
  const { permissions } = useServices()
  return useQuery({
    queryKey: accessListKey(eventId),
    queryFn: () => permissions.list(eventId),
    enabled,
  })
}

/** A change to who has access; everything about events is read again. */
function usePermissionChange<Input, Result>(
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

/** Emails a pending invitation again (D90); nothing in the list changes. */
export function useResendInvitation(eventId: string) {
  const { permissions } = useServices()
  return useMutation({
    mutationFn: (invitationId: string) =>
      permissions.resendInvitation(eventId, invitationId),
  })
}

export function useInvite(eventId: string) {
  return usePermissionChange(
    (services, { email, role }: { email: string; role: EventRole }) =>
      services.permissions.invite(eventId, email, role),
  )
}

/** One line of the list: a member, or a pending invitation. */
export interface AccessTarget {
  kind: 'member' | 'invitation'
  id: string
}

export function useChangeRole(eventId: string) {
  return usePermissionChange(
    (
      { permissions },
      { target, role }: { target: AccessTarget; role: EventRole },
    ): Promise<unknown> =>
      target.kind === 'member'
        ? permissions.changeRole(eventId, target.id, role)
        : permissions.changeInvitationRole(eventId, target.id, role),
  )
}

export function useRemoveAccess(eventId: string) {
  return usePermissionChange(({ permissions }, target: AccessTarget) =>
    target.kind === 'member'
      ? permissions.revoke(eventId, target.id)
      : permissions.cancelInvitation(eventId, target.id),
  )
}
