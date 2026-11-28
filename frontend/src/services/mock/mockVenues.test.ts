import { describe, expect, it } from 'vitest'
import { DomainError, type DomainErrorCode } from '../../domain/errors.ts'
import { generateDemoState } from './generator.ts'
import { createMockServices, DEMO_LIMITS } from './mockServices.ts'
import { createMemoryPersistence } from './persistence.ts'
import { DATASET_VERSION, type StoredDemo } from './state.ts'

const NOW = new Date('2026-10-12T09:00:00.000Z')

function create(
  options: { venues?: boolean; state?: StoredDemo['state'] } = {},
) {
  const { venues = true, state = generateDemoState(NOW) } = options
  return createMockServices({
    persistence: createMemoryPersistence<StoredDemo>({
      version: DATASET_VERSION,
      state,
    }),
    now: () => NOW,
    venues,
    limits: DEMO_LIMITS,
  })
}

async function codeOf(
  action: Promise<unknown>,
): Promise<DomainErrorCode | 'NO_ERROR'> {
  try {
    await action
  } catch (error) {
    if (error instanceof DomainError) {
      return error.code
    }
    throw error
  }
  return 'NO_ERROR'
}

describe('demo venues (V2.2)', () => {
  it('are absent unless switched on (VITE_VENUES_ENABLED)', () => {
    expect(create({ venues: false }).venues).toBeNull()
    expect(create().venues).not.toBeNull()
  })

  it('lists the venues the user belongs to, by name, with their role', async () => {
    const workspaces = await create().venues!.listWorkspaces()
    expect(
      workspaces.map(({ organization, role }) => [organization.name, role]),
    ).toEqual([
      ['Grand Garden Hall', 'VENUE_OWNER'],
      ['Seaside Terrace', 'VENUE_MANAGER'],
    ])
  })

  it('reports a venue the user does not belong to as not found', async () => {
    const state = generateDemoState(NOW)
    const venues = create({
      state: {
        ...state,
        venueMembers: (state.venueMembers ?? []).filter(
          (member) =>
            !(
              member.organizationId === 'org-2' &&
              member.userId === state.currentUserId
            ),
        ),
      },
    }).venues!

    expect(
      (await venues.listWorkspaces()).map((w) => w.organization.id),
    ).toEqual(['org-1'])
    for (const action of [
      venues.getWorkspace('org-2'),
      venues.listSpaces('org-2'),
      venues.listEvents('org-2'),
      venues.getWorkspace('org-404'),
    ]) {
      expect(await codeOf(action)).toBe('NOT_FOUND')
    }
  })

  it('lists a venue’s events with their status, upcoming first then past', async () => {
    const events = await create().venues!.listEvents('org-1')
    expect(
      events.map(({ event, status, space }) => [
        event.name,
        status,
        space.name,
      ]),
    ).toEqual([
      ['Dana & Yossi’s Wedding', 'CLIENT_JOINED', 'Main Hall'],
      ['Cohen Bar Mitzvah', 'INVITATION_SENT', 'Garden'],
      ['Peretz Engagement Party', 'INVITATION_EXPIRED', 'Garden'],
      ['Noa & Amit’s Wedding', 'AWAITING_CLIENT', 'Main Hall'],
      ['Brightline Year-End Party', 'CLIENT_JOINED', 'Garden'],
      ['Shira & Ben’s Wedding', 'PAST', 'Main Hall'],
      ['Miriam’s 60th Birthday', 'PAST', 'Garden'],
    ])
  })

  it('tells when an open invitation expires, and not once accepted', async () => {
    const events = await create().venues!.listEvents('org-1')
    const byStatus = (status: string) =>
      events.find((summary) => summary.status === status)!
    expect(byStatus('INVITATION_SENT').invitationExpiresAt).toBe(
      '2026-10-16T09:00:00.000Z',
    )
    expect(byStatus('CLIENT_JOINED').invitationExpiresAt).toBeNull()
    expect(byStatus('AWAITING_CLIENT').client).toBeNull()
    expect(byStatus('CLIENT_JOINED').confirmedAttendees).toBeGreaterThan(0)
  })

  it('lists only the venue’s own spaces', async () => {
    const venues = create().venues!
    const names = async (organizationId: string) =>
      (await venues.listSpaces(organizationId)).map(({ space }) => space.name)
    expect(await names('org-1')).toEqual([
      'Garden',
      'Main Hall',
      'Rooftop Lounge',
      'Winter Pavilion',
    ])
    expect(await names('org-2')).toEqual(['Terrace'])
  })

  it('keeps venue events out of the personal My Events', async () => {
    const services = create()
    const personal = await services.events.list()
    expect(personal.map((summary) => summary.event.id).sort()).toEqual([
      'evt-1',
      'evt-2',
      'evt-3',
      'evt-4',
      'evt-5',
      'evt-6',
    ])
  })

  it('does not count venue events against the visitor’s own (D109)', async () => {
    const services = create()
    // The sample has six personal events; the limit is ten.
    for (let index = 0; index < DEMO_LIMITS.events - 6; index += 1) {
      await services.events.create({
        name: `Own event ${index + 1}`,
        startsAt: '2027-03-01T17:00:00.000Z',
        timeZone: 'Asia/Jerusalem',
        maxAttendees: 100,
        defaultAllowedAttendees: 5,
        rsvpLanguage: 'en',
        country: 'IL',
      })
    }
    expect(
      await codeOf(
        services.events.create({
          name: 'One too many',
          startsAt: '2027-03-01T17:00:00.000Z',
          timeZone: 'Asia/Jerusalem',
          maxAttendees: 100,
          defaultAllowedAttendees: 5,
          rsvpLanguage: 'en',
          country: 'IL',
        }),
      ),
    ).toBe('DEMO_EVENT_LIMIT')
  })

  it('fits the generated demo well inside the browser’s storage', () => {
    for (const market of ['IL', 'BR'] as const) {
      const length = JSON.stringify({
        version: DATASET_VERSION,
        state: generateDemoState(NOW, market),
      }).length
      expect(length).toBeLessThan(DEMO_LIMITS.storedLength / 2)
    }
  })
})

