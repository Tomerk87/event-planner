import { describe, expect, it } from 'vitest'
import { makeApprovedGuest, makeGuest, makeTable } from '../test/factories.ts'
import {
  DEFAULT_GUEST_SORT,
  filterGuests,
  guestFullName,
  hasActiveFilters,
  matchesGuestQuery,
  NO_GUEST_FILTERS,
  sortGuests,
  type GuestSortKey,
} from './guestList.ts'
import { guestDisplayStatus } from './guestStatus.ts'
import { pageNumbers, paginate } from './paging.ts'

const dana = makeGuest({
  id: 'g-dana',
  firstName: 'Dana',
  lastName: 'Cohen',
  invitationName: 'Dana & Yoav',
  phone: '050-123-4567',
  normalizedPhone: '+972501234567',
})

describe('guestDisplayStatus', () => {
  it.each([
    ['NO_RESPONSE', 0, 'NOT_SENT'],
    ['NO_RESPONSE', 1, 'AWAITING'],
    ['NO_RESPONSE', 4, 'AWAITING'],
    ['APPROVED', 0, 'APPROVED'],
    ['APPROVED', 2, 'APPROVED'],
    ['NOT_SURE', 1, 'NOT_SURE'],
    ['DECLINED', 0, 'DECLINED'],
  ] as const)('%s with %i sends is %s', (rsvpStatus, sent, expected) => {
    expect(guestDisplayStatus({ rsvpStatus, invitationSentCount: sent })).toBe(
      expected,
    )
  })
})

describe('searching guests', () => {
  it.each([
    ['dana', true],
    ['COHEN', true],
    ['Dana Cohen', true],
    ['cohen dana', true],
    ['yoav', true],
    ['  dan ', true],
    ['', true],
    ['noa', false],
    ['050-123', true],
    ['0501234567', true],
    ['+972 50 123', true],
    ['972501234567', true],
    ['4567', true],
    ['(050) 123', true],
    ['999', false],
    ['5', false],
    ['dana 050', false],
  ])('query %j matches: %s', (query, expected) => {
    expect(matchesGuestQuery(dana, query, 'en')).toBe(expected)
  })

  it('matches Hebrew names', () => {
    const guest = makeGuest({ firstName: 'נועה', lastName: 'לוי' })

    expect(matchesGuestQuery(guest, 'נועה', 'he')).toBe(true)
    expect(matchesGuestQuery(guest, 'לוי נועה', 'he')).toBe(true)
    expect(matchesGuestQuery(guest, 'דנה', 'he')).toBe(false)
  })

  it('joins the names without a stray space when the last name is empty', () => {
    expect(guestFullName({ firstName: 'Cher', lastName: '' })).toBe('Cher')
  })
})

