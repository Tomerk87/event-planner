import { describe, expect, it } from 'vitest'
import { DomainError } from './errors.ts'
import {
  assertCanChangeVenueMember,
  invitationExpiresAt,
  templateFigures,
  validateOrganizationInput,
  validateSpaceInput,
  venueCan,
  venueEventStatus,
  type ClientInvitation,
  type OrganizationInput,
  type SpaceInput,
  type VenueAction,
} from './venues.ts'

const now = new Date('2026-11-27T12:00:00.000Z')
const upcoming = { startsAt: '2027-01-10T17:00:00.000Z' }
const past = { startsAt: '2026-10-01T17:00:00.000Z' }
const invitation = (
  sentAt: string,
  acceptedAt: string | null = null,
): ClientInvitation => ({
  name: 'Dana Levi',
  email: 'dana@example.com',
  sentAt,
  acceptedAt,
})

describe('venueEventStatus (D115)', () => {
  it('is Awaiting client before anyone is invited', () => {
    expect(venueEventStatus({ client: null }, upcoming, now)).toBe(
      'AWAITING_CLIENT',
    )
  })

  it('is Invitation sent while the invitation can be accepted', () => {
    const client = invitation('2026-11-24T09:00:00.000Z')
    expect(venueEventStatus({ client }, upcoming, now)).toBe('INVITATION_SENT')
  })

  it('is Invitation expired after seven days without acceptance', () => {
    const client = invitation('2026-11-20T11:59:59.000Z')
    expect(invitationExpiresAt(client).toISOString()).toBe(
      '2026-11-27T11:59:59.000Z',
    )
    expect(venueEventStatus({ client }, upcoming, now)).toBe(
      'INVITATION_EXPIRED',
    )
  })

  it('is Client joined once accepted, even after the invitation would expire', () => {
    const client = invitation(
      '2026-10-01T09:00:00.000Z',
      '2026-10-02T09:00:00.000Z',
    )
    expect(venueEventStatus({ client }, upcoming, now)).toBe('CLIENT_JOINED')
  })

  it('is Past once the event started, whatever the client did', () => {
    for (const client of [
      null,
      invitation('2026-09-01T09:00:00.000Z'),
      invitation('2026-09-01T09:00:00.000Z', '2026-09-02T09:00:00.000Z'),
    ]) {
      expect(venueEventStatus({ client }, past, now)).toBe('PAST')
    }
  })
})

describe('venueCan (D112)', () => {
  const actions: VenueAction[] = [
    'VIEW_VENUE',
    'MANAGE_SPACES',
    'MANAGE_EVENTS',
    'MANAGE_TEAM',
    'MANAGE_SETTINGS',
  ]

  it('lets the Owner do everything', () => {
    for (const action of actions) {
      expect(venueCan('VENUE_OWNER', action)).toBe(true)
    }
  })

  it('keeps the team and the settings from a Manager', () => {
    expect(
      actions.filter((action) => venueCan('VENUE_MANAGER', action)),
    ).toEqual(['VIEW_VENUE', 'MANAGE_SPACES', 'MANAGE_EVENTS'])
  })

  it('gives nothing to someone outside the venue', () => {
    for (const action of actions) {
      expect(venueCan(null, action)).toBe(false)
    }
  })
})

describe('templateFigures (D111)', () => {
  const table = (capacity: number) => ({
    number: 1,
    capacity,
    shape: 'CIRCLE' as const,
    x: null,
    y: null,
    rotation: 0,
  })

  it('counts tables and chairs, and what goes beyond the space', () => {
    expect(
      templateFigures(
        { tables: [table(10), table(12), table(8)] },
        { maxPeople: 25, maxTables: 2 },
      ),
    ).toEqual({ tables: 3, chairs: 30, extraChairs: 5, extraTables: 1 })
  })

  it('reports nothing beyond when within, or with no maximum tables', () => {
    expect(
      templateFigures(
        { tables: [table(10)] },
        { maxPeople: 100, maxTables: null },
      ),
    ).toEqual({ tables: 1, chairs: 10, extraChairs: 0, extraTables: 0 })
  })
})

