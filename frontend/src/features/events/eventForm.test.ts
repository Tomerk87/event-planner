import { describe, expect, it } from 'vitest'
import { DomainError } from '../../domain/errors.ts'
import {
  browserTimeZone,
  defaultEventFormValues,
  earliestStart,
  isTypedStartPast,
  fieldErrorOf,
  listTimeZones,
  toDateAndTime,
  toInteger,
  toStartsAt,
} from './eventForm.ts'

describe('event form helpers', () => {
  it('reads the date and time fields in the event’s time zone', () => {
    expect(toStartsAt('2031-01-01', '20:00', 'Asia/Jerusalem')).toBe(
      '2031-01-01T18:00:00.000Z',
    )
    expect(toStartsAt('2031-07-01', '20:00', 'Asia/Jerusalem')).toBe(
      '2031-07-01T17:00:00.000Z',
    )
    expect(toStartsAt('2031-01-01', '20:00', 'UTC')).toBe(
      '2031-01-01T20:00:00.000Z',
    )
  })

  it.each([
    ['', '20:00', 'UTC'],
    ['2031-01-01', '', 'UTC'],
    ['01/01/2031', '20:00', 'UTC'],
    ['2031-01-01', '8pm', 'UTC'],
    ['2031-01-01', '20:00', 'Nowhere/Land'],
  ])('has no instant for %j %j in %j', (date, time, timeZone) => {
    expect(toStartsAt(date, time, timeZone)).toBeNull()
  })

  it('shows an instant as date and time fields, and back', () => {
    const instant = new Date('2031-01-01T18:05:00.000Z')

    const fields = toDateAndTime(instant, 'Asia/Jerusalem')

    expect(fields).toEqual({ date: '2031-01-01', time: '20:05' })
    expect(toStartsAt(fields.date, fields.time, 'Asia/Jerusalem')).toBe(
      instant.toISOString(),
    )
  })

  it('offers dates and times from the next minute on, in the event’s time zone', () => {
    // 21:59:30 UTC is already the next day in Jerusalem.
    const now = new Date('2031-01-01T21:59:30.000Z')
    expect(earliestStart('Asia/Jerusalem', now)).toEqual({
      date: '2031-01-02',
      time: '00:00',
    })
    expect(earliestStart('America/New_York', now)).toEqual({
      date: '2031-01-01',
      time: '17:00',
    })
    expect(earliestStart('Not/AZone', now)).toBeNull()
  })

  it('knows when a typed start is not in the future', () => {
    const now = new Date('2031-01-01T18:00:00.000Z')
    const at = (date: string, time: string) =>
      isTypedStartPast({ date, time, timeZone: 'Asia/Jerusalem' }, now)
    expect(at('2031-01-01', '20:00')).toBe(true)
    expect(at('2031-01-01', '20:01')).toBe(false)
    expect(at('2031-01-01', '')).toBe(false)
  })

  it('starts a new form from the documented defaults', () => {
    expect(defaultEventFormValues('UTC')).toMatchObject({
      name: '',
      timeZone: 'UTC',
      maxAttendees: '50',
      defaultAllowedAttendees: '5',
      rsvpLanguage: 'en',
      country: 'IL',
    })
  })

  it('lists time zones in order, always including the one in use', () => {
    const zones = listTimeZones('Asia/Jerusalem')

    expect(zones).toContain('Asia/Jerusalem')
    expect(zones).toContain('UTC')
    expect(zones).toEqual([...new Set(zones)].sort())
    expect(listTimeZones(browserTimeZone())).toContain(browserTimeZone())
  })

  it.each([
    ['300', 300],
    [' 42 ', 42],
  ])('reads %j as a whole number', (text, value) => {
    expect(toInteger(text)).toBe(value)
  })

  it.each(['', '2.5', '-3', '1e3', 'ten'])('does not read %j', (text) => {
    expect(toInteger(text)).toBeNaN()
  })

  it('maps a rejected save to the field it names', () => {
    expect(
      fieldErrorOf(new DomainError('VALIDATION', { field: 'maxAttendees' })),
    ).toEqual({ maxAttendees: 'invalid' })
    expect(
      fieldErrorOf(
        new DomainError('VALIDATION', { field: 'startsAt', reason: 'past' }),
      ),
    ).toEqual({ startsAt: 'past' })
    expect(
      fieldErrorOf(new DomainError('VALIDATION', { field: 'location' })),
    ).toBeNull()
    expect(fieldErrorOf(new DomainError('FORBIDDEN'))).toBeNull()
    expect(fieldErrorOf(new Error('boom'))).toBeNull()
  })
})
