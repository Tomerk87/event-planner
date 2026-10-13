import { DomainError, isDomainError } from './errors.ts'
import { EVENT_LIMITS } from './events.ts'
import { addGuest, type GuestInput } from './guests.ts'
import type { Guest, Id } from './models.ts'
import { normalizePhone } from './phone.ts'

export const IMPORT_FIELDS = [
  'firstName',
  'lastName',
  'phone',
  'allowedAttendees',
] as const

export type ImportField = (typeof IMPORT_FIELDS)[number]

/** The fields a file must supply; the others are optional. */
export const REQUIRED_IMPORT_FIELDS: readonly ImportField[] = [
  'firstName',
  'phone',
]

/** For each field, the position of the file's column that holds it. */
export type ColumnMapping = Record<ImportField, number | null>

export const MAX_IMPORT_ROWS = 5000

// Headings recognised automatically, in English and Hebrew, compared without
// case, spaces or punctuation.
const HEADING_ALIASES: Record<ImportField, readonly string[]> = {
  firstName: [
    'firstname',
    'first',
    'name',
    'fullname',
    'guestname',
    'שםפרטי',
    'שם',
    'שםמלא',
  ],
  lastName: ['lastname', 'last', 'surname', 'familyname', 'שםמשפחה', 'משפחה'],
  phone: [
    'phone',
    'phonenumber',
    'mobile',
    'cell',
    'cellphone',
    'tel',
    'telephone',
    'whatsapp',
    'טלפון',
    'נייד',
    'מספרטלפון',
    'טלפוןנייד',
    'פלאפון',
  ],
  allowedAttendees: [
    'allowed',
    'allowedattendees',
    'expected',
    'expectedattendees',
    'attendees',
    'guests',
    'maxattendees',
    'allowance',
    'מוזמנים',
    'מספרמוזמנים',
    'משתתפים',
    'משתתפיםמותרים',
    'צפויים',
    'משתתפיםצפויים',
    'כמות',
  ],
}

