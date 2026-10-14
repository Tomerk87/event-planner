import { describe, expect, it } from 'vitest'
import { makeGuest } from '../test/factories.ts'
import { isDomainError } from './errors.ts'
import { detectMapping, planGuestImport } from './guestImport.ts'
import {
  filterGuests,
  hasActiveFilters,
  NO_GUEST_FILTERS,
  sortGuests,
} from './guestList.ts'
import { addGuest, editGuest, GROUP_MAX_LENGTH, listGroups } from './guests.ts'

const input = {
  firstName: 'Jordan',
  lastName: 'Reed',
  phone: '050-123-4567',
  allowedAttendees: 4,
}
const family = makeGuest({ id: 'g-1', firstName: 'Ana', group: 'Family' })
const work = makeGuest({ id: 'g-2', firstName: 'Ben', group: 'Work' })
const nobody = makeGuest({ id: 'g-3', firstName: 'Cal', group: null })
const everyone = [family, work, nobody]

describe('a guest’s group', () => {
  it('is optional: missing, empty or blank means no group', () => {
    for (const group of [undefined, null, '', '   ']) {
      expect(addGuest([], 'evt-1', { ...input, group }, 'g').guest.group).toBe(
        null,
      )
    }
  })

  it('is trimmed and kept as typed when it is new', () => {
    expect(
      addGuest(everyone, 'evt-1', { ...input, group: '  Neighbours ' }, 'g')
        .guest.group,
    ).toBe('Neighbours')
  })

  it('joins an existing group typed with different capitals', () => {
    expect(
      addGuest(everyone, 'evt-1', { ...input, group: 'FAMILY' }, 'g').guest
        .group,
    ).toBe('Family')
    expect(
      editGuest(everyone, nobody, { ...nobody, group: 'work' }).group,
    ).toBe('Work')
  })

  it('lets the only member of a group respell it', () => {
    expect(editGuest(everyone, work, { ...work, group: 'WORK' }).group).toBe(
      'WORK',
    )
  })

  it('does not borrow the spelling of another event or of a deleted guest', () => {
    const elsewhere = makeGuest({ eventId: 'evt-2', group: 'Cousins' })
    const removed = makeGuest({ group: 'Choir', deleted: true })
    const others = [elsewhere, removed]

    expect(
      addGuest(others, 'evt-1', { ...input, group: 'cousins' }, 'g').guest
        .group,
    ).toBe('cousins')
    expect(
      addGuest(others, 'evt-1', { ...input, group: 'choir' }, 'g').guest.group,
    ).toBe('choir')
  })

  it('cannot be longer than the limit', () => {
    const tooLong = 'x'.repeat(GROUP_MAX_LENGTH + 1)
    let error: unknown
    try {
      addGuest([], 'evt-1', { ...input, group: tooLong }, 'g')
    } catch (caught) {
      error = caught
    }

    expect(isDomainError(error, 'VALIDATION')).toBe(true)
    expect(
      addGuest([], 'evt-1', { ...input, group: tooLong.slice(1) }, 'g').guest
        .group,
    ).toHaveLength(GROUP_MAX_LENGTH)
  })

  it('comes from the new entry when a deleted guest is restored', () => {
    const removed = makeGuest({
      normalizedPhone: '+972501234567',
      group: 'Family',
      deleted: true,
    })

    const { guest, restored } = addGuest(
      [removed],
      'evt-1',
      { ...input, group: 'Work' },
      'g',
    )

    expect(restored).toBe(true)
    expect(guest.group).toBe('Work')
  })
})

describe('listGroups', () => {
  it('lists the groups in use among active guests, in order, each once', () => {
    expect(
      listGroups([
        work,
        family,
        nobody,
        makeGuest({ group: 'Family' }),
        makeGuest({ group: 'Gone', deleted: true }),
      ]),
    ).toEqual(['Family', 'Work'])
    expect(listGroups([])).toEqual([])
  })
})

describe('finding guests by group', () => {
  const names = (guests: typeof everyone) =>
    guests.map((guest) => guest.firstName)

  it('filters by a group, by no group, or not at all', () => {
    const by = (group: string | null) =>
      names(filterGuests(everyone, { ...NO_GUEST_FILTERS, group }, 'en'))

    expect(by(null)).toEqual(['Ana', 'Ben', 'Cal'])
    expect(by('Family')).toEqual(['Ana'])
    expect(by('')).toEqual(['Cal'])
    expect(hasActiveFilters({ ...NO_GUEST_FILTERS, group: '' })).toBe(true)
    expect(hasActiveFilters(NO_GUEST_FILTERS)).toBe(false)
  })

  it('matches the group in the search box', () => {
    expect(
      names(
        filterGuests(everyone, { ...NO_GUEST_FILTERS, query: 'fam' }, 'en'),
      ),
    ).toEqual(['Ana'])
  })

  it('sorts by group, with guests in no group always last', () => {
    const sorted = (direction: 'asc' | 'desc') =>
      names(sortGuests(everyone, { key: 'group', direction }, [], 'en'))

    expect(sorted('asc')).toEqual(['Ana', 'Ben', 'Cal'])
    expect(sorted('desc')).toEqual(['Ben', 'Ana', 'Cal'])
  })
})

describe('importing groups', () => {
  it('recognises a Group column in English and Hebrew', () => {
    expect(detectMapping(['First name', 'Phone', 'Group']).group).toBe(2)
    expect(detectMapping(['שם פרטי', 'טלפון', 'קבוצה']).group).toBe(2)
    expect(detectMapping(['First name', 'Phone']).group).toBeNull()
  })

  it('reads the group, joining existing ones, and reports one that is too long', () => {
    const mapping = {
      firstName: 0,
      lastName: null,
      phone: 1,
      allowedAttendees: null,
      group: 2,
    }
    const plan = planGuestImport(
      [
        ['Dana', '050-555-0101', 'family'],
        ['Noa', '050-555-0102', ''],
        ['Gil', '050-555-0103', 'x'.repeat(GROUP_MAX_LENGTH + 1)],
      ],
      mapping,
      [family],
      'evt-1',
      5,
    )

    expect(plan.rows.map((row) => row.error)).toEqual([
      null,
      null,
      'INVALID_GROUP',
    ])
    expect(plan.rows[0]?.input?.group).toBe('family')
    expect(plan.valid).toBe(2)
    // Saving the planned rows applies the existing spelling.
    expect(
      addGuest([family], 'evt-1', plan.rows[0]!.input!, 'g').guest.group,
    ).toBe('Family')
  })
})
