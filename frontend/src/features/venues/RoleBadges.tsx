import { Crown, Eye, Pencil, Shield } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { ClientTeamRole, VenueMemberRole } from '../../domain/venues.ts'
import { Badge } from '../../shared/ui/Badge.tsx'

/** A venue member's role (D112): the crown for an Owner. */
export function VenueRoleBadge({ role }: { role: VenueMemberRole }) {
  const { t } = useTranslation()
  return role === 'VENUE_OWNER' ? (
    <Badge tone="warning" icon={<Crown />}>
      {t('venueRoles.VENUE_OWNER')}
    </Badge>
  ) : (
    <Badge tone="info" icon={<Shield />}>
      {t('venueRoles.VENUE_MANAGER')}
    </Badge>
  )
}

const CLIENT_LOOK = {
  CLIENT_LEAD: { tone: 'warning', icon: Crown },
  CLIENT_EDITOR: { tone: 'info', icon: Pencil },
  CLIENT_VIEWER: { tone: 'neutral', icon: Eye },
} as const

/** A role on the client side of a venue event (D113). */
export function ClientRoleBadge({ role }: { role: ClientTeamRole }) {
  const { t } = useTranslation()
  const { tone, icon: Icon } = CLIENT_LOOK[role]
  return (
    <Badge tone={tone} icon={<Icon />}>
      {t(`clientRoles.${role}`)}
    </Badge>
  )
}
