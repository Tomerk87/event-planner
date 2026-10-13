import { describe, expect, it } from 'vitest'
import {
  computeRsvpBreakdown,
  RSVP_SEGMENTS,
  type DashboardMetrics,
} from './metrics.ts'

function metrics(overrides: Partial<DashboardMetrics>): DashboardMetrics {
  return {
    totalGuests: 0,
    invitationsSent: 0,
    invitationsNotSent: 0,
    awaitingResponse: 0,
    rsvpApproved: 0,
    rsvpNotSure: 0,
    rsvpDeclined: 0,
    confirmedAttendees: 0,
    seatingCapacity: 0,
    unassignedConfirmedAttendees: 0,
    ...overrides,
  }
}

function byCount(overrides: Partial<DashboardMetrics>) {
  return Object.fromEntries(
    computeRsvpBreakdown(metrics(overrides)).map((share) => [
      share.segment,
      [share.count, share.percent],
    ]),
  )
}

describe('RSVP breakdown', () => {
  it('puts every guest in exactly one group, in a fixed order', () => {
    const shares = computeRsvpBreakdown(
      metrics({
        totalGuests: 164,
        rsvpApproved: 100,
        rsvpDeclined: 20,
        rsvpNotSure: 4,
        awaitingResponse: 21,
      }),
    )

    expect(shares.map((share) => share.segment)).toEqual([...RSVP_SEGMENTS])
    expect(shares.map((share) => share.count)).toEqual([100, 20, 4, 21, 19])
    expect(shares.reduce((sum, share) => sum + share.count, 0)).toBe(164)
  })

  it('counts guests who were neither invited nor answered as not invited', () => {
    expect(
      byCount({ totalGuests: 10, rsvpApproved: 2, awaitingResponse: 3 })
        .notInvited,
    ).toEqual([5, 50])
  })

  it('gives whole percentages that add up to exactly 100', () => {
    const shares = computeRsvpBreakdown(
      metrics({
        totalGuests: 3,
        rsvpApproved: 1,
        rsvpDeclined: 1,
        rsvpNotSure: 1,
      }),
    )

    expect(shares.map((share) => share.percent)).toEqual([34, 33, 33, 0, 0])
    expect(shares.reduce((sum, share) => sum + share.percent, 0)).toBe(100)
  })

  it.each([
    [
      {
        totalGuests: 159,
        rsvpApproved: 77,
        rsvpDeclined: 25,
        rsvpNotSure: 4,
        awaitingResponse: 17,
      },
    ],
    [
      {
        totalGuests: 7,
        rsvpApproved: 1,
        rsvpDeclined: 1,
        rsvpNotSure: 1,
        awaitingResponse: 1,
      },
    ],
    [{ totalGuests: 1, rsvpDeclined: 1 }],
    [
      {
        totalGuests: 999,
        rsvpApproved: 333,
        rsvpDeclined: 333,
        rsvpNotSure: 333,
      },
    ],
  ])('adds up to 100 for %j', (overrides) => {
    const shares = computeRsvpBreakdown(metrics(overrides))

    expect(shares.reduce((sum, share) => sum + share.percent, 0)).toBe(100)
    for (const share of shares) {
      expect(Number.isInteger(share.percent)).toBe(true)
      expect(share.count === 0).toBe(share.percent === 0 && share.count === 0)
    }
  })

  it('is all zeros for an event with no guests', () => {
    expect(
      computeRsvpBreakdown(metrics({})).map((share) => [
        share.count,
        share.percent,
      ]),
    ).toEqual(RSVP_SEGMENTS.map(() => [0, 0]))
  })

  it('never reports a negative group from inconsistent figures', () => {
    expect(byCount({ totalGuests: 1, rsvpApproved: 2 }).notInvited).toEqual([
      0, 0,
    ])
  })
})