describe('venue spaces and layouts (mockups #3–5)', () => {
  const input = {
    name: 'Sky Terrace',
    address: '12 Orchard Lane, Ramat Gan',
    maxPeople: 150,
    maxTables: 15,
    timeZone: 'Asia/Jerusalem',
  }

  it('summarizes each space for My Spaces', async () => {
    const spaces = await create().venues!.listSpaces('org-1')
    const byName = (name: string) =>
      spaces.find((summary) => summary.space.name === name)!
    expect(byName('Main Hall')).toMatchObject({
      layoutCount: 3,
      upcomingEventCount: 2,
      nextEvent: { name: 'Dana & Yossi’s Wedding' },
    })
    expect(byName('Rooftop Lounge')).toMatchObject({
      layoutCount: 0,
      upcomingEventCount: 0,
      nextEvent: null,
    })
    expect(byName('Winter Pavilion').space.archived).toBe(true)
  })

  it('creates a space, as the Owner or a Manager, with a unique name', async () => {
    const venues = create().venues!
    const created = await venues.createSpace('org-1', input)
    expect(created).toMatchObject({ ...input, archived: false, photo: null })
    expect(await codeOf(venues.createSpace('org-1', input))).toBe('VALIDATION')
    expect(
      (await venues.createSpace('org-2', { ...input, name: 'Deck' })).name,
    ).toBe('Deck')
    expect(await codeOf(venues.createSpace('org-404', input))).toBe('NOT_FOUND')
  })

  it('changes a space for new events only (D111)', async () => {
    const services = create()
    const venues = services.venues!
    const before = await venues.listEvents('org-1')
    await venues.updateSpace('org-1', 'spc-1-1', {
      ...input,
      name: 'Main Hall',
      address: '1 New Street, Tel Aviv',
      maxPeople: 380,
    })
    const after = await venues.listEvents('org-1')
    expect(after.map((summary) => summary.event.location)).toEqual(
      before.map((summary) => summary.event.location),
    )
    expect((await venues.getSpace('org-1', 'spc-1-1')).space.address).toBe(
      '1 New Street, Tel Aviv',
    )
  })

  it('archives and restores a space without touching its events', async () => {
    const venues = create().venues!
    await venues.setSpaceArchived('org-1', 'spc-1-1', true)
    expect((await venues.getSpace('org-1', 'spc-1-1')).space.archived).toBe(
      true,
    )
    expect(await venues.listEvents('org-1')).toHaveLength(7)
    await venues.setSpaceArchived('org-1', 'spc-1-1', false)
    expect((await venues.getSpace('org-1', 'spc-1-1')).space.archived).toBe(
      false,
    )
  })

  it('shows a space’s templates with their figures and upcoming events', async () => {
    const details = await create().venues!.getSpace('org-1', 'spc-1-1')
    expect(details.templates.map((t) => t.template.name)).toEqual([
      'Bar Mitzvah Mixed',
      'Classic Rounds',
      'Gala Long Tables',
      'Wedding Rounds',
    ])
    for (const { template, figures } of details.templates) {
      expect(figures.tables).toBe(template.tables.length)
    }
    expect(details.upcomingEvents.map((e) => e.event.name)).toEqual([
      'Dana & Yossi’s Wedding',
      'Noa & Amit’s Wedding',
    ])
    expect(details.upcomingEvents[0]?.templateName).toBe('Wedding Rounds')
  })

  it('duplicates a template under a new name, and archives one', async () => {
    const venues = create().venues!
    const copy = await venues.duplicateTemplate('org-1', 'tpl-1-1-1')
    expect(copy.name).toBe('Wedding Rounds (2)')
    expect((await venues.duplicateTemplate('org-1', 'tpl-1-1-1')).name).toBe(
      'Wedding Rounds (3)',
    )
    const archived = await venues.setTemplateArchived('org-1', copy.id, true)
    expect(archived.archived).toBe(true)
    expect(await codeOf(venues.duplicateTemplate('org-2', 'tpl-1-1-1'))).toBe(
      'NOT_FOUND',
    )
  })
})

