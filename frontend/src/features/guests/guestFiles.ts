import { parseCsv, toCsv } from '../../domain/csv.ts'
import { DomainError } from '../../domain/errors.ts'
import { downloadBlob } from '../../shared/download.ts'

export type FileFormat = 'csv' | 'xlsx'

export const MAX_FILE_BYTES = 5 * 1024 * 1024
export const ACCEPTED_FILES = '.csv,.xlsx'

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

/**
 * Reads a CSV or Excel file chosen by the user into rows of text. The file is
 * read in the browser and goes nowhere else. Rows that are entirely empty are
 * dropped.
 */
export async function readSpreadsheet(file: File): Promise<string[][]> {
  if (file.size > MAX_FILE_BYTES) {
    throw new DomainError('VALIDATION', { field: 'fileSize' })
  }
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

/** Saves a table as a CSV or Excel file on the user's device. */
export async function saveSpreadsheet(
  table: Table,
  format: FileFormat,
  baseName: string,
  options: { sheetName: string; rightToLeft: boolean },
): Promise<void> {
  if (format === 'csv') {
    downloadBlob(
      new Blob([toCsv(table)], { type: 'text/csv;charset=utf-8' }),
      `${baseName}.csv`,
    )
    return
  }
  const { default: writeXlsxFile } = await import('write-excel-file/browser')
  const [headings = [], ...rows] = table
  const blob = await writeXlsxFile(
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
  downloadBlob(blob, `${baseName}.xlsx`)
}
