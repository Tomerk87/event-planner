/** A spreadsheet as plain rows of cells. */
export type CsvRows = string[][]

const BYTE_ORDER_MARK = '﻿'
const DELIMITERS = [',', ';', '\t'] as const

/** The separator used in the first line: the one that occurs most outside quotes. */
function detectDelimiter(text: string): string {
  const counts = new Map<string, number>(DELIMITERS.map((d) => [d, 0]))
  let quoted = false
  for (const character of text) {
    if (character === '"') {
      quoted = !quoted
    } else if (!quoted && (character === '\n' || character === '\r')) {
      break
    } else if (!quoted && counts.has(character)) {
      counts.set(character, (counts.get(character) ?? 0) + 1)
    }
  }
  let best: string = ','
  for (const delimiter of DELIMITERS) {
    if ((counts.get(delimiter) ?? 0) > (counts.get(best) ?? 0)) {
      best = delimiter
    }
  }
  return best
}

/**
 * Reads CSV text into rows of cells. Handles quoted cells (with commas, line
 * breaks and doubled quotes inside), Windows and Unix line endings, a leading
 * byte-order mark, and files separated by commas, semicolons or tabs. Rows
 * that are entirely empty are dropped.
 */
export function parseCsv(input: string): CsvRows {
  const text = input.startsWith(BYTE_ORDER_MARK) ? input.slice(1) : input
  const delimiter = detectDelimiter(text)
  const rows: CsvRows = []
  let row: string[] = []
  let cell = ''
  let quoted = false

  function endRow() {
    row.push(cell)
    cell = ''
    if (row.some((value) => value.trim() !== '')) {
      rows.push(row)
    }
    row = []
  }

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        cell += '"'
        index += 1
      } else if (character === '"') {
        quoted = false
      } else {
        cell += character
      }
    } else if (character === '"' && cell === '') {
      quoted = true
    } else if (character === delimiter) {
      row.push(cell)
      cell = ''
    } else if (character === '\n') {
      endRow()
    } else if (character === '\r') {
      if (text[index + 1] === '\n') {
        index += 1
      }
      endRow()
    } else {
      cell += character
    }
  }
  if (cell !== '' || row.length > 0) {
    endRow()
  }
  return rows
}

/**
 * Makes a value safe to open in a spreadsheet. A cell starting with "=", "@",
 * a tab or a carriage return — or with "+" or "-" when it is not simply a
 * number or a phone — would be run as a formula, so it is written as text.
 * Values typed by guests on a public form end up in these files.
 */
export function neutralizeFormula(value: string): string {
  if (/^[=@\t\r]/.test(value)) {
    return `'${value}`
  }
  if (/^[+-]/.test(value) && !/^[+-]?[\d\s().-]+$/.test(value)) {
    return `'${value}`
  }
  return value
}

function writeCell(value: string | number | null): string {
  const text =
    value === null
      ? ''
      : typeof value === 'number'
        ? String(value)
        : neutralizeFormula(value)
  return /[",\r\n]/.test(text) || text !== text.trim()
    ? `"${text.replaceAll('"', '""')}"`
    : text
}

/**
 * Writes rows as CSV text: comma-separated, Windows line endings, and a
 * byte-order mark so that Excel reads Hebrew and other non-Latin text.
 */
export function toCsv(
  rows: readonly (readonly (string | number | null)[])[],
): string {
  return (
    BYTE_ORDER_MARK +
    rows.map((row) => row.map(writeCell).join(',')).join('\r\n') +
    '\r\n'
  )
}
