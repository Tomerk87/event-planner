import {
  Crown,
  Eye,
  Pencil,
  Shield,
  Users,
  type LucideIcon,
} from 'lucide-react'
import type { AnyEventRole } from '../../domain/roles.ts'

const icons: Record<AnyEventRole, LucideIcon> = {
  OWNER: Crown,
  ADMIN: Shield,
  VIEWER: Users,
  VENUE_OWNER: Crown,
  VENUE_MANAGER: Shield,
  CLIENT_LEAD: Crown,
  CLIENT_EDITOR: Pencil,
  CLIENT_VIEWER: Eye,
}

interface RoleIconProps {
  role: AnyEventRole
  className?: string
}

/** Decorative; pair it with visible or visually hidden role text. */
export function RoleIcon({ role, className }: RoleIconProps) {
  const Icon = icons[role]
  return <Icon className={className} aria-hidden="true" />
}