describe('filtering guests', () => {
  const table = makeTable({ id: 't-1' })
  const seated = makeApprovedGuest(2, { id: 'g-seated', tableId: table.id })
  const approved = makeApprovedGuest(3, { id: 'g-approved' })
  const awaiting = makeGuest({ id: 'g-awaiting', invitationSentCount: 2 })
  const notSent = makeGuest({ id: 'g-notsent' })
  const declined = makeGuest({
    id: 'g-declined',
    rsvpStatus: 'DECLINED',
    invitationSentCount: 1,
  })
  const deleted = makeGuest({ id: 'g-deleted', deleted: true })
  const all = [seated, approved, awaiting, notSent, declined, deleted]
  const ids = (filters: Partial<typeof NO_GUEST_FILTERS>) =>
    filterGuests(all, { ...NO_GUEST_FILTERS, ...filters }, 'en').map(
      (guest) => guest.id,
    )

  it('never includes soft-deleted guests', () => {
    expect(ids({})).toEqual([
      'g-seated',
      'g-approved',
      'g-awaiting',
      'g-notsent',
      'g-declined',
    ])
  })

  it('filters by RSVP status', () => {
    expect(ids({ rsvp: 'APPROVED' })).toEqual(['g-seated', 'g-approved'])
    expect(ids({ rsvp: 'NO_RESPONSE' })).toEqual(['g-awaiting', 'g-notsent'])
    expect(ids({ rsvp: 'DECLINED' })).toEqual(['g-declined'])
    expect(ids({ rsvp: 'NOT_SURE' })).toEqual([])
  })

  it('filters by whether an invitation was sent', () => {
    expect(ids({ invitation: 'NOT_SENT' })).toEqual(['g-notsent'])
    expect(ids({ invitation: 'SENT' })).toEqual([
      'g-seated',
      'g-approved',
      'g-awaiting',
      'g-declined',
    ])
  })

  it('filters by table, including guests without one', () => {
    expect(ids({ table: 't-1' })).toEqual(['g-seated'])
    expect(ids({ table: 'NONE' })).toEqual([
      'g-approved',
      'g-awaiting',
      'g-notsent',
      'g-declined',
    ])
  })

  it('combines filters with the search', () => {
    expect(ids({ rsvp: 'APPROVED', table: 'NONE' })).toEqual(['g-approved'])
    expect(ids({ rsvp: 'APPROVED', invitation: 'NOT_SENT' })).toEqual([])
    expect(ids({ query: 'no such name' })).toEqual([])
  })

  it('knows whether anything is filtered', () => {
    expect(hasActiveFilters(NO_GUEST_FILTERS)).toBe(false)
    expect(hasActiveFilters({ ...NO_GUEST_FILTERS, query: '  ' })).toBe(false)
    expect(hasActiveFilters({ ...NO_GUEST_FILTERS, query: 'a' })).toBe(true)
    expect(hasActiveFilters({ ...NO_GUEST_FILTERS, rsvp: 'DECLINED' })).toBe(
      true,
    )
    expect(hasActiveFilters({ ...NO_GUEST_FILTERS, invitation: 'SENT' })).toBe(
      true,
    )
    expect(hasActiveFilters({ ...NO_GUEST_FILTERS, table: 'NONE' })).toBe(true)
  })
})

