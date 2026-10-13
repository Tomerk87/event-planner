import type { TFunction } from 'i18next'
import {
  Home,
  Mail,
  MessageSquareMore,
  Settings,
  Shield,
  Table2,
  Users,
} from 'lucide-react'
import { canOpenPermissions } from '../../domain/access.ts'
import type { EventRole } from '../../domain/roles.ts'
import type { ShellNavItem } from './AppShell.tsx'

/**
 * Event navigation, identical on every event page (PRD section 4.2).
 * Permissions is shown only once the user is known to be an Owner or Admin,
 * so it never appears for a Viewer, even while the role is still loading.
 */
export function getEventNavItems(
  t: TFunction,
  eventId: string,
  role?: EventRole,
): ShellNavItem[] {
  const base = `/events/${eventId}`
  const items: ShellNavItem[] = [
    { to: `${base}/dashboard`, label: t('nav.dashboard'), icon: Home },
    { to: `${base}/guests`, label: t('nav.guests'), icon: Users },
    { to: `${base}/rsvp`, label: t('nav.rsvp'), icon: Mail },
    {
      to: `${base}/messages`,
      label: t('nav.messages'),
      icon: MessageSquareMore,
    },
    { to: `${base}/layout`, label: t('nav.eventLayout'), icon: Table2 },
    { to: `${base}/settings`, label: t('nav.eventSettings'), icon: Settings },
  ]

  if (role !== undefined && canOpenPermissions(role)) {
    items.push({
      to: `${base}/permissions`,
      label: t('nav.permissions'),
      icon: Shield,
    })
  }

  return items
}
