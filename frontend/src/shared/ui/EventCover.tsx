import {
  Cake,
  Gift,
  GlassWater,
  Heart,
  Music,
  PartyPopper,
  Sparkles,
  Star,
  type LucideIcon,
} from 'lucide-react'
import { cx } from './cx.ts'
import styles from './EventCover.module.css'
import { coverVariant } from './eventCoverVariant.ts'

const ICONS: readonly LucideIcon[] = [
  Heart,
  PartyPopper,
  Cake,
  Sparkles,
  Music,
  GlassWater,
  Gift,
  Star,
]

interface EventCoverProps {
  eventId: string
  size?: 'card' | 'thumb'
  className?: string
}

/**
 * A generated cover for an event: a gradient and an icon chosen from the
 * event's id. Decorative; the event's name is always shown beside it.
 */
export function EventCover({
  eventId,
  size = 'card',
  className,
}: EventCoverProps) {
  const { palette, icon } = coverVariant(eventId)
  const Icon = ICONS[icon % ICONS.length] ?? Sparkles

  return (
    <span
      className={cx(
        styles.cover,
        styles[size],
        styles[`palette${palette}`],
        className,
      )}
      aria-hidden="true"
    >
      <Icon />
    </span>
  )
}
