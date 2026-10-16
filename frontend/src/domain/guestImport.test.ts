import { describe, expect, it } from 'vitest'
import { makeGuest } from '../test/factories.ts'
import { DomainError } from './errors.ts'
import {
  detectMapping,
  isMappingComplete,
  MAX_IMPORT_ROWS,
  planGuestImport,
  type ColumnMapping,
} from './guestImport.ts'

const mapping: ColumnMapping = {
  firstName: 0,
  lastName: 1,
  phone: 2,
  allowedAttendees: 3,
  group: null,
}

function plan(
  rows: string[][],
  existing = [] as ReturnType<typeof makeGuest>[],
  usedMapping = mapping,
) {
  return planGuestImport(rows, usedMapping, existing, {
    id: 'evt-1',
    country: 'IL',
    defaultAllowedAttendees: 5,
  })
}

describe('detectMapping', () => {
  it('recognises Portuguese headings, with or without accents', () => {
    expect(
      detectMapping([
        'Nome',
        'Sobrenome',
        'Celular',
        'Número de pessoas',
        'Grupo',
      ]),
    ).toEqual({
      firstName: 0,
      lastName: 1,
      phone: 2,
      allowedAttendees: 3,
      group: 4,
    })
    expect(
      detectMapping([
        'Primeiro nome',
        'Último nome',
        'Telefone',
        'Numero de pessoas',
      ]),
    ).toMatchObject({
      firstName: 0,
      lastName: 1,
      phone: 2,
      allowedAttendees: 3,
    })
  })

  it('recognises English headings in any order and style', () => {
    expect(
      detectMapping([
        'Phone Number',
        'Last_Name',
        'Allowed Attendees',
        'FIRST NAME',
      ]),
    ).toEqual({
      firstName: 3,
      lastName: 1,
      phone: 0,
      allowedAttendees: 2,
      group: null,
    })
  })

  it('recognises the attendees column under its current and former names', () => {
    for (const heading of [
      'Expected attendees',
      'Expected',
      'Allowed attendees',
      'משתתפים צפויים',
    ]) {
      expect(detectMapping(['First name', 'Phone', heading])).toMatchObject({
        allowedAttendees: 2,
      })
    }
  })

  it('recognises Hebrew headings', () => {
    expect(
      detectMapping(['שם פרטי', 'שם משפחה', 'טלפון', 'מספר מוזמנים']),
    ).toEqual({
      firstName: 0,
      lastName: 1,
      phone: 2,
      allowedAttendees: 3,
      group: null,
    })
  })

  it('takes a single "Name" column as the first name', () => {
    expect(detectMapping(['Name', 'Mobile'])).toEqual({
      firstName: 0,
      lastName: null,
      phone: 1,
      allowedAttendees: null,
      group: null,
    })
  })

  it('prefers "First name" over a generic "Name" column', () => {
    expect(detectMapping(['Name', 'First name', 'Phone']).firstName).toBe(1)
  })

  it('leaves unknown headings unmatched and never uses a column twice', () => {
    const detected = detectMapping(['Colour', 'Guests', 'Notes'])

    expect(detected).toEqual({
      firstName: null,
      lastName: null,
      phone: null,
      allowedAttendees: 1,
      group: null,
    })
    expect(isMappingComplete(detected)).toBe(false)
    expect(isMappingComplete({ ...detected, firstName: 0, phone: 2 })).toBe(
      true,
    )
  })
})

