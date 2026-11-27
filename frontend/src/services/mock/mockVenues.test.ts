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
    expect(
      (await venues.listSpaces('org-1')).map((space) => space.name),
    ).toEqual(['Garden', 'Main Hall'])
    expect(
      (await venues.listSpaces('org-2')).map((space) => space.name),
    ).toEqual(['Terrace'])
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