describe('sorting guests', () => {
  const tables = [
    makeTable({ id: 't-2', number: 2 }),
    makeTable({ id: 't-10', number: 10 }),
  ]
  const a = makeApprovedGuest(4, {
    id: 'a',
    firstName: 'Avi',
    lastName: 'Zur',
    invitationName: 'Zed',
    normalizedPhone: '+972500000003',
    allowedAttendees: 5,
    invitationSentCount: 3,
    tableId: 't-10',
  })
  const b = makeGuest({
    id: 'b',
    firstName: 'bella',
    lastName: 'Adler',
    invitationName: null,
    normalizedPhone: '+972500000001',
    allowedAttendees: 2,
    invitationSentCount: 0,
  })
  const c = makeApprovedGuest(1, {
    id: 'c',
    firstName: 'Carmel',
    lastName: 'Mor',
    invitationName: 'Alpha',
    normalizedPhone: '+972500000002',
    allowedAttendees: 8,
    invitationSentCount: 1,
    tableId: 't-2',
  })
  const d = makeGuest({
    id: 'd',
    firstName: 'Dov',
    lastName: 'Bar',
    rsvpStatus: 'DECLINED',
    confirmedAttendees: 0,
    normalizedPhone: '+972500000004',
    allowedAttendees: 5,
    invitationSentCount: 1,
  })
  const e = makeGuest({
    id: 'e',
    firstName: 'Eli',
    lastName: 'Gal',
    normalizedPhone: '+972500000005',
    allowedAttendees: 5,
    invitationSentCount: 2,
  })
  const guests = [e, d, c, b, a]
  const order = (key: GuestSortKey, direction: 'asc' | 'desc' = 'asc') =>
    sortGuests(guests, { key, direction }, tables, 'en')
      .map((guest) => guest.id)
      .join('')

  it('sorts by name without regard to case, by default', () => {
    expect(DEFAULT_GUEST_SORT).toEqual({ key: 'name', direction: 'asc' })
    expect(order('name')).toBe('abcde')
    expect(order('name', 'desc')).toBe('edcba')
  })

  it.each([
    ['phone', 'bcade', 'edacb'],
    ['allowed', 'badec', 'cadeb'],
    ['sent', 'bcdea', 'aecdb'],
  ] as const)('sorts by %s in both directions', (key, asc, desc) => {
    expect(order(key)).toBe(asc)
    expect(order(key, 'desc')).toBe(desc)
  })

  it('keeps guests with no value last, whichever the direction', () => {
    expect(order('confirmed')).toBe('dcabe')
    expect(order('confirmed', 'desc')).toBe('acdbe')
    expect(order('table')).toBe('cabde')
    expect(order('table', 'desc')).toBe('acbde')
    expect(order('invitationName')).toBe('cabde')
    expect(order('invitationName', 'desc')).toBe('acbde')
  })

  it('sorts by status: approved, not sure, declined, awaiting, not sent', () => {
    expect(order('status')).toBe('acdeb')
    expect(order('status', 'desc')).toBe('bedac')
  })

  it('does not change the list it is given', () => {
    const before = guests.map((guest) => guest.id).join('')
    sortGuests(guests, { key: 'name', direction: 'asc' }, tables, 'en')
    expect(guests.map((guest) => guest.id).join('')).toBe(before)
  })

  it('orders Hebrew names by the Hebrew alphabet', () => {
    const hebrew = [
      makeGuest({ id: '3', firstName: 'תמר', lastName: '' }),
      makeGuest({ id: '1', firstName: 'אבי', lastName: '' }),
      makeGuest({ id: '2', firstName: 'נועה', lastName: '' }),
    ]

    expect(
      sortGuests(hebrew, DEFAULT_GUEST_SORT, [], 'he').map((guest) => guest.id),
    ).toEqual(['1', '2', '3'])
  })
})

describe('paging', () => {
  const items = Array.from({ length: 23 }, (_, index) => index + 1)

  it('returns one page and where it sits in the whole', () => {
    expect(paginate(items, 2, 10)).toEqual({
      items: [11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
      page: 2,
      pageCount: 3,
      total: 23,
      from: 11,
      to: 20,
    })
    expect(paginate(items, 3, 10)).toMatchObject({
      items: [21, 22, 23],
      from: 21,
      to: 23,
    })
  })

  it.each([
    [0, 1],
    [-4, 1],
    [99, 3],
    [Number.NaN, 1],
    [2.9, 2],
  ])('brings a request for page %s into range as page %i', (page, shown) => {
    expect(paginate(items, page, 10).page).toBe(shown)
  })

  it('has one empty page when there is nothing to show', () => {
    expect(paginate([], 1, 10)).toEqual({
      items: [],
      page: 1,
      pageCount: 1,
      total: 0,
      from: 0,
      to: 0,
    })
  })

  it('never uses a page size below one', () => {
    expect(paginate(items, 1, 0).items).toEqual([1])
  })

  it.each([
    [1, 1, [1]],
    [1, 7, [1, 2, 3, 4, 5, 6, 7]],
    [1, 17, [1, 2, 3, 4, 5, null, 17]],
    [4, 17, [1, 2, 3, 4, 5, null, 17]],
    [5, 17, [1, null, 4, 5, 6, null, 17]],
    [9, 17, [1, null, 8, 9, 10, null, 17]],
    [14, 17, [1, null, 13, 14, 15, 16, 17]],
    [17, 17, [1, null, 13, 14, 15, 16, 17]],
  ])('offers the right page numbers on page %i of %i', (page, count, shown) => {
    expect(pageNumbers(page, count)).toEqual(shown)
  })
})
