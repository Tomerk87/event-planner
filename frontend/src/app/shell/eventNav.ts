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
 * Permissions is omitted for a Viewer. With no known role the full list is
 * returned; the Permissions page itself still enforces access.
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

  if (role === undefined || canOpenPermissions(role)) {
    items.push({
      to: `${base}/permissions`,
      label: t('nav.permissions'),
      icon: Shield,
    })
  }

  return items
}
