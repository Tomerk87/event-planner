import { cx } from '../../shared/ui/cx.ts'
import styles from './SpaceCover.module.css'

const GRADIENTS = 4

/** Up to two initials of a space's name: "Main Hall" is "MH". */
function initialsOf(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => Array.from(word)[0] ?? '')
    .join('')
    .toLocaleUpperCase()
}

/** The same space always gets the same colours. */
function gradientOf(id: string): number {
  let hash = 0
  for (const character of id) {
    hash = (hash * 31 + character.charCodeAt(0)) % 997
  }
  return hash % GRADIENTS
}

/**
 * A space's photo, or its initials on a generated colour (mockups #3, #5).
 * Decorative: the space's name is always written beside it.
 */
export function SpaceCover({
  id,
  name,
  photo,
  size = 'card',
}: {
  id: string
  name: string
  photo: string | null
  size?: 'card' | 'tile'
}) {
  return (
    <div
      className={cx(
        styles.cover,
        styles[size],
        !photo && styles[`gradient${gradientOf(id)}`],
      )}
      aria-hidden="true"
    >
      {photo ? (
        <img className={styles.photo} src={photo} alt="" />
      ) : (
        <span className={styles.initials}>{initialsOf(name)}</span>
      )}
    </div>
  )
}
