import { describe, expect, it } from 'vitest'
import { neutralizeFormula, parseCsv, toCsv } from './csv.ts'
import { buildGuestExportTable } from './exports.ts'

describe('parseCsv', () => {
  it('reads rows of cells', () => {
    expect(parseCsv('a,b,c\n1,2,3\n')).toEqual([
      ['a', 'b', 'c'],
      ['1', '2', '3'],
    ])
  })

  it('reads quoted cells with commas, quotes and line breaks inside', () => {
    expect(
      parseCsv('name,note\n"Levi, Dana","said ""hi""\nthen left"'),
    ).toEqual([
      ['name', 'note'],
      ['Levi, Dana', 'said "hi"\nthen left'],
    ])
  })

  it.each([
    ['Windows', 'a,b\r\n1,2\r\n'],
    ['old Mac', 'a,b\r1,2\r'],
    ['no final line break', 'a,b\n1,2'],
  ])('handles %s line endings', (_, text) => {
    expect(parseCsv(text)).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ])
  })

  it('ignores a byte-order mark and reads Hebrew', () => {
    expect(parseCsv('﻿שם,טלפון\nנועה,050-1234567')).toEqual([
      ['שם', 'טלפון'],
      ['נועה', '050-1234567'],
    ])
  })

  it.each([
    ['semicolons', 'a;b;c\n1;2;3'],
    ['tabs', 'a\tb\tc\n1\t2\t3'],
  ])('detects a file separated by %s', (_, text) => {
    expect(parseCsv(text)).toEqual([
      ['a', 'b', 'c'],
      ['1', '2', '3'],
    ])
  })

  it('does not take a separator inside quotes for the delimiter', () => {
    expect(parseCsv('"a;b;c;d",x\n1,2')).toEqual([
      ['a;b;c;d', 'x'],
      ['1', '2'],
    ])
  })

  it('drops rows that are entirely empty and keeps empty cells', () => {
    expect(parseCsv('a,b\n\n , \n1,\n')).toEqual([
      ['a', 'b'],
      ['1', ''],
    ])
  })

  it('treats a quote in the middle of a cell as text', () => {
    expect(parseCsv('5" nails,x')).toEqual([['5" nails', 'x']])
  })

  it('returns nothing for empty text', () => {
    expect(parseCsv('')).toEqual([])
    expect(parseCsv('﻿')).toEqual([])
  })
})

describe('neutralizeFormula', () => {
  it.each([
    '=SUM(A1:A9)',
    "=cmd|' /C calc'!A0",
    '@SUM(1+1)',
    '+1+1',
    '-2+3',
    '+HYPERLINK("http://example.com")',
    '\tTabbed',
    '\rReturn',
  ])('writes %j as text', (value) => {
    expect(neutralizeFormula(value)).toBe(`'${value}`)
  })

  it.each([
    'Dana Cohen',
    '+972 50-123-4567',
    '+972501234567',
    '-5',
    '050-123-4567',
    '(050) 123.4567',
    'a=b',
    'נועה',
    '',
  ])('leaves %j as it is', (value) => {
    expect(neutralizeFormula(value)).toBe(value)
  })
})

describe('toCsv', () => {
  it('writes a byte-order mark, commas and Windows line endings', () => {
    expect(
      toCsv([
        ['a', 'b'],
        [1, null],
      ]),
    ).toBe('﻿a,b\r\n1,\r\n')
  })

  it('quotes cells that need it', () => {
    expect(toCsv([['Levi, Dana', 'said "hi"', 'two\nlines', ' padded ']])).toBe(
      '﻿"Levi, Dana","said ""hi""","two\nlines"," padded "\r\n',
    )
  })

  it('makes formulas harmless but keeps phones and numbers', () => {
    expect(toCsv([['=1+1', '+972 50-123-4567', -3]])).toBe(
      "﻿'=1+1,+972 50-123-4567,-3\r\n",
    )
  })

  it('reads back exactly what it wrote', () => {
    const rows = [
      ['שם', 'Note'],
      ['נועה לוי', 'a, "b"\nc'],
      ['Dana', ''],
    ]

    expect(parseCsv(toCsv(rows))).toEqual(rows)
  })
})

describe('guest export table', () => {
  const labels = {
    headings: {
      firstName: 'First name',
      lastName: 'Last name',
      invitationName: 'Invitation name',
      phone: 'Phone',
      allowedAttendees: 'Allowed',
      confirmedAttendees: 'Confirmed',
      status: 'Status',
      invitationSentCount: 'Invitations sent',
      tableNumber: 'Table',
      group: 'Group',
    },
    statuses: {
      NOT_SENT: 'Not Sent',
      AWAITING: 'Awaiting Response',
      APPROVED: 'Approved',
      NOT_SURE: 'Not Sure',
      DECLINED: 'Declined',
    },
  }
  const base = {
    firstName: 'Dana',
    lastName: 'Cohen',
    invitationName: '',
    phone: '050-123-4567',
    allowedAttendees: 5,
    confirmedAttendees: null,
    invitationSentCount: 0,
    tableNumber: null,
    group: '',
  }

  it('has a heading row and one row per guest with every field', () => {
    const table = buildGuestExportTable(
      [
        { ...base, rsvpStatus: 'NO_RESPONSE' },
        {
          ...base,
          firstName: 'Noa',
          invitationName: 'Noa & Guy',
          rsvpStatus: 'APPROVED',
          confirmedAttendees: 3,
          invitationSentCount: 2,
          tableNumber: 7,
          group: 'Family',
        },
        { ...base, rsvpStatus: 'NO_RESPONSE', invitationSentCount: 1 },
      ],
      labels,
    )

    expect(table).toEqual([
      [
        'First name',
        'Last name',
        'Invitation name',
        'Phone',
        'Allowed',
        'Confirmed',
        'Status',
        'Invitations sent',
        'Table',
        'Group',
      ],
      ['Dana', 'Cohen', '', '050-123-4567', 5, null, 'Not Sent', 0, null, ''],
      [
        'Noa',
        'Cohen',
        'Noa & Guy',
        '050-123-4567',
        5,
        3,
        'Approved',
        2,
        7,
        'Family',
      ],
      [
        'Dana',
        'Cohen',
        '',
        '050-123-4567',
        5,
        null,
        'Awaiting Response',
        1,
        null,
        '',
      ],
    ])
  })

  it('writes to CSV with a guest-typed formula made harmless', () => {
    const csv = toCsv(
      buildGuestExportTable(
        [
          {
            ...base,
            invitationName: '=HYPERLINK("x")',
            rsvpStatus: 'DECLINED',
          },
        ],
        labels,
      ),
    )

    expect(csv).toContain(`"'=HYPERLINK(""x"")"`)
    expect(csv).toContain('Declined')
  })
})
