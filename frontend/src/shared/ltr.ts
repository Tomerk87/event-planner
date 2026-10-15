/**
 * A left-to-right value (an email address, a phone number) placed inside a
 * translated sentence, wrapped in left-to-right isolate marks so it reads
 * in order inside Hebrew text. `LtrText` does the same for an element.
 */
export function ltr(value: string): string {
  return `\u2066${value}\u2069`
}
