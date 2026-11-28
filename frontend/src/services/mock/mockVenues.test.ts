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
