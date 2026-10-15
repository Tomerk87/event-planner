/**
 * A left-to-right value (an email address, a phone number) placed inside a
 * translated sentence, wrapped in left-to-right isolate marks so it reads
 * in order inside Hebrew text. `LtrText` does the same for an element.
 */
export function ltr(value: string): string {
  return `\u2066${value}\u2069`
}

/**
 * A name of either direction (an event's or a person's) placed inside a
 * translated sentence, wrapped in first-strong isolate marks so it reads in
 * its own direction, whatever the sentence's.
 */
export function isolate(value: string): string {
  return `\u2068${value}\u2069`
}
