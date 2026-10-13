export const COVER_PALETTES = 6
export const COVER_ICONS = 8

/** The same event always gets the same cover; different events usually differ. */
export function coverVariant(eventId: string): {
  palette: number
  icon: number
} {
  // FNV-1a, then a finishing mix so short, similar ids still spread out.
  let hash = 0x811c9dc5
  for (const character of eventId) {
    hash ^= character.codePointAt(0) ?? 0
    hash = Math.imul(hash, 0x01000193)
  }
  hash ^= hash >>> 15
  hash = Math.imul(hash, 0x2c1b3c6d)
  hash ^= hash >>> 12
  hash = Math.imul(hash, 0x297a2d39)
  hash = (hash ^ (hash >>> 15)) >>> 0
  return {
    palette: hash % COVER_PALETTES,
    icon: (hash >>> 8) % COVER_ICONS,
  }
}