describe('planGuestImport', () => {
  it('accepts valid rows, tidying their values', () => {
    const result = plan([
      [' Dana ', ' Cohen ', '050-123-4567', '3'],
      ['Noa', '', '+972 52 765 4321', ''],
    ])

    expect(result).toMatchObject({ valid: 2, invalid: 0 })
    expect(result.rows.map((row) => [row.rowNumber, row.outcome])).toEqual([
      [2, 'new'],
      [3, 'new'],
    ])
    expect(result.rows[0]?.input).toEqual({
      firstName: 'Dana',
      lastName: 'Cohen',
      phone: '050-123-4567',
      allowedAttendees: 3,
      group: '',
    })
    // A blank allowance takes the event's default.
    expect(result.rows[1]?.input?.allowedAttendees).toBe(5)
  })

  it.each([
    [
      'a missing first name',
      ['', 'Cohen', '050-123-4567', '2'],
      'MISSING_FIRST_NAME',
    ],
    ['a missing phone', ['Dana', 'Cohen', '', '2'], 'MISSING_PHONE'],
    [
      'a phone with letters',
      ['Dana', 'Cohen', '050-CALL-ME', '2'],
      'INVALID_PHONE',
    ],
    [
      'a phone that is too short',
      ['Dana', 'Cohen', '12345', '2'],
      'INVALID_PHONE',
    ],
    [
      'an allowance of zero',
      ['Dana', 'Cohen', '050-123-4567', '0'],
      'INVALID_ALLOWED',
    ],
    [
      'an allowance above ten',
      ['Dana', 'Cohen', '050-123-4567', '11'],
      'INVALID_ALLOWED',
    ],
    [
      'a fractional allowance',
      ['Dana', 'Cohen', '050-123-4567', '2.5'],
      'INVALID_ALLOWED',
    ],
    [
      'a worded allowance',
      ['Dana', 'Cohen', '050-123-4567', 'two'],
      'INVALID_ALLOWED',
    ],
  ])('reports %s', (_, row, error) => {
    const result = plan([row])

    expect(result).toMatchObject({ valid: 0, invalid: 1 })
    expect(result.rows[0]).toMatchObject({
      outcome: 'error',
      error,
      input: null,
    })
  })

  it('accepts a whole number written as "4.0", as spreadsheets store it', () => {
    expect(
      plan([['Dana', '', '050-123-4567', '4.0']]).rows[0]?.input
        ?.allowedAttendees,
    ).toBe(4)
  })

  it('puts back the leading zero a spreadsheet dropped from a mobile number', () => {
    const result = plan([
      ['Dana', '', '501234567', ''],
      ['Noa', '', '312345678', ''],
    ])

    expect(result.rows[0]?.input?.phone).toBe('0501234567')
    expect(result.rows[1]?.error).toBe('INVALID_PHONE')
  })

  it('reports a phone repeated in the file, in any format, keeping the first', () => {
    const result = plan([
      ['Dana', 'Cohen', '050-123-4567', ''],
      ['Dana', 'Again', '+972 50 123 4567', ''],
      ['Noa', 'Levi', '052-765-4321', ''],
    ])

    expect(result.rows.map((row) => row.error)).toEqual([
      null,
      'DUPLICATE_IN_FILE',
      null,
    ])
  })

  it('reports a phone an active guest already has, and never overwrites the guest', () => {
    const existing = makeGuest({
      phone: '050-123-4567',
      normalizedPhone: '+972501234567',
    })

    const result = plan([['Dana', 'Cohen', '0501234567', '']], [existing])

    expect(result.rows[0]).toMatchObject({
      outcome: 'error',
      error: 'DUPLICATE_IN_EVENT',
    })
  })

  it('restores a soft-deleted guest whose phone is imported, once', () => {
    const deleted = makeGuest({
      phone: '050-123-4567',
      normalizedPhone: '+972501234567',
      deleted: true,
    })

    const result = plan(
      [
        ['Dana', 'Cohen', '050-123-4567', ''],
        ['Dana', 'Twice', '050-123-4567', ''],
      ],
      [deleted],
    )

    expect(result.rows.map((row) => [row.outcome, row.error])).toEqual([
      ['restore', null],
      ['error', 'DUPLICATE_IN_FILE'],
    ])
  })

  it('ignores a guest of another event with the same phone', () => {
    const elsewhere = makeGuest({
      eventId: 'evt-2',
      phone: '050-123-4567',
      normalizedPhone: '+972501234567',
    })

    expect(
      plan([['Dana', 'Cohen', '050-123-4567', '']], [elsewhere]).valid,
    ).toBe(1)
  })

  it('skips rows with no content and keeps the file’s row numbers', () => {
    const result = plan([
      ['Dana', '', '050-123-4567', ''],
      ['', ' ', '', ''],
      ['Noa', '', '052-765-4321', ''],
    ])

    expect(result.rows.map((row) => row.rowNumber)).toEqual([2, 4])
  })

  it('reads only the mapped columns, and tolerates short rows', () => {
    const result = plan([['ignored', '050-123-4567', 'Dana'], ['x']], [], {
      firstName: 2,
      lastName: null,
      phone: 1,
      allowedAttendees: null,
      group: null,
    })

    expect(result.rows[0]?.input).toMatchObject({
      firstName: 'Dana',
      lastName: '',
      allowedAttendees: 5,
    })
    expect(result.rows).toHaveLength(1)
  })

  it('refuses a file with more rows than the limit', () => {
    const rows = Array.from({ length: MAX_IMPORT_ROWS + 1 }, () => ['a'])

    expect(() => plan(rows)).toThrow(DomainError)
    expect(() => plan(rows.slice(1))).not.toThrow()
  })
})

describe('importing into a Brazilian event (D103)', () => {
  const event = {
    id: 'evt-1',
    country: 'BR' as const,
    defaultAllowedAttendees: 5,
  }

  it('reads local numbers with their area code as Brazilian', () => {
    const result = planGuestImport(
      [
        ['Ana', 'Silva', '(11) 91234-5678', '', ''],
        ['Bruno', 'Souza', '21 3123-4567', '2', ''],
        ['Carla', 'Lima', '11912345678', '', ''],
      ],
      mapping,
      [],
      event,
    )

    expect(result.rows.map((row) => row.error)).toEqual([
      null,
      null,
      'DUPLICATE_IN_FILE',
    ])
    expect(result.rows[0]?.input?.phone).toBe('(11) 91234-5678')
  })

  it('does not add an Israeli leading zero to a Brazilian number', () => {
    const result = planGuestImport(
      [['Ana', '', '512345678', '', '']],
      mapping,
      [],
      event,
    )

    expect(result.rows[0]?.error).toBe('INVALID_PHONE')
  })
})