describe('venue team and settings (mockups #7, #8)', () => {
  it('lists the members, Owners first, and the pending invitations', async () => {
    const team = await create().venues!.getTeam('org-1')
    expect(team.members.map((member) => [member.role, member.isYou])).toEqual([
      ['VENUE_OWNER', true],
      ['VENUE_MANAGER', false],
      ['VENUE_MANAGER', false],
    ])
    expect(team.invitations.map((invitation) => invitation.email)).toEqual([
      'daniel.mor@example.com',
    ])
  })

  it('lets a Manager see the team but not change it', async () => {
    const venues = create().venues!
    const team = await venues.getTeam('org-2')
    const owner = team.members.find((m) => m.role === 'VENUE_OWNER')!
    expect(
      await codeOf(
        venues.inviteMember('org-2', {
          email: 'new@example.com',
          role: 'VENUE_MANAGER',
        }),
      ),
    ).toBe('FORBIDDEN')
    expect(await codeOf(venues.removeMember('org-2', owner.userId))).toBe(
      'FORBIDDEN',
    )
    expect(
      await codeOf(
        venues.updateOrganization('org-2', {
          name: 'Renamed',
          defaultLanguage: 'en',
          contactEmail: null,
          contactPhone: null,
        }),
      ),
    ).toBe('FORBIDDEN')
  })

  it('invites, resends and cancels as the Owner, refusing duplicates', async () => {
    const venues = create().venues!
    await venues.inviteMember('org-1', {
      email: ' New.Person@Example.com ',
      role: 'VENUE_MANAGER',
    })
    let team = await venues.getTeam('org-1')
    expect(team.invitations.map((i) => i.email)).toContain(
      'new.person@example.com',
    )
    expect(
      await codeOf(
        venues.inviteMember('org-1', {
          email: 'new.person@example.com',
          role: 'VENUE_OWNER',
        }),
      ),
    ).toBe('ALREADY_INVITED')
    const memberEmail = team.members[1]!.email
    expect(
      await codeOf(
        venues.inviteMember('org-1', {
          email: memberEmail,
          role: 'VENUE_MANAGER',
        }),
      ),
    ).toBe('ALREADY_MEMBER')
    await venues.resendMemberInvitation('org-1', 'new.person@example.com')
    await venues.cancelMemberInvitation('org-1', 'new.person@example.com')
    team = await venues.getTeam('org-1')
    expect(team.invitations.map((i) => i.email)).not.toContain(
      'new.person@example.com',
    )
  })

  it('changes a role and removes a member, but never oneself', async () => {
    const venues = create().venues!
    const team = await venues.getTeam('org-1')
    const me = team.members.find((m) => m.isYou)!
    const manager = team.members.find((m) => m.role === 'VENUE_MANAGER')!
    await venues.changeMemberRole('org-1', manager.userId, 'VENUE_OWNER')
    expect(
      (await venues.getTeam('org-1')).members.find(
        (m) => m.userId === manager.userId,
      )?.role,
    ).toBe('VENUE_OWNER')
    await venues.removeMember('org-1', manager.userId)
    expect(
      (await venues.getTeam('org-1')).members.some(
        (m) => m.userId === manager.userId,
      ),
    ).toBe(false)
    expect(await codeOf(venues.removeMember('org-1', me.userId))).toBe(
      'SELF_PERMISSION',
    )
  })

  it('saves the venue’s settings as the Owner (D117)', async () => {
    const venues = create().venues!
    const updated = await venues.updateOrganization('org-1', {
      name: 'Grand Garden Hall & Gardens',
      defaultLanguage: 'he',
      contactEmail: 'Hello@Example.com',
      contactPhone: '',
    })
    expect(updated).toMatchObject({
      name: 'Grand Garden Hall & Gardens',
      defaultLanguage: 'he',
      contactEmail: 'hello@example.com',
      contactPhone: null,
    })
    expect((await venues.getWorkspace('org-1')).organization.name).toBe(
      'Grand Garden Hall & Gardens',
    )
  })
})

