import { assertEmail, normalizeEmail } from '../../domain/accounts.ts'
import { DomainError } from '../../domain/errors.ts'
import {
  assertStartsInFuture,
  EVENT_LIMITS,
  validateCoverImage,
  validateEventInput,
} from '../../domain/events.ts'
import { isEventPast } from '../../domain/eventTime.ts'
import { computeDashboardMetrics } from '../../domain/metrics.ts'
import {
  assertLayoutVersion,
  validateLayoutInput,
} from '../../domain/layout.ts'
import type { Event, Id, User } from '../../domain/models.ts'
import { validateTableInput, type TableInput } from '../../domain/seating.ts'
import {
  applyLayoutToTemplate,
  assertCanChangeVenueMember,
  assertCanAcceptClientLink,
  clientLinkExpiresAt,
  clientLinkState,
  copyTemplateToEvent,
  invitationExpiresAt,
  newClientLinkToken,
  emptyTemplate,
  templateTables,
  validateTemplateName,
  templateFigures,
  validateOrganizationInput,
  validateSpaceInput,
  validateSpacePhoto,
  venueCan,
  venueEventStatus,
  type LayoutTemplate,
  type VenueAction,
  type VenueEvent,
  type VenueSpace,
  type ClientInvitation,
  type ClientInvitationLink,
  type ClientTeamRole,
} from '../../domain/venues.ts'
import type {
  ClientTeamEntry,
  SpaceSummary,
  VenueEventSummary,
  VenueMemberSummary,
  VenuesService,
  VenueWorkspace,
} from '../contracts/index.ts'
import { defaultMessageTemplate, defaultRsvpSettings } from './defaults.ts'
import type { DemoState } from './state.ts'

/** The demo's data with every venue list present. */
type VenueState = DemoState &
  Required<
    Pick<
      DemoState,
      | 'organizations'
      | 'venueMembers'
      | 'venueSpaces'
      | 'venueEvents'
      | 'layoutTemplates'
      | 'venueMemberInvitations'
      | 'clientInvitationLinks'
      | 'clientTeam'
      | 'clientTeamInvitations'
    >
  >

/** What the venue operations need from the demo provider they belong to. */
export interface MockVenueContext {
  state: () => DemoState
  /** Keeps a change; refused when the browser cannot store it (D109). */
  commit: (next: DemoState) => void
  newId: (prefix: string) => Id
  run: <Result>(operation: string, action: () => Result) => Promise<Result>
  currentUserId: () => Id
  now: () => Date
}

/** Upcoming soonest first, then past most recent first. */
function byDate(a: VenueEventSummary, b: VenueEventSummary): number {
  return a.isPast === b.isPast
    ? (a.isPast ? -1 : 1) * a.event.startsAt.localeCompare(b.event.startsAt)
    : a.isPast
      ? 1
      : -1
}

/**
 * The venue operations of the demo (V2.2). They apply the same rules the
 * backend will: only a member reaches a venue, anything else is "not found"
 * so a venue's existence is not revealed, and the team and the settings are
 * the Owner's (D112, D116).
 */
/**
 * The venue operations; the client team's (#15) are checked by the event
 * role, so the demo provider adds them beside these.
 */
export type MockVenueOperations = Omit<
  VenuesService,
  | 'getClientTeam'
  | 'inviteToClientTeam'
  | 'changeClientTeamRole'
  | 'removeFromClientTeam'
>

