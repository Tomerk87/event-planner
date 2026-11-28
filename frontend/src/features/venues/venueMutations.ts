import { useMutation, useQueryClient } from '@tanstack/react-query'
import type {
  OrganizationInput,
  SpaceInput,
  VenueMemberRole,
} from '../../domain/venues.ts'
import { useServices } from '../../services/servicesContext.ts'
import { venueKeys } from './venueQueries.ts'

/** The venues service; the venue pages only show while it exists. */
function useVenuesService() {
  const { venues } = useServices()
  if (!venues) {
    throw new Error('venues are off')
  }
  return venues
}

/** Any change to a venue: everything about venues is read again. */
function useVenueMutation<Input, Result>(
  run: (input: Input) => Promise<Result>,
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: run,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: venueKeys.workspaces }),
  })
}

export function useCreateSpace(organizationId: string) {
  const venues = useVenuesService()
  return useVenueMutation((input: SpaceInput) =>
    venues.createSpace(organizationId, input),
  )
}

export function useUpdateSpace(organizationId: string) {
  const venues = useVenuesService()
  return useVenueMutation(
    ({ spaceId, input }: { spaceId: string; input: SpaceInput }) =>
      venues.updateSpace(organizationId, spaceId, input),
  )
}

export function useSetSpaceArchived(organizationId: string) {
  const venues = useVenuesService()
  return useVenueMutation(
    ({ spaceId, archived }: { spaceId: string; archived: boolean }) =>
      venues.setSpaceArchived(organizationId, spaceId, archived),
  )
}

export function useDuplicateTemplate(organizationId: string) {
  const venues = useVenuesService()
  return useVenueMutation((templateId: string) =>
    venues.duplicateTemplate(organizationId, templateId),
  )
}

export function useSetTemplateArchived(organizationId: string) {
  const venues = useVenuesService()
  return useVenueMutation(
    ({ templateId, archived }: { templateId: string; archived: boolean }) =>
      venues.setTemplateArchived(organizationId, templateId, archived),
  )
}

export function useUpdateOrganization(organizationId: string) {
  const venues = useVenuesService()
  return useVenueMutation((input: OrganizationInput) =>
    venues.updateOrganization(organizationId, input),
  )
}

export function useInviteMember(organizationId: string) {
  const venues = useVenuesService()
  return useVenueMutation((input: { email: string; role: VenueMemberRole }) =>
    venues.inviteMember(organizationId, input),
  )
}

export function useChangeMemberRole(organizationId: string) {
  const venues = useVenuesService()
  return useVenueMutation(
    ({ userId, role }: { userId: string; role: VenueMemberRole }) =>
      venues.changeMemberRole(organizationId, userId, role),
  )
}

export function useRemoveMember(organizationId: string) {
  const venues = useVenuesService()
  return useVenueMutation((userId: string) =>
    venues.removeMember(organizationId, userId),
  )
}

export function useResendMemberInvitation(organizationId: string) {
  const venues = useVenuesService()
  return useVenueMutation((email: string) =>
    venues.resendMemberInvitation(organizationId, email),
  )
}

export function useCancelMemberInvitation(organizationId: string) {
  const venues = useVenuesService()
  return useVenueMutation((email: string) =>
    venues.cancelMemberInvitation(organizationId, email),
  )
}