describe('editing a layout template (Phase 26)', () => {
  it('creates an empty template with a unique name, and renames it', async () => {
    const venues = create().venues!
    const created = await venues.createTemplate(
      'org-1',
      'spc-1-3',
      'Rooftop Rounds',
    )
    expect(created).toMatchObject({
      name: 'Rooftop Rounds',
      tables: [],
      version: 0,
    })
    expect(
      await codeOf(venues.createTemplate('org-1', 'spc-1-3', 'rooftop rounds')),
    ).toBe('VALIDATION')
    const renamed = await venues.renameTemplate(
      'org-1',
      created.id,
      'Sky Rounds',
    )
    expect(renamed.name).toBe('Sky Rounds')
    const details = await venues.getTemplate('org-1', created.id)
    expect(details.space.name).toBe('Rooftop Lounge')
    expect(details.upcomingEventCount).toBe(0)
  })

  it('adds, changes and removes tables, checking numbers like an event', async () => {
    const venues = create().venues!
    const { id } = await venues.createTemplate('org-1', 'spc-1-3', 'Mixed')
    await venues.addTemplateTable('org-1', id, {
      number: 1,
      capacity: 10,
      shape: 'CIRCLE',
    })
    await venues.addTemplateTable('org-1', id, {
      number: 2,
      capacity: 8,
      shape: 'SQUARE',
    })
    expect(
      await codeOf(
        venues.addTemplateTable('org-1', id, {
          number: 2,
          capacity: 6,
          shape: 'CIRCLE',
        }),
      ),
    ).toBe('DUPLICATE_TABLE_NUMBER')
    await venues.updateTemplateTable('org-1', id, 2, {
      number: 3,
      capacity: 12,
      shape: 'RECTANGLE',
    })
    const after = await venues.removeTemplateTable('org-1', id, 1)
    expect(after.tables).toEqual([
      {
        number: 3,
        capacity: 12,
        shape: 'RECTANGLE',
        x: null,
        y: null,
        rotation: 0,
      },
    ])
    expect(await codeOf(venues.removeTemplateTable('org-1', id, 9))).toBe(
      'NOT_FOUND',
    )
  })

  it('saves the plan, refusing one made on an older version', async () => {
    const venues = create().venues!
    const { template } = await venues.getTemplate('org-1', 'tpl-1-1-1')
    const first = template.tables[0]!
    const input = {
      roomWidth: template.roomWidth,
      roomDepth: template.roomDepth,
      floorImage: null,
      floorImageTransparency: template.floorImageTransparency,
      floorImageZoom: template.floorImageZoom,
      floorImageRotation: template.floorImageRotation,
      objects: template.objects,
      placements: [
        {
          tableId: `${template.id}#${first.number}`,
          x: 400,
          y: 400,
          rotation: 0,
        },
      ],
      version: template.version,
    }
    const saved = await venues.saveTemplateLayout('org-1', template.id, input)
    expect(saved.version).toBe(template.version + 1)
    expect(saved.tables.filter((table) => table.x !== null)).toHaveLength(1)
    expect(
      await codeOf(venues.saveTemplateLayout('org-1', template.id, input)),
    ).toBe('LAYOUT_CHANGED')
  })

  it('never changes an event made from the template (D111)', async () => {
    const persistence = createMemoryPersistence<StoredDemo>({
      version: DATASET_VERSION,
      state: generateDemoState(NOW),
    })
    const venues = createMockServices({
      persistence,
      now: () => NOW,
      venues: true,
    }).venues!
    const stored = () => (persistence.load() as StoredDemo).state
    const eventId = stored().venueEvents?.find(
      (venueEvent) => venueEvent.templateId === 'tpl-1-1-1',
    )?.eventId
    expect(eventId).toBeDefined()
    const tablesOf = () =>
      stored().tables.filter((table) => table.eventId === eventId)
    const before = tablesOf()
    expect(before.length).toBeGreaterThan(0)

    const { template } = await venues.getTemplate('org-1', 'tpl-1-1-1')
    await venues.removeTemplateTable(
      'org-1',
      template.id,
      template.tables[0]!.number,
    )
    await venues.renameTemplate('org-1', template.id, 'Renamed Rounds')

    expect(tablesOf()).toEqual(before)
    expect(
      (await venues.getTemplate('org-1', template.id)).template.tables,
    ).toHaveLength(template.tables.length - 1)
  })
})