describe('validateSpaceInput (mockup #4)', () => {
  const input: SpaceInput = {
    name: ' Main Hall ',
    address: '12 Orchard Lane',
    maxPeople: 400,
    maxTables: 45,
    timeZone: 'Asia/Jerusalem',
  }
  const field = (run: () => unknown) => {
    try {
      run()
    } catch (error) {
      return (error as DomainError).details?.['field']
    }
    return null
  }

  it('trims the name and keeps the rest', () => {
    expect(validateSpaceInput(input, []).name).toBe('Main Hall')
  })

  it('refuses a name another space of the venue has, ignoring case', () => {
    expect(field(() => validateSpaceInput(input, ['main hall']))).toBe('name')
  })

  it('refuses an empty address, a bad size or an unknown time zone', () => {
    expect(
      field(() => validateSpaceInput({ ...input, address: ' ' }, [])),
    ).toBe('address')
    expect(
      field(() => validateSpaceInput({ ...input, maxPeople: 0 }, [])),
    ).toBe('maxPeople')
    expect(
      field(() => validateSpaceInput({ ...input, maxTables: 0 }, [])),
    ).toBe('maxTables')
    expect(
      field(() => validateSpaceInput({ ...input, timeZone: 'Mars/Base' }, [])),
    ).toBe('timeZone')
  })

  it('accepts no maximum tables', () => {
    expect(
      validateSpaceInput({ ...input, maxTables: null }, []).maxTables,
    ).toBe(null)
  })
})

describe('validateOrganizationInput (D117)', () => {
  const input: OrganizationInput = {
    name: 'Grand Garden Hall',
    defaultLanguage: 'en',
    contactEmail: ' Events@Example.com ',
    contactPhone: ' 03-000-0000 ',
  }

  it('normalizes the contact details', () => {
    expect(validateOrganizationInput(input)).toEqual({
      ...input,
      contactEmail: 'events@example.com',
      contactPhone: '03-000-0000',
    })
  })

  it('keeps empty contact details as none', () => {
    expect(
      validateOrganizationInput({
        ...input,
        contactEmail: '',
        contactPhone: '',
      }),
    ).toMatchObject({ contactEmail: null, contactPhone: null })
  })

  it('refuses an address that is not an email', () => {
    expect(() =>
      validateOrganizationInput({ ...input, contactEmail: 'not an email' }),
    ).toThrow(DomainError)
  })
})

describe('assertCanChangeVenueMember (D112)', () => {
  const members = [
    { userId: 'owner', role: 'VENUE_OWNER' as const },
    { userId: 'manager', role: 'VENUE_MANAGER' as const },
  ]
  const code = (run: () => void) => {
    try {
      run()
    } catch (error) {
      return (error as DomainError).code
    }
    return 'NO_ERROR'
  }
  const owner = { userId: 'owner', role: 'VENUE_OWNER' as const }

  it('lets the Owner change or remove another member', () => {
    expect(
      code(() =>
        assertCanChangeVenueMember(owner, members, {
          userId: 'manager',
          newRole: 'VENUE_OWNER',
        }),
      ),
    ).toBe('NO_ERROR')
    expect(
      code(() =>
        assertCanChangeVenueMember(owner, members, {
          userId: 'manager',
          newRole: null,
        }),
      ),
    ).toBe('NO_ERROR')
  })

  it('refuses a Manager, a change to oneself and losing the last Owner', () => {
    expect(
      code(() =>
        assertCanChangeVenueMember(
          { userId: 'manager', role: 'VENUE_MANAGER' },
          members,
          { userId: 'owner', newRole: null },
        ),
      ),
    ).toBe('FORBIDDEN')
    expect(
      code(() =>
        assertCanChangeVenueMember(owner, members, {
          userId: 'owner',
          newRole: 'VENUE_MANAGER',
        }),
      ),
    ).toBe('SELF_PERMISSION')
    expect(
      code(() =>
        assertCanChangeVenueMember(
          { userId: 'second', role: 'VENUE_OWNER' as const },
          [
            ...members,
            { userId: 'second', role: 'VENUE_OWNER' as const },
          ].filter((member) => member.userId !== 'owner'),
          { userId: 'missing', newRole: null },
        ),
      ),
    ).toBe('NOT_FOUND')
  })

  it('keeps the venue’s last Owner', () => {
    const twoOwners = [
      ...members,
      { userId: 'b', role: 'VENUE_OWNER' as const },
    ]
    expect(
      code(() =>
        assertCanChangeVenueMember(
          { userId: 'b', role: 'VENUE_OWNER' },
          twoOwners.filter((m) => m.userId !== 'owner'),
          { userId: 'manager', newRole: null },
        ),
      ),
    ).toBe('NO_ERROR')
    expect(
      code(() =>
        assertCanChangeVenueMember(
          { userId: 'manager2', role: 'VENUE_OWNER' },
          [
            { userId: 'owner', role: 'VENUE_OWNER' as const },
            { userId: 'manager2', role: 'VENUE_OWNER' as const },
          ].filter((m) => m.userId === 'owner'),
          { userId: 'owner', newRole: 'VENUE_MANAGER' },
        ),
      ),
    ).toBe('LAST_OWNER')
  })
})
