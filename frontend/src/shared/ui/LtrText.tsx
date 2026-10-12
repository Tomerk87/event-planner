import type { ReactNode } from 'react'

/**
 * Keeps inherently left-to-right values (phone numbers, email addresses, URLs)
 * in their natural order inside right-to-left text.
 */
export function LtrText({ children }: { children: ReactNode }) {
  return <bdi dir="ltr">{children}</bdi>
}