describe('creating a venue event (Phase 27, mockup #9)', () => {
  const input = {
    spaceId: 'spc-1-1',
    templateId: 'tpl-1-1-1',
    name: 'Maya & Daniel’s Wedding',
    startsAt: '2027-01-14T17:00:00.000Z',
  }

  it('creates the event from the space and its layout, with its own copy', async () => {
    const persistence = createMemoryPersistence<StoredDemo>({
      version: DATASET_VERSION,
      state: generateDemoState(NOW),
    })
    const services = createMockServices({
      persistence,
      now: () => NOW,
      venues: true,
    })
    const event = await services.venues!.createEvent('org-1', {
      ...input,
      clientEmail: ' Maya.Cohen@Example.com ',
    })
    const stored = (persistence.load() as StoredDemo).state
    const space = stored.venueSpaces!.find((s) => s.id === 'spc-1-1')!
    const template = stored.layoutTemplates!.find((t) => t.id === 'tpl-1-1-1')!

    expect(event).toMatchObject({
      name: input.name,
      location: space.address,
      maxAttendees: space.maxPeople,
      timeZone: space.timeZone,
      rsvpLanguage: 'en',
    })
    const tables = stored.tables.filter((table) => table.eventId === event.id)
    expect(tables.map((table) => table.number)).toEqual(
      template.tables.map((table) => table.number),
    )
    expect(tables.every((table) => !table.id.startsWith('tpl'))).toBe(true)
    expect(stored.guests.some((guest) => guest.eventId === event.id)).toBe(
      false,
    )
    expect(
      stored.venueEvents!.find((v) => v.eventId === event.id),
    ).toMatchObject({
      templateId: 'tpl-1-1-1',
      client: { email: 'maya.cohen@example.com', acceptedAt: null },
    })

    const listed = await services.venues!.listEvents('org-1')
    expect(listed.find((s) => s.event.id === event.id)?.status).toBe(
      'INVITATION_SENT',
    )
    expect(
      (await services.events.list()).some((s) => s.event.id === event.id),
    ).toBe(false)
  })

  it('waits for a client when no email is given', async () => {
    const venues = create().venues!
    const event = await venues.createEvent('org-1', input)
    const listed = await venues.listEvents('org-1')
    expect(listed.find((s) => s.event.id === event.id)?.status).toBe(
      'AWAITING_CLIENT',
    )
  })

  it('refuses an archived layout, one of another space, a past date or a bad email', async () => {
    const venues = create().venues!
    expect(
      await codeOf(
        venues.createEvent('org-1', { ...input, templateId: 'tpl-1-1-4' }),
      ),
    ).toBe('VALIDATION')
    expect(
      await codeOf(
        venues.createEvent('org-1', { ...input, templateId: 'tpl-1-2-1' }),
      ),
    ).toBe('VALIDATION')
    expect(
      await codeOf(
        venues.createEvent('org-1', {
          ...input,
          startsAt: '2026-01-01T10:00:00.000Z',
        }),
      ),
    ).not.toBe('NO_ERROR')
    expect(
      await codeOf(
        venues.createEvent('org-1', { ...input, clientEmail: 'nope' }),
      ),
    ).toBe('VALIDATION')
    expect(await codeOf(venues.createEvent('org-2', input))).toBe('NOT_FOUND')
  })

  it('lets a Manager create events too (D112)', async () => {
    const venues = create().venues!
    const event = await venues.createEvent('org-2', {
      ...input,
      spaceId: 'spc-2-1',
      templateId: 'tpl-2-1-1',
    })
    expect(event.name).toBe(input.name)
  })
})