export function createMockVenues(
  context: MockVenueContext,
): MockVenueOperations {
  const { run, now } = context
  // Data stored before V2.2 has no venue lists; they read as empty.
  const state = (): VenueState => {
    const data = context.state()
    return {
      ...data,
      organizations: data.organizations ?? [],
      venueMembers: data.venueMembers ?? [],
      venueSpaces: data.venueSpaces ?? [],
      venueEvents: data.venueEvents ?? [],
      layoutTemplates: data.layoutTemplates ?? [],
      venueMemberInvitations: data.venueMemberInvitations ?? [],
      clientInvitationLinks: data.clientInvitationLinks ?? [],
      clientTeam: data.clientTeam ?? [],
      clientTeamInvitations: data.clientTeamInvitations ?? [],
    }
  }

  function workspaces(): VenueWorkspace[] {
    const data = state()
    const userId = context.currentUserId()
    return data.venueMembers
      .filter((member) => member.userId === userId)
      .flatMap((member) => {
        const organization = data.organizations.find(
          (candidate) => candidate.id === member.organizationId,
        )
        return organization ? [{ organization, role: member.role }] : []
      })
      .sort((a, b) => a.organization.name.localeCompare(b.organization.name))
  }

  /** The user's membership of a venue, checked for an action. */
  function authorize(organizationId: Id, action: VenueAction): VenueWorkspace {
    const workspace = workspaces().find(
      (candidate) => candidate.organization.id === organizationId,
    )
    if (!workspace) {
      throw new DomainError('NOT_FOUND', { entity: 'venue' })
    }
    if (!venueCan(workspace.role, action)) {
      throw new DomainError('FORBIDDEN', { action })
    }
    return workspace
  }

  function spacesOf(organizationId: Id): VenueSpace[] {
    return state().venueSpaces.filter(
      (space) => space.organizationId === organizationId,
    )
  }

  function spaceOf(organizationId: Id, spaceId: Id): VenueSpace {
    const space = spacesOf(organizationId).find(
      (candidate) => candidate.id === spaceId,
    )
    if (!space) {
      throw new DomainError('NOT_FOUND', { entity: 'space' })
    }
    return space
  }

  function templateOf(organizationId: Id, templateId: Id): LayoutTemplate {
    const spaceIds = new Set(spacesOf(organizationId).map((space) => space.id))
    const template = state().layoutTemplates.find(
      (candidate) =>
        candidate.id === templateId && spaceIds.has(candidate.spaceId),
    )
    if (!template) {
      throw new DomainError('NOT_FOUND', { entity: 'template' })
    }
    return template
  }

  function summarize(
    venueEvent: VenueEvent,
    event: Event,
    space: VenueSpace,
  ): VenueEventSummary {
    const at = now()
    const { client } = venueEvent
    return {
      event,
      space: { id: space.id, name: space.name },
      status: venueEventStatus(venueEvent, event, at),
      client: client && { name: client.name, email: client.email },
      invitationSentAt: client?.sentAt ?? null,
      invitationExpiresAt:
        client && client.acceptedAt === null
          ? invitationExpiresAt(client).toISOString()
          : null,
      confirmedAttendees: computeDashboardMetrics(
        state().guests.filter((guest) => guest.eventId === event.id),
        [],
      ).confirmedAttendees,
      isPast: isEventPast(event, at),
    }
  }

  /** The venue's events with their records, each in one of its spaces. */
  function venueEventsOf(organizationId: Id) {
    const data = state()
    const spaces = spacesOf(organizationId)
    return data.venueEvents.flatMap((venueEvent) => {
      const event = data.events.find(
        (candidate) => candidate.id === venueEvent.eventId,
      )
      const space = spaces.find(
        (candidate) => candidate.id === venueEvent.spaceId,
      )
      return venueEvent.organizationId === organizationId && event && space
        ? [{ venueEvent, event, space }]
        : []
    })
  }

  function saveSpace(next: VenueSpace): VenueSpace {
    const data = state()
    context.commit({
      ...data,
      venueSpaces: data.venueSpaces.map((space) =>
        space.id === next.id ? next : space,
      ),
    })
    return next
  }

  function saveTemplate(next: LayoutTemplate): LayoutTemplate {
    const data = state()
    context.commit({
      ...data,
      layoutTemplates: data.layoutTemplates.map((template) =>
        template.id === next.id ? next : template,
      ),
    })
    return next
  }

  function membersOf(organizationId: Id) {
    return state().venueMembers.filter(
      (member) => member.organizationId === organizationId,
    )
  }

  /** The venue's members: Owners first, then by name. */
  function teamMembers(organizationId: Id): VenueMemberSummary[] {
    const users = state().users
    const me = context.currentUserId()
    return membersOf(organizationId)
      .flatMap((member) => {
        const user = users.find((candidate) => candidate.id === member.userId)
        return user
          ? [
              {
                userId: user.id,
                name: user.name,
                email: user.email,
                role: member.role,
                since: member.since ?? null,
                isYou: user.id === me,
              },
            ]
          : []
      })
      .sort((a, b) =>
        a.role === b.role
          ? a.name.localeCompare(b.name)
          : a.role === 'VENUE_OWNER'
            ? -1
            : 1,
      )
  }

  /** One of the venue's events; anything else is not found. */
  function venueEventOf(organizationId: Id, eventId: Id) {
    const found = venueEventsOf(organizationId).find(
      (item) => item.event.id === eventId,
    )
    if (!found) {
      throw new DomainError('NOT_FOUND', { entity: 'event' })
    }
    return found
  }

  /** The event's open link, if its client hasn't used it yet. */
  function openLinkOf(eventId: Id): ClientInvitationLink | undefined {
    return state().clientInvitationLinks.find(
      (link) => link.eventId === eventId && link.status === 'OPEN',
    )
  }

  function currentUser(): User {
    const me = context.currentUserId()
    const user = state().users.find((candidate) => candidate.id === me)
    if (!user) {
      throw new DomainError('UNAUTHENTICATED')
    }
    return user
  }

  /**
   * Changes the client of an event that has none joined yet, and sends a
   * new link: every earlier open link stops working.
   */
  function sendClientLink(
    organizationId: Id,
    eventId: Id,
    email: string,
    change: (client: ClientInvitation | null) => ClientInvitation,
  ): void {
    authorize(organizationId, 'MANAGE_EVENTS')
    const { venueEvent, event } = venueEventOf(organizationId, eventId)
    assertClientChangeable(venueEvent, event)
    const data = state()
    const sentAt = now().toISOString()
    context.commit({
      ...data,
      venueEvents: data.venueEvents.map((candidate) =>
        candidate.eventId === eventId
          ? { ...candidate, client: change(candidate.client) }
          : candidate,
      ),
      clientInvitationLinks: [
        ...revokeOpenLinks(data.clientInvitationLinks, eventId),
        { token: newClientLinkToken(), eventId, email, sentAt, status: 'OPEN' },
      ],
    })
  }

  function revokeOpenLinks(
    links: ClientInvitationLink[],
    eventId: Id,
  ): ClientInvitationLink[] {
    return links.map((link) =>
      link.eventId === eventId && link.status === 'OPEN'
        ? { ...link, status: 'REVOKED' }
        : link,
    )
  }

  /** Once a client joined, or the event started, the client stays (D113). */
  function assertClientChangeable(venueEvent: VenueEvent, event: Event): void {
    if (isEventPast(event, now())) {
      throw new DomainError('EVENT_READ_ONLY')
    }
    if (venueEvent.client?.acceptedAt) {
      throw new DomainError('VALIDATION', { field: 'client', reason: 'joined' })
    }
  }

  /** The link behind a token; an unknown one is not found. */
  function linkOf(token: string) {
    const data = state()
    const link = data.clientInvitationLinks.find(
      (candidate) => candidate.token === token,
    )
    const venueEvent = data.venueEvents.find(
      (candidate) => candidate.eventId === link?.eventId,
    )
    const event = data.events.find(
      (candidate) => candidate.id === link?.eventId,
    )
    if (!link || !venueEvent || !event) {
      throw new DomainError('NOT_FOUND', { entity: 'invitation' })
    }
    return { link, venueEvent, event }
  }

  /** The client lead joins: the link is used and the event has its client. */
  function acceptAs(token: string, user: User): void {
    const { link, venueEvent, event } = linkOf(token)
    assertCanAcceptClientLink(link, event, user, now())
    // The two sides stay apart: a venue member can't be its client (D113).
    if (
      membersOf(venueEvent.organizationId).some(
        (member) => member.userId === user.id,
      )
    ) {
      throw new DomainError('FORBIDDEN', { reason: 'venueMember' })
    }
    const data = state()
    const acceptedAt = now().toISOString()
    context.commit({
      ...data,
      venueEvents: data.venueEvents.map((candidate) =>
        candidate.eventId === event.id && candidate.client
          ? {
              ...candidate,
              client: { ...candidate.client, name: user.name, acceptedAt },
            }
          : candidate,
      ),
      clientInvitationLinks: data.clientInvitationLinks.map((candidate) =>
        candidate.token === token
          ? { ...candidate, status: 'USED' as const }
          : candidate,
      ),
      clientTeam: [
        ...data.clientTeam,
        {
          eventId: event.id,
          userId: user.id,
          role: 'CLIENT_LEAD',
          since: acceptedAt,
        },
      ],
    })
  }

  function invitationsOf(organizationId: Id) {
    return state().venueMemberInvitations.filter(
      (invitation) => invitation.organizationId === organizationId,
    )
  }

  /** Checks a team change against the rules, as the Owner (D112). */
  function changeMember(
    organizationId: Id,
    userId: Id,
    newRole: 'VENUE_OWNER' | 'VENUE_MANAGER' | null,
  ): void {
    const { role } = authorize(organizationId, 'VIEW_VENUE')
    assertCanChangeVenueMember(
      { userId: context.currentUserId(), role },
      membersOf(organizationId),
      { userId, newRole },
    )
    const data = state()
    const members = data.venueMembers
    context.commit({
      ...data,
      venueMembers:
        newRole === null
          ? members.filter(
              (member) =>
                !(
                  member.organizationId === organizationId &&
                  member.userId === userId
                ),
            )
          : members.map((member) =>
              member.organizationId === organizationId &&
              member.userId === userId
                ? { ...member, role: newRole }
                : member,
            ),
    })
  }

  function invitationFor(organizationId: Id, email: string) {
    const normalized = email.trim().toLowerCase()
    const invitation = invitationsOf(organizationId).find(
      (candidate) => candidate.email === normalized,
    )
    if (!invitation) {
      throw new DomainError('NOT_FOUND', { entity: 'invitation' })
    }
    return invitation
  }

  function otherTemplateNames(spaceId: Id, exceptId: Id | null): string[] {
    return state()
      .layoutTemplates.filter(
        (template) => template.spaceId === spaceId && template.id !== exceptId,
      )
      .map((template) => template.name)
  }

  /** Keeps a changed template, marking when it was edited. */
  function editTemplate(
    template: LayoutTemplate,
    changes: Partial<LayoutTemplate>,
  ): LayoutTemplate {
    return saveTemplate({
      ...template,
      ...changes,
      updatedAt: now().toISOString(),
    })
  }

  /** Changes one table of a template, checked like an event's table. */
  function changeTable(
    organizationId: Id,
    templateId: Id,
    number: number | null,
    input: TableInput | null,
  ): LayoutTemplate {
    authorize(organizationId, 'MANAGE_SPACES')
    const template = templateOf(organizationId, templateId)
    const current =
      number === null
        ? null
        : template.tables.find((table) => table.number === number)
    if (number !== null && !current) {
      throw new DomainError('NOT_FOUND', { entity: 'table' })
    }
    if (input === null) {
      return editTemplate(template, {
        tables: template.tables.filter((table) => table.number !== number),
      })
    }
    const editingId = current
      ? (templateTables(template).find((table) => table.number === number)
          ?.id ?? null)
      : null
    const fields = validateTableInput(
      input,
      templateTables(template),
      editingId,
    )
    return editTemplate(template, {
      tables: current
        ? template.tables.map((table) =>
            table.number === number ? { ...table, ...fields } : table,
          )
        : [...template.tables, { ...fields, x: null, y: null, rotation: 0 }],
    })
  }

  return {
    listWorkspaces: () => run('venues.listWorkspaces', workspaces),

    getWorkspace: (organizationId) =>
      run('venues.getWorkspace', () => authorize(organizationId, 'VIEW_VENUE')),

    updateOrganization: (organizationId, input) =>
      run('venues.updateOrganization', () => {
        const { organization } = authorize(organizationId, 'MANAGE_SETTINGS')
        const updated = { ...organization, ...validateOrganizationInput(input) }
        const data = state()
        context.commit({
          ...data,
          organizations: data.organizations.map((candidate) =>
            candidate.id === organizationId ? updated : candidate,
          ),
        })
        return updated
      }),

    listSpaces: (organizationId) =>
      run('venues.listSpaces', () => {
        authorize(organizationId, 'VIEW_VENUE')
        const templates = state().layoutTemplates
        const events = venueEventsOf(organizationId)
        const at = now()
        return spacesOf(organizationId)
          .map((space): SpaceSummary => {
            const upcoming = events
              .filter(
                (item) =>
                  item.space.id === space.id && !isEventPast(item.event, at),
              )
              .map((item) => item.event)
              .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
            const next = upcoming[0]
            return {
              space,
              layoutCount: templates.filter(
                (template) =>
                  template.spaceId === space.id && !template.archived,
              ).length,
              upcomingEventCount: upcoming.length,
              nextEvent: next
                ? {
                    id: next.id,
                    name: next.name,
                    startsAt: next.startsAt,
                    timeZone: next.timeZone,
                  }
                : null,
            }
          })
          .sort((a, b) => a.space.name.localeCompare(b.space.name))
      }),

    getSpace: (organizationId, spaceId) =>
      run('venues.getSpace', () => {
        authorize(organizationId, 'VIEW_VENUE')
        const space = spaceOf(organizationId, spaceId)
        const at = now()
        const upcoming = venueEventsOf(organizationId).filter(
          (item) => item.space.id === space.id && !isEventPast(item.event, at),
        )
        const templates = state()
          .layoutTemplates.filter((template) => template.spaceId === space.id)
          .sort((a, b) => a.name.localeCompare(b.name))
        return {
          space,
          templates: templates.map((template) => ({
            template,
            figures: templateFigures(template, space),
            upcomingEventCount: upcoming.filter(
              (item) => item.venueEvent.templateId === template.id,
            ).length,
          })),
          upcomingEvents: upcoming
            .map((item) => ({
              ...summarize(item.venueEvent, item.event, item.space),
              templateName:
                templates.find(
                  (template) => template.id === item.venueEvent.templateId,
                )?.name ?? null,
            }))
            .sort(byDate),
        }
      }),

    createSpace: (organizationId, input) =>
      run('venues.createSpace', () => {
        authorize(organizationId, 'MANAGE_SPACES')
        const fields = validateSpaceInput(
          input,
          spacesOf(organizationId).map((space) => space.name),
        )
        const photo = validateSpacePhoto(input.photo ?? null)
        const space: VenueSpace = {
          ...fields,
          id: context.newId('spc'),
          organizationId,
          photo,
          archived: false,
        }
        const data = state()
        context.commit({
          ...data,
          venueSpaces: [...data.venueSpaces, space],
        })
        return space
      }),

    updateSpace: (organizationId, spaceId, input) =>
      run('venues.updateSpace', () => {
        authorize(organizationId, 'MANAGE_SPACES')
        const space = spaceOf(organizationId, spaceId)
        const fields = validateSpaceInput(
          input,
          spacesOf(organizationId)
            .filter((other) => other.id !== spaceId)
            .map((other) => other.name),
        )
        const photo =
          input.photo === undefined
            ? space.photo
            : validateSpacePhoto(input.photo)
        // Events keep their own copy of the address and size (D111).
        return saveSpace({ ...space, ...fields, photo })
      }),

    setSpaceArchived: (organizationId, spaceId, archived) =>
      run('venues.setSpaceArchived', () => {
        authorize(organizationId, 'MANAGE_SPACES')
        return saveSpace({ ...spaceOf(organizationId, spaceId), archived })
      }),

    duplicateTemplate: (organizationId, templateId) =>
      run('venues.duplicateTemplate', () => {
        authorize(organizationId, 'MANAGE_SPACES')
        const source = templateOf(organizationId, templateId)
        const names = new Set(
          state()
            .layoutTemplates.filter(
              (template) => template.spaceId === source.spaceId,
            )
            .map((template) => template.name),
        )
        let name = `${source.name} (2)`
        for (let copy = 3; names.has(name); copy += 1) {
          name = `${source.name} (${copy})`
        }
        const template: LayoutTemplate = {
          ...source,
          id: context.newId('tpl'),
          name,
          tables: source.tables.map((table) => ({ ...table })),
          objects: source.objects.map((object) => ({ ...object })),
          version: 0,
          updatedAt: now().toISOString(),
          archived: false,
        }
        const data = state()
        context.commit({
          ...data,
          layoutTemplates: [...data.layoutTemplates, template],
        })
        return template
      }),

    setTemplateArchived: (organizationId, templateId, archived) =>
      run('venues.setTemplateArchived', () => {
        authorize(organizationId, 'MANAGE_SPACES')
        return saveTemplate({
          ...templateOf(organizationId, templateId),
          archived,
        })
      }),

    getTemplate: (organizationId, templateId) =>
      run('venues.getTemplate', () => {
        authorize(organizationId, 'VIEW_VENUE')
        const template = templateOf(organizationId, templateId)
        const space = spaceOf(organizationId, template.spaceId)
        const at = now()
        return {
          template,
          space,
          upcomingEventCount: venueEventsOf(organizationId).filter(
            (item) =>
              item.venueEvent.templateId === template.id &&
              !isEventPast(item.event, at),
          ).length,
        }
      }),

    createTemplate: (organizationId, spaceId, name) =>
      run('venues.createTemplate', () => {
        authorize(organizationId, 'MANAGE_SPACES')
        const space = spaceOf(organizationId, spaceId)
        const template = emptyTemplate(
          context.newId('tpl'),
          space.id,
          validateTemplateName(name, otherTemplateNames(space.id, null)),
          now().toISOString(),
        )
        const data = state()
        context.commit({
          ...data,
          layoutTemplates: [...data.layoutTemplates, template],
        })
        return template
      }),

    renameTemplate: (organizationId, templateId, name) =>
      run('venues.renameTemplate', () => {
        authorize(organizationId, 'MANAGE_SPACES')
        const template = templateOf(organizationId, templateId)
        return editTemplate(template, {
          name: validateTemplateName(
            name,
            otherTemplateNames(template.spaceId, template.id),
          ),
        })
      }),

    saveTemplateLayout: (organizationId, templateId, input) =>
      run('venues.saveTemplateLayout', () => {
        authorize(organizationId, 'MANAGE_SPACES')
        const template = templateOf(organizationId, templateId)
        assertLayoutVersion(input.version, template.version)
        const checked = validateLayoutInput(input, templateTables(template))
        return editTemplate(template, {
          ...applyLayoutToTemplate(template, checked),
          version: template.version + 1,
        })
      }),

    addTemplateTable: (organizationId, templateId, input) =>
      run('venues.addTemplateTable', () =>
        changeTable(organizationId, templateId, null, input),
      ),

    updateTemplateTable: (organizationId, templateId, number, input) =>
      run('venues.updateTemplateTable', () =>
        changeTable(organizationId, templateId, number, input),
      ),

    removeTemplateTable: (organizationId, templateId, number) =>
      run('venues.removeTemplateTable', () =>
        changeTable(organizationId, templateId, number, null),
      ),

    createEvent: (organizationId, input) =>
      run('venues.createEvent', () => {
        const { organization } = authorize(organizationId, 'MANAGE_EVENTS')
        const space = spaceOf(organizationId, input.spaceId)
        const template = templateOf(organizationId, input.templateId)
        if (
          space.archived ||
          template.archived ||
          template.spaceId !== space.id
        ) {
          throw new DomainError('VALIDATION', { field: 'templateId' })
        }
        // The space gives the place, size and time zone (D111, D113).
        const fields = validateEventInput({
          name: input.name,
          startsAt: input.startsAt,
          timeZone: space.timeZone,
          maxAttendees: space.maxPeople,
          defaultAllowedAttendees: EVENT_LIMITS.allowedAttendees.default,
          rsvpLanguage: organization.defaultLanguage,
          country: organization.defaultLanguage === 'pt' ? 'BR' : 'IL',
          location: space.address,
        })
        const coverImage = validateCoverImage(input.coverImage ?? null)
        assertStartsInFuture(fields.startsAt, now())
        const email = input.clientEmail?.trim()
          ? assertEmail(input.clientEmail)
          : null
        const id = context.newId('evt')
        const event: Event = {
          ...fields,
          id,
          coverImage,
          rsvpSlug: `${id}-${Date.parse(fields.startsAt).toString(36)}`,
        }
        const { tables, layout } = copyTemplateToEvent(template, id, () =>
          context.newId('tbl'),
        )
        const data = state()
        context.commit({
          ...data,
          events: [...data.events, event],
          venueEvents: [
            ...data.venueEvents,
            {
              eventId: id,
              organizationId,
              spaceId: space.id,
              templateId: template.id,
              // The demo sends no email; the invitation waits as sent (D115).
              client: email
                ? {
                    name: email,
                    email,
                    sentAt: now().toISOString(),
                    acceptedAt: null,
                    sentBy: context.currentUserId(),
                    timesSent: 1,
                  }
                : null,
            },
          ],
          clientInvitationLinks: email
            ? [
                ...data.clientInvitationLinks,
                {
                  token: newClientLinkToken(),
                  eventId: id,
                  email,
                  sentAt: now().toISOString(),
                  status: 'OPEN' as const,
                },
              ]
            : data.clientInvitationLinks,
          tables: [...data.tables, ...tables],
          layouts: [...data.layouts, layout],
          rsvpSettings: [...data.rsvpSettings, defaultRsvpSettings(event)],
          messageTemplates: [
            ...data.messageTemplates,
            defaultMessageTemplate(event),
          ],
        })
        return event
      }),

    getEventPeople: (organizationId, eventId) =>
      run('venues.getEventPeople', () => {
        const { organization } = authorize(organizationId, 'VIEW_VENUE')
        const { venueEvent, event, space } = venueEventOf(
          organizationId,
          eventId,
        )
        const data = state()
        const nameOf = (userId: Id | null) =>
          data.users.find((user) => user.id === userId)?.name ?? null
        const { client } = venueEvent
        const team = data.clientTeam.filter(
          (member) => member.eventId === eventId,
        )
        const order: Record<ClientTeamRole, number> = {
          CLIENT_LEAD: 0,
          CLIENT_EDITOR: 1,
          CLIENT_VIEWER: 2,
        }
        const clientTeam: ClientTeamEntry[] = [
          ...team.flatMap((member) => {
            const user = data.users.find(
              (candidate) => candidate.id === member.userId,
            )
            return user
              ? [
                  {
                    name: user.name,
                    email: user.email,
                    role: member.role,
                    since: member.since,
                    pending: false,
                  },
                ]
              : []
          }),
          ...data.clientTeamInvitations
            .filter((invitation) => invitation.eventId === eventId)
            .map((invitation) => ({
              name: null,
              email: invitation.email,
              role: invitation.role,
              since: invitation.sentAt,
              pending: true,
            })),
        ].sort(
          (a, b) =>
            Number(a.pending) - Number(b.pending) ||
            order[a.role] - order[b.role] ||
            a.since.localeCompare(b.since),
        )
        return {
          summary: summarize(venueEvent, event, space),
          venue: organization,
          client: client && {
            name: client.name,
            email: client.email,
            sentAt: client.sentAt,
            acceptedAt: client.acceptedAt,
            sentByName: nameOf(client.sentBy),
            timesSent: client.timesSent,
            expiresAt: invitationExpiresAt(client).toISOString(),
          },
          demoLinkToken:
            client && !client.acceptedAt
              ? (openLinkOf(eventId)?.token ?? null)
              : null,
          clientTeam,
          guestCount: data.guests.filter(
            (guest) => guest.eventId === eventId && !guest.deleted,
          ).length,
          venueTeam: teamMembers(organizationId),
        }
      }),

    inviteClient: (organizationId, eventId, email) =>
      run('venues.inviteClient', () => {
        const address = assertEmail(email)
        sendClientLink(organizationId, eventId, address, () => ({
          name: address,
          email: address,
          sentAt: now().toISOString(),
          acceptedAt: null,
          sentBy: context.currentUserId(),
          timesSent: 1,
        }))
      }),

    resendClientInvitation: (organizationId, eventId) =>
      run('venues.resendClientInvitation', () => {
        const { venueEvent } = venueEventOf(organizationId, eventId)
        const { client } = venueEvent
        if (!client) {
          throw new DomainError('NOT_FOUND', { entity: 'invitation' })
        }
        sendClientLink(organizationId, eventId, client.email, () => ({
          ...client,
          sentAt: now().toISOString(),
          sentBy: context.currentUserId(),
          timesSent: client.timesSent + 1,
        }))
      }),

    revokeClientInvitation: (organizationId, eventId) =>
      run('venues.revokeClientInvitation', () => {
        authorize(organizationId, 'MANAGE_EVENTS')
        const { venueEvent, event } = venueEventOf(organizationId, eventId)
        if (!venueEvent.client) {
          throw new DomainError('NOT_FOUND', { entity: 'invitation' })
        }
        assertClientChangeable(venueEvent, event)
        const data = state()
        context.commit({
          ...data,
          venueEvents: data.venueEvents.map((candidate) =>
            candidate.eventId === eventId
              ? { ...candidate, client: null }
              : candidate,
          ),
          clientInvitationLinks: revokeOpenLinks(
            data.clientInvitationLinks,
            eventId,
          ),
        })
      }),

    getClientInvitation: (token) =>
      run('venues.getClientInvitation', () => {
        const { link, venueEvent, event } = linkOf(token)
        const data = state()
        const space = data.venueSpaces.find(
          (candidate) => candidate.id === venueEvent.spaceId,
        )
        const venue = data.organizations.find(
          (candidate) => candidate.id === venueEvent.organizationId,
        )
        const sender = data.users.find(
          (user) => user.id === venueEvent.client?.sentBy,
        )
        const me = data.users.find(
          (user) => user.id === context.currentUserId(),
        )
        return {
          state: clientLinkState(link, event, now()),
          email: link.email,
          expiresAt: clientLinkExpiresAt(link).toISOString(),
          event: {
            id: event.id,
            name: event.name,
            startsAt: event.startsAt,
            timeZone: event.timeZone,
            coverImage: event.coverImage,
          },
          venueId: venueEvent.organizationId,
          venueName: venue?.name ?? '',
          space: { name: space?.name ?? '', address: space?.address ?? '' },
          invitedBy: sender ? { name: sender.name, email: sender.email } : null,
          signedInAs: me ? { name: me.name, email: me.email } : null,
          emailMatches:
            me !== undefined &&
            normalizeEmail(me.email) === normalizeEmail(link.email),
          isYours: data.clientTeam.some(
            (member) =>
              member.eventId === event.id &&
              member.role === 'CLIENT_LEAD' &&
              member.userId === me?.id,
          ),
        }
      }),

    acceptClientInvitation: (token) =>
      run('venues.acceptClientInvitation', () => {
        acceptAs(token, currentUser())
      }),

    acceptClientInvitationAsInvitee: (token) =>
      run('venues.acceptClientInvitationAsInvitee', () => {
        const { link } = linkOf(token)
        const data = state()
        let user = data.users.find(
          (candidate) =>
            normalizeEmail(candidate.email) === normalizeEmail(link.email),
        )
        if (!user) {
          // The client signs up with the invited address.
          const local = link.email.split('@')[0] ?? link.email
          user = {
            id: context.newId('usr'),
            name: local
              .split(/[._-]+/)
              .filter(Boolean)
              .map((part) => part[0]?.toUpperCase() + part.slice(1))
              .join(' '),
            email: link.email,
            isSuperUser: false,
          }
          context.commit({ ...data, users: [...data.users, user] })
        }
        acceptAs(token, user)
      }),

    listEvents: (organizationId) =>
      run('venues.listEvents', () => {
        authorize(organizationId, 'VIEW_VENUE')
        return venueEventsOf(organizationId)
          .map((item) => summarize(item.venueEvent, item.event, item.space))
          .sort(byDate)
      }),

    getTeam: (organizationId) =>
      run('venues.getTeam', () => {
        authorize(organizationId, 'VIEW_VENUE')
        return {
          members: teamMembers(organizationId),
          invitations: invitationsOf(organizationId).sort((a, b) =>
            b.sentAt.localeCompare(a.sentAt),
          ),
        }
      }),

    inviteMember: (organizationId, input) =>
      run('venues.inviteMember', () => {
        authorize(organizationId, 'MANAGE_TEAM')
        const email = assertEmail(input.email)
        const data = state()
        const memberEmails = new Set(
          membersOf(organizationId).flatMap(
            (member) =>
              data.users.find((user) => user.id === member.userId)?.email ?? [],
          ),
        )
        if (memberEmails.has(email)) {
          throw new DomainError('ALREADY_MEMBER')
        }
        if (invitationsOf(organizationId).some((i) => i.email === email)) {
          throw new DomainError('ALREADY_INVITED')
        }
        // The demo sends no email; the invitation waits as "pending".
        context.commit({
          ...data,
          venueMemberInvitations: [
            ...data.venueMemberInvitations,
            {
              organizationId,
              email,
              role: input.role,
              sentAt: now().toISOString(),
            },
          ],
        })
      }),

    changeMemberRole: (organizationId, userId, role) =>
      run('venues.changeMemberRole', () =>
        changeMember(organizationId, userId, role),
      ),

    removeMember: (organizationId, userId) =>
      run('venues.removeMember', () =>
        changeMember(organizationId, userId, null),
      ),

    resendMemberInvitation: (organizationId, email) =>
      run('venues.resendMemberInvitation', () => {
        authorize(organizationId, 'MANAGE_TEAM')
        const invitation = invitationFor(organizationId, email)
        const data = state()
        context.commit({
          ...data,
          venueMemberInvitations: data.venueMemberInvitations.map(
            (candidate) =>
              candidate === invitation
                ? { ...candidate, sentAt: now().toISOString() }
                : candidate,
          ),
        })
      }),

    cancelMemberInvitation: (organizationId, email) =>
      run('venues.cancelMemberInvitation', () => {
        authorize(organizationId, 'MANAGE_TEAM')
        const invitation = invitationFor(organizationId, email)
        const data = state()
        context.commit({
          ...data,
          venueMemberInvitations: data.venueMemberInvitations.filter(
            (candidate) => candidate !== invitation,
          ),
        })
      }),
  }
}
