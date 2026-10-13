import {
  Circle,
  RectangleHorizontal,
  Square,
  type LucideIcon,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { TableShape } from '../../domain/models.ts'
import type { TableStatus } from '../../domain/seating.ts'
import { useFormatters } from '../../i18n/format.ts'
import { Badge, type Tone } from '../../shared/ui/Badge.tsx'
import styles from './EventLayout.module.css'

const STATUS_TONES: Record<TableStatus, Tone> = {
  OVER_CAPACITY: 'danger',
  FULL: 'info',
  ALMOST_FULL: 'warning',
  READY: 'success',
}

export function TableStatusBadge({ status }: { status: TableStatus }) {
  const { t } = useTranslation()

  return (
    <Badge tone={STATUS_TONES[status]}>{t(`layout.status.${status}`)}</Badge>
  )
}

const SHAPE_ICONS: Record<TableShape, LucideIcon> = {
  CIRCLE: Circle,
  RECTANGLE: RectangleHorizontal,
  SQUARE: Square,
}

export function ShapeLabel({ shape }: { shape: TableShape }) {
  const { t } = useTranslation()
  const Icon = SHAPE_ICONS[shape]

  return (
    <span className={styles.shape}>
      <Icon aria-hidden="true" />
      {t(`layout.shapes.${shape}`)}
    </span>
  )
}

/** How many attendees a party brings: "1 attendee", "4 attendees". */
export function AttendeeCount({ count }: { count: number }) {
  const { t } = useTranslation()
  const format = useFormatters()

  return count === 1
    ? t('layout.attendeesOne')
    : t('layout.attendeesMany', { count: format.number(count) })
}