describe('the client invitation (Phase 28, mockups #10 and #12)', () => {
  async function setup() {
    const persistence = createMemoryPersistence<StoredDemo>({
      version: DATASET_VERSION,
      state: generateDemoState(NOW),
    })
    const services = createMockServices({
      persistence,
      now: () => NOW,
      venues: true,
    })
    const venues = services.venues!
    const events = await venues.listEvents('org-1')
    const withStatus = (status: string) =>
      events.find((summary) => summary.status === status)!.event.id
    const stored = () => (persistence.load() as StoredDemo).state
    return { venues, withStatus, stored }
  }

  it('shows the joined client, their team and the venue team', async () => {
    const { venues, withStatus } = await setup()
    const people = await venues.getEventPeople(
      'org-1',
      withStatus('CLIENT_JOINED'),
    )
    expect(people.client).toMatchObject({ name: 'Dana Levi', timesSent: 1 })
    expect(people.client?.acceptedAt).not.toBeNull()
    expect(people.demoLinkToken).toBeNull()
    expect(
      people.clientTeam.map((entry) => [entry.role, entry.pending]),
    ).toEqual([
      ['CLIENT_LEAD', false],
      ['CLIENT_EDITOR', false],
      ['CLIENT_VIEWER', false],
      ['CLIENT_EDITOR', true],
    ])
    expect(people.guestCount).toBeGreaterThan(0)
    expect(people.venueTeam[0]?.role).toBe('VENUE_OWNER')
    // The venue never sees guests' phone numbers (D111, Q2).
    expect(JSON.stringify(people)).not.toMatch(/\+972|\(?0\d\)? ?0000/)
  })

  it('resends a new link and stops the earlier one', async () => {
    const { venues, withStatus } = await setup()
    const eventId = withStatus('INVITATION_SENT')
    const before = await venues.getEventPeople('org-1', eventId)
    const oldToken = before.demoLinkToken!
    expect((await venues.getClientInvitation(oldToken)).state).toBe('OPEN')

    await venues.resendClientInvitation('org-1', eventId)
    const after = await venues.getEventPeople('org-1', eventId)
    expect(after.client?.timesSent).toBe(2)
    expect(after.client?.sentAt).toBe(NOW.toISOString())
    expect(after.demoLinkToken).not.toBe(oldToken)
    expect((await venues.getClientInvitation(oldToken)).state).toBe('REVOKED')
  })

  it('a resend brings an expired invitation back', async () => {
    const { venues, withStatus } = await setup()
    const eventId = withStatus('INVITATION_EXPIRED')
    const token = (await venues.getEventPeople('org-1', eventId)).demoLinkToken!
    expect((await venues.getClientInvitation(token)).state).toBe('EXPIRED')
    await venues.resendClientInvitation('org-1', eventId)
    const events = await venues.listEvents('org-1')
    expect(events.find((s) => s.event.id === eventId)?.status).toBe(
      'INVITATION_SENT',
    )
  })

  it('invites a different client, or revokes, before anyone joins', async () => {
    const { venues, withStatus } = await setup()
    const eventId = withStatus('INVITATION_SENT')
    const oldToken = (await venues.getEventPeople('org-1', eventId))
      .demoLinkToken!

    await venues.inviteClient('org-1', eventId, 'New.Client@Example.com')
    const changed = await venues.getEventPeople('org-1', eventId)
    expect(changed.client?.email).toBe('new.client@example.com')
    expect(changed.client?.timesSent).toBe(1)
    expect((await venues.getClientInvitation(oldToken)).state).toBe('REVOKED')

    const newToken = changed.demoLinkToken!
    await venues.revokeClientInvitation('org-1', eventId)
    expect((await venues.getEventPeople('org-1', eventId)).client).toBeNull()
    expect((await venues.getClientInvitation(newToken)).state).toBe('REVOKED')
  })

  it('invites a client to an event awaiting one', async () => {
    const { venues, withStatus } = await setup()
    const eventId = withStatus('AWAITING_CLIENT')
    await venues.inviteClient('org-1', eventId, 'couple@example.com')
    const people = await venues.getEventPeople('org-1', eventId)
    expect(people.summary.status).toBe('INVITATION_SENT')
    expect(people.client?.sentByName).toBe('Alex Morgan')
  })

  it('keeps a joined client and a past event as they are', async () => {
    const { venues, withStatus } = await setup()
    const joined = withStatus('CLIENT_JOINED')
    expect(
      await codeOf(venues.inviteClient('org-1', joined, 'x@example.com')),
    ).toBe('VALIDATION')
    expect(await codeOf(venues.revokeClientInvitation('org-1', joined))).toBe(
      'VALIDATION',
    )
    expect(await codeOf(venues.resendClientInvitation('org-1', joined))).toBe(
      'VALIDATION',
    )
    expect(
      await codeOf(
        venues.inviteClient('org-1', withStatus('PAST'), 'x@example.com'),
      ),
    ).toBe('EVENT_READ_ONLY')
    expect(
      await codeOf(
        venues.inviteClient('org-1', withStatus('AWAITING_CLIENT'), 'nope'),
      ),
    ).toBe('VALIDATION')
  })

  it('reaches no other venue’s event, and no unknown link', async () => {
    const { venues, withStatus } = await setup()
    const eventId = withStatus('INVITATION_SENT')
    // org-2 is a venue the demo user is in, but the event isn't its.
    expect(await codeOf(venues.getEventPeople('org-2', eventId))).toBe(
      'NOT_FOUND',
    )
    expect(await codeOf(venues.getEventPeople('org-9', eventId))).toBe(
      'NOT_FOUND',
    )
    expect(await codeOf(venues.revokeClientInvitation('org-2', eventId))).toBe(
      'NOT_FOUND',
    )
    expect(await codeOf(venues.getClientInvitation('not-a-token'))).toBe(
      'NOT_FOUND',
    )
  })

  it('accepts only with the invited email, never as a venue member', async () => {
    const { venues, withStatus, stored } = await setup()
    const eventId = withStatus('INVITATION_SENT')
    const token = (await venues.getEventPeople('org-1', eventId)).demoLinkToken!

    const view = await venues.getClientInvitation(token)
    expect(view).toMatchObject({
      state: 'OPEN',
      emailMatches: false,
      isYours: false,
      venueName: 'Grand Garden Hall',
      signedInAs: { name: 'Alex Morgan' },
    })
    expect(await codeOf(venues.acceptClientInvitation(token))).toBe('FORBIDDEN')

    await venues.acceptClientInvitationAsInvitee!(token)
    const people = await venues.getEventPeople('org-1', eventId)
    expect(people.summary.status).toBe('CLIENT_JOINED')
    expect(people.clientTeam).toMatchObject([
      {
        role: 'CLIENT_LEAD',
        email: 'rachel.cohen@example.com',
        pending: false,
      },
    ])
    expect((await venues.getClientInvitation(token)).state).toBe('USED')
    expect(await codeOf(venues.acceptClientInvitationAsInvitee!(token))).toBe(
      'LINK_EXPIRED',
    )
    // The client is never a member of the personal event records.
    expect(stored().memberships.some((m) => m.eventId === eventId)).toBe(false)
  })

  it('refuses a venue member who has the invited email', async () => {
    const { venues, withStatus } = await setup()
    const eventId = withStatus('AWAITING_CLIENT')
    // The demo user's own address: they are the venue's Owner.
    await venues.inviteClient('org-1', eventId, 'alex.morgan@example.com')
    const token = (await venues.getEventPeople('org-1', eventId)).demoLinkToken!
    expect((await venues.getClientInvitation(token)).emailMatches).toBe(true)
    expect(await codeOf(venues.acceptClientInvitation(token))).toBe('FORBIDDEN')
  })

  it('a Manager handles the client too (D112)', async () => {
    const { venues } = await setup()
    const event = await venues.createEvent('org-2', {
      spaceId: 'spc-2-1',
      templateId: 'tpl-2-1-1',
      name: 'Terrace Dinner',
      startsAt: '2027-01-14T17:00:00.000Z',
    })
    await venues.inviteClient('org-2', event.id, 'c@example.com')
    await venues.resendClientInvitation('org-2', event.id)
    const people = await venues.getEventPeople('org-2', event.id)
    expect(people.client).toMatchObject({
      email: 'c@example.com',
      timesSent: 2,
    })
  })

  it('refuses a resend or revoke with no client, and shows a past event', async () => {
    const { venues, withStatus } = await setup()
    const awaiting = withStatus('AWAITING_CLIENT')
    expect(await codeOf(venues.resendClientInvitation('org-1', awaiting))).toBe(
      'NOT_FOUND',
    )
    expect(await codeOf(venues.revokeClientInvitation('org-1', awaiting))).toBe(
      'NOT_FOUND',
    )
    const past = await venues.getEventPeople('org-1', withStatus('PAST'))
    expect(past.summary.isPast).toBe(true)
    expect(past.demoLinkToken).toBeNull()
    expect(
      await codeOf(venues.revokeClientInvitation('org-1', withStatus('PAST'))),
    ).not.toBe('NO_ERROR')
  })

  it('shows a joined client’s used link, not as the viewer’s own', async () => {
    const { venues, withStatus, stored } = await setup()
    const eventId = withStatus('CLIENT_JOINED')
    const link = stored().clientInvitationLinks!.find(
      (l) => l.eventId === eventId,
    )!
    const view = await venues.getClientInvitation(link.token)
    expect(view).toMatchObject({
      state: 'USED',
      isYours: false,
      emailMatches: false,
    })
    expect(view.invitedBy?.name).toBeTruthy()
    expect(await codeOf(venues.acceptClientInvitation(link.token))).toBe(
      'LINK_EXPIRED',
    )
  })

  it('accepts for an invitee who already has an account', async () => {
    const { venues, withStatus } = await setup()
    const eventId = withStatus('INVITATION_SENT')
    // Dana Levi has an account: she leads another event.
    await venues.inviteClient('org-1', eventId, 'dana.levi@example.com')
    const token = (await venues.getEventPeople('org-1', eventId)).demoLinkToken!
    await venues.acceptClientInvitationAsInvitee!(token)
    const people = await venues.getEventPeople('org-1', eventId)
    expect(people.client?.name).toBe('Dana Levi')
    expect(people.clientTeam[0]).toMatchObject({
      name: 'Dana Levi',
      role: 'CLIENT_LEAD',
    })
  })

  it('a member of no venue reaches no venue event', async () => {
    const services = create()
    const venues = services.venues!
    const events = await venues.listEvents('org-1')
    const eventId = events[0]!.event.id
    expect(
      await codeOf(venues.inviteClient('org-3', eventId, 'a@example.com')),
    ).toBe('NOT_FOUND')
    expect(await codeOf(venues.resendClientInvitation('org-3', eventId))).toBe(
      'NOT_FOUND',
    )
  })
})
