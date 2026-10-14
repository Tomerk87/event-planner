import { DomainError } from './errors.ts'

export const MESSAGE_VARIABLES = [
  'first_name',
  'last_name',
  'event_name',
  'event_date',
  'event_time',
  'rsvp_url',
] as const

export type MessageVariable = (typeof MESSAGE_VARIABLES)[number]

export type MessageValues = Record<MessageVariable, string>

/**
 * Fills `{{variable}}` placeholders in a message template. Placeholders that
 * are not one of the supported variables are left exactly as written, so a
 * typo stays visible in the preview instead of silently disappearing.
 */
export function renderMessage(template: string, values: MessageValues): string {
  return template.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (match, name: string) =>
    (MESSAGE_VARIABLES as readonly string[]).includes(name)
      ? values[name as MessageVariable]
      : match,
  )
}

/** Long enough for an invitation, short enough for a WhatsApp link. */
export const MESSAGE_MAX_LENGTH = 1000

/** Checks a template before it is saved; throws VALIDATION naming the reason. */
export function validateTemplate(body: string): string {
  if (body.trim() === '') {
    throw new DomainError('VALIDATION', { field: 'body', reason: 'empty' })
  }
  if (body.length > MESSAGE_MAX_LENGTH) {
    throw new DomainError('VALIDATION', { field: 'body', reason: 'tooLong' })
  }
  return body
}

/** Placeholders in a template that are not supported variables, each once. */
export function findUnknownVariables(template: string): string[] {
  const found = new Set<string>()
  for (const [, name = ''] of template.matchAll(/\{\{\s*([^{}\s]+)\s*\}\}/g)) {
    if (!(MESSAGE_VARIABLES as readonly string[]).includes(name)) {
      found.add(name)
    }
  }
  return [...found]
}

export function hasVariable(
  template: string,
  variable: MessageVariable,
): boolean {
  return new RegExp(`\\{\\{\\s*${variable}\\s*\\}\\}`).test(template)
}

/**
 * The link that opens WhatsApp with a message ready to send. The number is
 * the full international one without "+" (take `normalizedPhone`); leave it
 * out to let the sender choose the recipient in WhatsApp.
 */
export function buildWhatsAppUrl(
  normalizedPhone: string | null,
  message: string,
): string {
  const number = normalizedPhone?.replace(/\D/g, '') ?? ''
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`
}

export type MessageMark = 'bold' | 'italic' | 'strike'

/** The characters WhatsApp reads as formatting around a piece of text. */
export const MARK_CHARACTERS: Record<MessageMark, string> = {
  bold: '*',
  italic: '_',
  strike: '~',
}

export interface TextEdit {
  text: string
  /** Where the selection should be afterwards. */
  selectionStart: number
  selectionEnd: number
}

/** Replaces the selected range with `insert`, leaving the cursor after it. */
export function insertText(
  text: string,
  start: number,
  end: number,
  insert: string,
): TextEdit {
  const cursor = start + insert.length
  return {
    text: text.slice(0, start) + insert + text.slice(end),
    selectionStart: cursor,
    selectionEnd: cursor,
  }
}

/**
 * Wraps the selected range in a formatting mark, or removes the mark when the
 * selection already carries it. With nothing selected the marks are inserted
 * with the cursor between them.
 */
export function toggleMark(
  text: string,
  start: number,
  end: number,
  mark: MessageMark,
): TextEdit {
  const character = MARK_CHARACTERS[mark]
  const selected = text.slice(start, end)
  if (
    text[start - 1] === character &&
    text[end] === character &&
    start !== end
  ) {
    return {
      text: text.slice(0, start - 1) + selected + text.slice(end + 1),
      selectionStart: start - 1,
      selectionEnd: end - 1,
    }
  }
  return {
    text:
      text.slice(0, start) + character + selected + character + text.slice(end),
    selectionStart: start + 1,
    selectionEnd: end + 1,
  }
}

export type MessageNode =
  | { type: 'text'; text: string }
  | { type: 'link'; text: string }
  | { type: MessageMark; children: MessageNode[] }

const MARK_OF: Record<string, MessageMark> = {
  '*': 'bold',
  _: 'italic',
  '~': 'strike',
}

// A marked span starts and ends on a non-space character, on one line, and
// is not glued to a letter or digit on the outside (so 5*3*2 stays as typed).
const FORMATTING =
  /(https?:\/\/[^\s]+)|(?<![\p{L}\p{N}])([*_~])(?=\S)([^\n]*?\S)\2(?![\p{L}\p{N}])/u

/**
 * Splits a message into the pieces WhatsApp would show: bold, italic and
 * struck-through text, and web addresses as links.
 */
export function parseMessage(message: string): MessageNode[] {
  const nodes: MessageNode[] = []
  let rest = message
  while (rest !== '') {
    const match = FORMATTING.exec(rest)
    if (!match) {
      nodes.push({ type: 'text', text: rest })
      break
    }
    if (match.index > 0) {
      nodes.push({ type: 'text', text: rest.slice(0, match.index) })
    }
    const [whole, link, character = '', inner = ''] = match
    if (link !== undefined) {
      nodes.push({ type: 'link', text: link })
    } else {
      nodes.push({
        type: MARK_OF[character] ?? 'bold',
        children: parseMessage(inner),
      })
    }
    rest = rest.slice(match.index + whole.length)
  }
  return nodes
}
