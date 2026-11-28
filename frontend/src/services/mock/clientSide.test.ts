import { describe, expect, it } from 'vitest'
import { DomainError, type DomainErrorCode } from '../../domain/errors.ts'
import { generateDemoState } from './generator.ts'
import { createMockServices } from './mockServices.ts'
import { createMemoryPersistence } from './persistence.ts'
import { DATASET_VERSION, type DemoState, type StoredDemo } from './state.ts'

const NOW = new Date('2026-10-12T09:00:00.000Z')

function create(state: DemoState = generateDemoState(NOW), venues = true) {
  return createMockServices({
    persistence: createMemoryPersistence<StoredDemo>({
      version: DATASET_VERSION,
      state,
    }),
    now: () => NOW,
    venues,
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

/** The demo, switched to the client (#23). */
async function asClient() {
  const services = create()
  const view = (await services.demo!.getViewAs())!
  await services.demo!.setViewAs('CLIENT')
  return { services, eventId: view.client.eventId, view }
}

describe('the venue demo’s switcher (#23, Phase 29b)', () => {
  it('names the demo user and the client, and switches between them', async () => {
    const services = create()
    const view = await services.demo!.getViewAs()
    expect(view).toMatchObject({
      view: 'SELF',
      self: { name: 'Alex Morgan', venueName: 'Grand Garden Hall' },
      client: { name: 'Dana Levi' },
    })
    await services.demo!.setRole('VIEWER')
    await services.demo!.setViewAs('CLIENT')
    expect((await services.session.getCurrentUser()).name).toBe('Dana Levi')
    // The client has no personal role to simulate.
    expect(await services.demo!.getRole()).toBeNull()
    await services.demo!.setViewAs('SELF')
    expect((await services.session.getCurrentUser()).name).toBe('Alex Morgan')
  })

  it('is absent without venues', async () => {
    const services = create(generateDemoState(NOW), false)
    expect(await services.demo!.getViewAs()).toBeNull()
    expect(await codeOf(services.demo!.setViewAs('CLIENT'))).toBe('NOT_FOUND')
  })

  it('gives the client their event among My Events, managed by the venue', async () => {
    const { services, eventId } = await asClient()
    const events = await services.events.list()
    expect(events.map((summary) => summary.event.id)).toEqual([eventId])
    expect(events[0]).toMatchObject({
      role: 'CLIENT_LEAD',
      venue: { name: 'Grand Garden Hall' },
    })
    // The client sees phones; the venue's workspace is not theirs.
    expect(
      (await services.guests.list(eventId)).some((guest) => guest.phone !== ''),
    ).toBe(true)
    expect(await services.venues!.listWorkspaces()).toEqual([])
    expect(await codeOf(services.venues!.listEvents('org-1'))).toBe('NOT_FOUND')
  })

  it('lets the client change the name and guests, never the schedule or tables', async () => {
    const { services, eventId } = await asClient()
    const { event } = await services.events.get(eventId)
    const renamed = await services.events.update(eventId, {
      ...event,
      name: 'Dana & Yossi — the Wedding',
    })
    expect(renamed.name).toBe('Dana & Yossi — the Wedding')
    expect(
      await codeOf(
        services.events.update(eventId, { ...event, maxAttendees: 999 }),
      ),
    ).toBe('FORBIDDEN')
    expect(
      await codeOf(
        services.tables.create(eventId, {
          number: 99,
          capacity: 8,
          shape: 'CIRCLE',
        }),
      ),
    ).toBe('FORBIDDEN')
  })
})

describe('the client lead’s team (#15, Phase 29b)', () => {
  it('lists both teams, the lead first and the venue read-only', async () => {
    const { services, eventId } = await asClient()
    const team = await services.venues!.getClientTeam(eventId)
    expect(team.members[0]).toMatchObject({
      name: 'Dana Levi',
      role: 'CLIENT_LEAD',
      isYou: true,
    })
    expect(team.members.some((member) => member.pending)).toBe(true)
    expect(team.venueName).toBe('Grand Garden Hall')
    expect(team.venueTeam[0]?.role).toBe('VENUE_OWNER')
  })

  it('invites, changes and removes, but never the lead', async () => {
    const { services, eventId } = await asClient()
    const venues = services.venues!
    await venues.inviteToClientTeam(
      eventId,
      'Planner@Example.com',
      'CLIENT_VIEWER',
    )
    let team = await venues.getClientTeam(eventId)
    expect(
      team.members.find((member) => member.email === 'planner@example.com'),
    ).toMatchObject({ pending: true, role: 'CLIENT_VIEWER' })

    expect(
      await codeOf(
        venues.inviteToClientTeam(
          eventId,
          'planner@example.com',
          'CLIENT_EDITOR',
        ),
      ),
    ).toBe('ALREADY_INVITED')
    // Someone with an account joins at once.
    await venues.inviteToClientTeam(
      eventId,
      'jordan.hale@example.com',
      'CLIENT_EDITOR',
    )
    team = await venues.getClientTeam(eventId)
    expect(
      team.members.find((member) => member.email === 'jordan.hale@example.com'),
    ).toMatchObject({ pending: false, name: 'Jordan Hale' })
    expect(
      await codeOf(
        venues.inviteToClientTeam(
          eventId,
          'jordan.hale@example.com',
          'CLIENT_EDITOR',
        ),
      ),
    ).toBe('ALREADY_MEMBER')

    await venues.changeClientTeamRole(
      eventId,
      'planner@example.com',
      'CLIENT_EDITOR',
    )
    await venues.removeFromClientTeam(eventId, 'jordan.hale@example.com')
    team = await venues.getClientTeam(eventId)
    expect(
      team.members.find((member) => member.email === 'planner@example.com')
        ?.role,
    ).toBe('CLIENT_EDITOR')
    expect(
      team.members.some((member) => member.email === 'jordan.hale@example.com'),
    ).toBe(false)

    expect(
      await codeOf(
        venues.changeClientTeamRole(
          eventId,
          'dana.levi@example.com',
          'CLIENT_VIEWER',
        ),
      ),
    ).toBe('SELF_PERMISSION')
    expect(
      await codeOf(
        venues.removeFromClientTeam(eventId, 'dana.levi@example.com'),
      ),
    ).toBe('SELF_PERMISSION')
    expect(
      await codeOf(venues.removeFromClientTeam(eventId, 'nobody@example.com')),
    ).toBe('NOT_FOUND')
    expect(
      await codeOf(
        venues.inviteToClientTeam(
          eventId,
          'x@example.com',
          'CLIENT_LEAD' as never,
        ),
      ),
    ).toBe('VALIDATION')
  })

  it('keeps the venue’s people out of the client’s team', async () => {
    const { services, eventId } = await asClient()
    expect(
      await codeOf(
        services.venues!.inviteToClientTeam(
          eventId,
          'alex.morgan@example.com',
          'CLIENT_EDITOR',
        ),
      ),
    ).toBe('FORBIDDEN')
  })

  it('is the client’s: the venue can neither read nor change it', async () => {
    const services = create()
    const view = (await services.demo!.getViewAs())!
    const eventId = view.client.eventId
    expect(await codeOf(services.venues!.getClientTeam(eventId))).toBe(
      'FORBIDDEN',
    )
    expect(
      await codeOf(
        services.venues!.inviteToClientTeam(
          eventId,
          'a@example.com',
          'CLIENT_EDITOR',
        ),
      ),
    ).toBe('FORBIDDEN')
  })

  it('lets an Editor see the team but not change it', async () => {
    const state = generateDemoState(NOW)
    const eventId = (await create(state).demo!.getViewAs())!.client.eventId
    const editor = state.clientTeam!.find(
      (member) => member.eventId === eventId && member.role === 'CLIENT_EDITOR',
    )!
    const asEditor = createMockServices({
      persistence: createMemoryPersistence<StoredDemo>({
        version: DATASET_VERSION,
        state,
      }),
      now: () => NOW,
      venues: true,
      actingUserId: editor.userId,
    })
    expect((await asEditor.events.get(eventId)).role).toBe('CLIENT_EDITOR')
    const team = await asEditor.venues!.getClientTeam(eventId)
    expect(team.members.find((member) => member.isYou)?.role).toBe(
      'CLIENT_EDITOR',
    )
    expect(
      await codeOf(
        asEditor.venues!.inviteToClientTeam(
          eventId,
          'a@example.com',
          'CLIENT_VIEWER',
        ),
      ),
    ).toBe('FORBIDDEN')
  })
})
