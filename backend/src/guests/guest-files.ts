import { readSheet } from 'read-excel-file/node'
import writeXlsxFile from 'write-excel-file/node'
import { parseCsv, toCsv } from '../domain/csv.ts'
import { DomainError } from '../domain/errors.ts'

export type FileFormat = 'csv' | 'xlsx'

export const MAX_FILE_BYTES = 5 * 1024 * 1024

type Table = readonly (readonly (string | number | null)[])[]

function cellText(value: unknown): string {
  if (value === null || value === undefined) {
    return ''
  }
  if (value instanceof Date) {
    return value.toISOString()
  }
  if (typeof value === 'string') {
    return value.trim()
  }
  return typeof value === 'number' || typeof value === 'boolean'
    ? String(value)
    : ''
}

/**
 * Reads an uploaded CSV or Excel file into rows of text, as the browser did
 * before the server existed. Rows that are entirely empty are dropped.
 */
export async function readSpreadsheet(file: {
  originalname: string
  size: number
  buffer: Buffer
}): Promise<string[][]> {
  if (file.size > MAX_FILE_BYTES) {
    throw new DomainError('VALIDATION', { field: 'fileSize' })
  }
  const name = file.originalname.toLowerCase()
  if (name.endsWith('.csv')) {
    return parseCsv(file.buffer.toString('utf8'))
  }
  if (name.endsWith('.xlsx')) {
    try {
      // Numbers are kept as written, so a phone or a count is never reformatted.
      const rows = await readSheet(file.buffer, { parseNumber: (text) => text })
      return rows
        .map((row) => row.map(cellText))
        .filter((row) => row.some((cell) => cell !== ''))
    } catch {
      throw new DomainError('VALIDATION', { field: 'fileContent' })
    }
  }
  throw new DomainError('VALIDATION', { field: 'fileType' })
}

/** A table as a CSV or Excel file. Text cells are never run as formulas. */
export async function writeSpreadsheet(
  table: Table,
  format: FileFormat,
  options: { sheetName: string; rightToLeft: boolean },
): Promise<{ bytes: Buffer; contentType: string }> {
  if (format === 'csv') {
    return {
      bytes: Buffer.from(toCsv(table), 'utf8'),
      contentType: 'text/csv; charset=utf-8',
    }
  }
  const [headings = [], ...rows] = table
  const bytes = await writeXlsxFile(
    [
      headings.map((value) => ({
        value: String(value ?? ''),
        type: String,
        fontWeight: 'bold' as const,
      })),
      ...rows.map((row) =>
        row.map((value) =>
          value === null
            ? null
            : typeof value === 'number'
              ? { value, type: Number }
              : { value, type: String },
        ),
      ),
    ],
    {
      sheet: options.sheetName.slice(0, 31) || 'Sheet',
      rightToLeft: options.rightToLeft,
    },
  ).toBuffer()
  return {
    bytes,
    contentType:
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  }
}