function simplify(heading: string): string {
  return heading.toLowerCase().replace(/[\s_\-./#:'"׳״()]/g, '')
}

/** Guesses which column holds each field from the file's heading row. */
export function detectMapping(headings: readonly string[]): ColumnMapping {
  const simplified = headings.map(simplify)
  const taken = new Set<number>()
  const mapping: ColumnMapping = {
    firstName: null,
    lastName: null,
    phone: null,
    allowedAttendees: null,
  }
  // Exact-alias order matters: "first name" must win over the generic "name".
  for (const field of IMPORT_FIELDS) {
    for (const alias of HEADING_ALIASES[field]) {
      const index = simplified.findIndex(
        (heading, position) => heading === alias && !taken.has(position),
      )
      if (index !== -1) {
        mapping[field] = index
        taken.add(index)
        break
      }
    }
  }
  return mapping
}

export function isMappingComplete(mapping: ColumnMapping): boolean {
  return REQUIRED_IMPORT_FIELDS.every((field) => mapping[field] !== null)
}

/**
 * A spreadsheet that stores a phone as a number drops its leading zero, so an
 * Israeli mobile arrives as nine digits starting with 5. The zero is put back.
 */
function restoreLeadingZero(phone: string): string {
  return /^5\d{8}$/.test(phone) ? `0${phone}` : phone
}

export type ImportRowError =
  | 'MISSING_FIRST_NAME'
  | 'MISSING_PHONE'
  | 'INVALID_PHONE'
  | 'INVALID_ALLOWED'
  | 'DUPLICATE_IN_FILE'
  | 'DUPLICATE_IN_EVENT'

export interface ImportRow {
  /** The row's position in the file, counting the heading row, from 1. */
  rowNumber: number
  /** The values as found in the file. */
  values: Record<ImportField, string>
  /** `new` adds a guest; `restore` reactivates a soft-deleted one. */
  outcome: 'new' | 'restore' | 'error'
  error: ImportRowError | null
  /** What will be saved; null for a row with an error. */
  input: GuestInput | null
}

export interface ImportPlan {
  rows: ImportRow[]
  valid: number
  invalid: number
}

function parseAllowed(text: string, fallback: number): number | null {
  if (text === '') {
    return fallback
  }
  const { min, max } = EVENT_LIMITS.allowedAttendees
  // Spreadsheets often store whole numbers as "4.0".
  const value = /^\d+(\.0+)?$/.test(text) ? Number(text) : Number.NaN
  return Number.isInteger(value) && value >= min && value <= max ? value : null
}

/**
 * Works out what importing a file would do, without changing anything. Every
 * row gets the same checks as a guest added by hand. A phone already used by
 * an active guest, or appearing earlier in the same file, is an error: an
 * import never overwrites an existing guest.
 *
 * `dataRows` excludes the heading row; `firstRowNumber` is the file position
 * of its first row. Rows with no content at all are ignored.
 */
export function planGuestImport(
  dataRows: readonly (readonly string[])[],
  mapping: ColumnMapping,
  existing: readonly Guest[],
  eventId: Id,
  defaultAllowedAttendees: number,
  firstRowNumber = 2,
): ImportPlan {
  if (dataRows.length > MAX_IMPORT_ROWS) {
    throw new DomainError('VALIDATION', { field: 'rows', max: MAX_IMPORT_ROWS })
  }
  const read = (row: readonly string[], field: ImportField) => {
    const index = mapping[field]
    return index === null ? '' : (row[index] ?? '').trim()
  }

  const rows: ImportRow[] = []
  // Grows as rows are accepted, so later rows are checked against earlier ones.
  let guests: Guest[] = [...existing]
  const inFile = new Set<string>()

  dataRows.forEach((row, index) => {
    const values: Record<ImportField, string> = {
      firstName: read(row, 'firstName'),
      lastName: read(row, 'lastName'),
      phone: restoreLeadingZero(read(row, 'phone')),
      allowedAttendees: read(row, 'allowedAttendees'),
    }
    if (Object.values(values).every((value) => value === '')) {
      return
    }
    const rowNumber = firstRowNumber + index
    const fail = (error: ImportRowError) =>
      rows.push({ rowNumber, values, outcome: 'error', error, input: null })

    if (values.firstName === '') {
      return fail('MISSING_FIRST_NAME')
    }
    if (values.phone === '') {
      return fail('MISSING_PHONE')
    }
    const allowedAttendees = parseAllowed(
      values.allowedAttendees,
      defaultAllowedAttendees,
    )
    if (allowedAttendees === null) {
      return fail('INVALID_ALLOWED')
    }
    const input: GuestInput = {
      firstName: values.firstName,
      lastName: values.lastName,
      phone: values.phone,
      allowedAttendees,
    }
    try {
      const { guest, restored } = addGuest(
        guests,
        eventId,
        input,
        `import-${rowNumber}`,
      )
      inFile.add(guest.normalizedPhone)
      guests = restored
        ? guests.map((candidate) =>
            candidate.id === guest.id ? guest : candidate,
          )
        : [...guests, guest]
      rows.push({
        rowNumber,
        values,
        outcome: restored ? 'restore' : 'new',
        error: null,
        input,
      })
    } catch (error) {
      if (isDomainError(error, 'INVALID_PHONE')) {
        return fail('INVALID_PHONE')
      }
      if (isDomainError(error, 'DUPLICATE_PHONE')) {
        // The phone is valid, or it would have failed as invalid above.
        return fail(
          inFile.has(normalizePhone(values.phone))
            ? 'DUPLICATE_IN_FILE'
            : 'DUPLICATE_IN_EVENT',
        )
      }
      throw error
    }
  })

  const valid = rows.filter((row) => row.outcome !== 'error').length
  return { rows, valid, invalid: rows.length - valid }
}
