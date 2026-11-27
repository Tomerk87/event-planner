import { describe, expect, it } from 'vitest'
import {
  invitationExpiresAt,
  venueCan,
  venueEventStatus,
  type ClientInvitation,
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
