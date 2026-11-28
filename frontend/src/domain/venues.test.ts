import { describe, expect, it } from 'vitest'
import { DomainError } from './errors.ts'
import {
  applyLayoutToTemplate,
  assertCanAcceptClientLink,
  assertCanChangeVenueMember,
  clientLinkExpiresAt,
  clientLinkState,
  newClientLinkToken,
  copyTemplateToEvent,
  sameDayEvents,
  emptyTemplate,
  invitationExpiresAt,
  templateAsLayout,
  templateFigures,
  templateTableId,
  templateTables,
  validateTemplateName,
  validateOrganizationInput,
  validateSpaceInput,
  venueCan,
  venueEventStatus,
  type ClientInvitation,
  type ClientInvitationLink,
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
  sentBy: null,
  timesSent: 1,
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

describe('templates on the floor-plan editor (Phase 26)', () => {
  const template = {
    ...emptyTemplate('tpl-1', 'spc-1', 'Rounds', '2026-11-01T00:00:00.000Z'),
    tables: [
      {
        number: 1,
        capacity: 10,
        shape: 'CIRCLE' as const,
        x: 300,
        y: 300,
        rotation: 0,
      },
      {
        number: 2,
        capacity: 8,
        shape: 'SQUARE' as const,
        x: null,
        y: null,
        rotation: 0,
      },
    ],
  }

  it('shows a template as a plan, with an id for each table', () => {
    const layout = templateAsLayout(template)
    expect(layout.placements).toEqual([
      { tableId: templateTableId('tpl-1', 1), x: 300, y: 300, rotation: 0 },
    ])
    expect(templateTables(template).map((table) => table.id)).toEqual([
      'tpl-1#1',
      'tpl-1#2',
    ])
  })

  it('writes a plan back, placing and unplacing tables', () => {
    const layout = templateAsLayout(template)
    const updated = applyLayoutToTemplate(template, {
      ...layout,
      roomWidth: 2400,
      placements: [{ tableId: 'tpl-1#2', x: 500, y: 400, rotation: 45 }],
    })
    expect(updated.roomWidth).toBe(2400)
    expect(updated.tables).toEqual([
      {
        number: 1,
        capacity: 10,
        shape: 'CIRCLE',
        x: null,
        y: null,
        rotation: 0,
      },
      { number: 2, capacity: 8, shape: 'SQUARE', x: 500, y: 400, rotation: 45 },
    ])
  })

  it('names a template uniquely within its space', () => {
    expect(validateTemplateName(' Gala ', ['Rounds'])).toBe('Gala')
    expect(() => validateTemplateName('rounds', ['Rounds'])).toThrow(
      DomainError,
    )
    expect(() => validateTemplateName('  ', [])).toThrow(DomainError)
  })
})

describe('creating a venue event (Phase 27)', () => {
  it('finds the space’s events on the same local day', () => {
    const events = [
      { name: 'evening', startsAt: '2027-01-14T17:00:00.000Z' },
      { name: 'next day', startsAt: '2027-01-15T10:00:00.000Z' },
      // 23:30 in Israel on the 14th, the 14th still there (UTC 21:30).
      { name: 'late', startsAt: '2027-01-14T21:30:00.000Z' },
    ]
    expect(
      sameDayEvents(events, '2027-01-14T08:00:00.000Z', 'Asia/Jerusalem').map(
        (event) => event.name,
      ),
    ).toEqual(['evening', 'late'])
  })

  it('copies a template with new table ids, in the same places', () => {
    const template = {
      ...emptyTemplate('tpl-1', 'spc-1', 'Rounds', '2026-11-01T00:00:00.000Z'),
      tables: [
        {
          number: 1,
          capacity: 10,
          shape: 'CIRCLE' as const,
          x: 300,
          y: 300,
          rotation: 0,
        },
        {
          number: 2,
          capacity: 8,
          shape: 'SQUARE' as const,
          x: null,
          y: null,
          rotation: 0,
        },
      ],
    }
    let next = 0
    const { tables, layout } = copyTemplateToEvent(template, 'evt-9', () => {
      next += 1
      return `tbl-new-${next}`
    })
    expect(tables).toEqual([
      {
        id: 'tbl-new-1',
        eventId: 'evt-9',
        number: 1,
        capacity: 10,
        shape: 'CIRCLE',
      },
      {
        id: 'tbl-new-2',
        eventId: 'evt-9',
        number: 2,
        capacity: 8,
        shape: 'SQUARE',
      },
    ])
    expect(layout.placements).toEqual([
      { tableId: 'tbl-new-1', x: 300, y: 300, rotation: 0 },
    ])
    expect(tables.some((table) => table.id.startsWith('tpl-1'))).toBe(false)
  })
})

describe('client invitation links (Phase 28)', () => {
  const link = (
    status: ClientInvitationLink['status'] = 'OPEN',
    sentAt = '2026-11-25T12:00:00.000Z',
  ): ClientInvitationLink => ({
    token: 'abc',
    eventId: 'evt-1',
    email: 'Dana.Levi@example.com',
    sentAt,
    status,
  })

  it('is open for seven days, then expired', () => {
    expect(clientLinkState(link(), upcoming, now)).toBe('OPEN')
    expect(clientLinkExpiresAt(link()).toISOString()).toBe(
      '2026-12-02T12:00:00.000Z',
    )
    expect(
      clientLinkState(link('OPEN', '2026-11-20T11:59:59.000Z'), upcoming, now),
    ).toBe('EXPIRED')
  })

  it('never works again once used or revoked, or after the event starts', () => {
    expect(clientLinkState(link('USED'), upcoming, now)).toBe('USED')
    expect(clientLinkState(link('REVOKED'), upcoming, now)).toBe('REVOKED')
    expect(clientLinkState(link(), past, now)).toBe('EXPIRED')
  })

  it('is accepted only by the invited address, in any case', () => {
    expect(() =>
      assertCanAcceptClientLink(
        link(),
        upcoming,
        { email: ' dana.levi@EXAMPLE.com ' },
        now,
      ),
    ).not.toThrow()
    expect(() =>
      assertCanAcceptClientLink(
        link(),
        upcoming,
        { email: 'alex@example.com' },
        now,
      ),
    ).toThrow(expect.objectContaining({ code: 'FORBIDDEN' }))
    expect(() =>
      assertCanAcceptClientLink(
        link('USED'),
        upcoming,
        { email: 'dana.levi@example.com' },
        now,
      ),
    ).toThrow(
      expect.objectContaining({
        code: 'LINK_EXPIRED',
        details: { state: 'USED' },
      }),
    )
  })

  it('makes tokens no one can guess', () => {
    const tokens = new Set(
      Array.from({ length: 50 }, () => newClientLinkToken()),
    )
    expect(tokens.size).toBe(50)
    for (const token of tokens) {
      expect(token).toMatch(/^[0-9a-f]{32}$/)
    }
  })
})
