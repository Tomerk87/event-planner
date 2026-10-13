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
