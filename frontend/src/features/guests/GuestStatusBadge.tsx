import {
  Check,
  CircleHelp,
  Clock,
  Send,
  X,
  type LucideIcon,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { GuestDisplayStatus } from '../../domain/guestStatus.ts'
import type { RsvpResponse } from '../../domain/models.ts'
import { Badge, type Tone } from '../../shared/ui/Badge.tsx'

const STYLES: Record<GuestDisplayStatus, { icon: LucideIcon; tone: Tone }> = {
  NOT_SENT: { icon: Send, tone: 'neutral' },
  AWAITING: { icon: Clock, tone: 'info' },
  APPROVED: { icon: Check, tone: 'success' },
  NOT_SURE: { icon: CircleHelp, tone: 'warning' },
  DECLINED: { icon: X, tone: 'danger' },
}

export function GuestStatusBadge({ status }: { status: GuestDisplayStatus }) {
  const { t } = useTranslation()
  const { icon: Icon, tone } = STYLES[status]

  return (
    <Badge tone={tone} icon={<Icon />}>
      {t(`guests.status.${status}`)}
    </Badge>
  )
}

/** The response an unknown person gave; they always answered something. */
export function ResponseBadge({ status }: { status: RsvpResponse }) {
  return <GuestStatusBadge status={status} />
}
