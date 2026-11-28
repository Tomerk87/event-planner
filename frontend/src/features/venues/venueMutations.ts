import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { LayoutInput } from '../../domain/layout.ts'
import type { TableInput } from '../../domain/seating.ts'
import type {
  OrganizationInput,
  SpaceInput,
  VenueEventInput,
  VenueMemberRole,
} from '../../domain/venues.ts'
import type { ClientInviteRole } from '../../services/contracts/index.ts'
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

export function useCreateTemplate(organizationId: string) {
  const venues = useVenuesService()
  return useVenueMutation(
    ({ spaceId, name }: { spaceId: string; name: string }) =>
      venues.createTemplate(organizationId, spaceId, name),
  )
}

export function useRenameTemplate(organizationId: string, templateId: string) {
  const venues = useVenuesService()
  return useVenueMutation((name: string) =>
    venues.renameTemplate(organizationId, templateId, name),
  )
}

export function useSaveTemplateLayout(
  organizationId: string,
  templateId: string,
) {
  const venues = useVenuesService()
  return useVenueMutation((input: LayoutInput) =>
    venues.saveTemplateLayout(organizationId, templateId, input),
  )
}

/** A template's tables: add or change (by the number being edited) one. */
export function useSaveTemplateTable(
  organizationId: string,
  templateId: string,
) {
  const venues = useVenuesService()
  return useVenueMutation(
    ({ input, number }: { input: TableInput; number: number | null }) =>
      number === null
        ? venues.addTemplateTable(organizationId, templateId, input)
        : venues.updateTemplateTable(organizationId, templateId, number, input),
  )
}

export function useRemoveTemplateTable(
  organizationId: string,
  templateId: string,
) {
  const venues = useVenuesService()
  return useVenueMutation((number: number) =>
    venues.removeTemplateTable(organizationId, templateId, number),
  )
}

export function useCreateVenueEvent(organizationId: string) {
  const venues = useVenuesService()
  return useVenueMutation((input: VenueEventInput) =>
    venues.createEvent(organizationId, input),
  )
}

export function useInviteClient(organizationId: string, eventId: string) {
  const venues = useVenuesService()
  return useVenueMutation((email: string) =>
    venues.inviteClient(organizationId, eventId, email),
  )
}

export function useResendClientInvitation(
  organizationId: string,
  eventId: string,
) {
  const venues = useVenuesService()
  return useVenueMutation(() =>
    venues.resendClientInvitation(organizationId, eventId),
  )
}

export function useRevokeClientInvitation(
  organizationId: string,
  eventId: string,
) {
  const venues = useVenuesService()
  return useVenueMutation(() =>
    venues.revokeClientInvitation(organizationId, eventId),
  )
}

/** Accepting, as the signed-in account or (demo) as the invited client. */
export function useAcceptClientInvitation(token: string) {
  const venues = useVenuesService()
  return useVenueMutation((asInvitee: boolean) =>
    asInvitee && venues.acceptClientInvitationAsInvitee
      ? venues.acceptClientInvitationAsInvitee(token)
      : venues.acceptClientInvitation(token),
  )
}

export function useInviteToClientTeam(eventId: string) {
  const venues = useVenuesService()
  return useVenueMutation(
    ({ email, role }: { email: string; role: ClientInviteRole }) =>
      venues.inviteToClientTeam(eventId, email, role),
  )
}

export function useChangeClientTeamRole(eventId: string) {
  const venues = useVenuesService()
  return useVenueMutation(
    ({ email, role }: { email: string; role: ClientInviteRole }) =>
      venues.changeClientTeamRole(eventId, email, role),
  )
}

export function useRemoveFromClientTeam(eventId: string) {
  const venues = useVenuesService()
  return useVenueMutation((email: string) =>
    venues.removeFromClientTeam(eventId, email),
  )
}

export function useMarkNoticesRead() {
  const venues = useVenuesService()
  return useVenueMutation((ids: string[]) => venues.markNoticesRead(ids))
}

export function useHandleNotice(eventId: string) {
  const venues = useVenuesService()
  return useVenueMutation((noticeId: string) =>
    venues.handleNotice(eventId, noticeId),
  )
}
