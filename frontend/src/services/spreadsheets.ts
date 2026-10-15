import { parseCsv, toCsv } from '../domain/csv.ts'
import { DomainError } from '../domain/errors.ts'
import type { SpreadsheetOptions } from './contracts/index.ts'

/** Largest guest file accepted, in the browser and on the server. */
export const MAX_FILE_BYTES = 5 * 1024 * 1024

type Table = readonly (readonly (string | number | null)[])[]

function cellText(value: unknown): string {
  if (value === null || value === undefined) {
    return ''
  }
  if (value instanceof Date) {
    return value.toISOString()
  }
  return String(value).trim()
}

/** Refuses a file before it is read or uploaded, the way the server would. */
export function assertGuestFileSize(file: File): void {
  if (file.size > MAX_FILE_BYTES) {
    throw new DomainError('VALIDATION', { field: 'fileSize' })
  }
}

/**
 * Reads a CSV or Excel file in the browser into rows of text, as the server
 * does for the real application. Rows that are entirely empty are dropped.
 */
export async function readSpreadsheet(file: File): Promise<string[][]> {
  assertGuestFileSize(file)
  const name = file.name.toLowerCase()
  if (name.endsWith('.csv')) {
    return parseCsv(await file.text())
  }
  if (name.endsWith('.xlsx')) {
    try {
      const { readSheet } = await import('read-excel-file/browser')
      // Numbers are kept as written, so a phone or a count is never reformatted.
      const rows = await readSheet(file, { parseNumber: (text) => text })
      return rows
        .map((row) => row.map(cellText))
        .filter((row) => row.some((cell) => cell !== ''))
    } catch {
      throw new DomainError('VALIDATION', { field: 'fileContent' })
    }
  }
  throw new DomainError('VALIDATION', { field: 'fileType' })
}

/** Writes a table as a CSV or Excel file in the browser. */
export async function spreadsheetBlob(
  table: Table,
  options: SpreadsheetOptions,
): Promise<Blob> {
  if (options.format === 'csv') {
    return new Blob([toCsv(table)], { type: 'text/csv;charset=utf-8' })
  }
  const { default: writeXlsxFile } = await import('write-excel-file/browser')
  const [headings = [], ...rows] = table
  return writeXlsxFile(
    [
      headings.map((value) => ({
        value: String(value ?? ''),
        type: String,
        fontWeight: 'bold' as const,
      })),
      // Text cells are typed as text, so a spreadsheet never runs them as a formula.
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
    { sheet: options.sheetName.slice(0, 31), rightToLeft: options.rightToLeft },
  ).toBlob()
}
