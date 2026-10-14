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
  /** The event's own photo; the generated cover is shown without one. */
  image?: string | null
  size?: 'card' | 'thumb'
  className?: string
}

/**
 * An event's cover: its photo, or a gradient and an icon chosen from the
 * event's id. Decorative; the event's name is always shown beside it.
 */
export function EventCover({
  eventId,
  image,
  size = 'card',
  className,
}: EventCoverProps) {
  if (image) {
    return (
      <span
        className={cx(styles.cover, styles[size], styles.photo, className)}
        aria-hidden="true"
      >
        <img src={image} alt="" />
      </span>
    )
  }
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
