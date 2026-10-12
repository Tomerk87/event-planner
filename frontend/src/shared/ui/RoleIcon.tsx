import { Crown, Shield, Users, type LucideIcon } from 'lucide-react'
import type { EventRole } from '../../domain/roles.ts'

const icons: Record<EventRole, LucideIcon> = {
  OWNER: Crown,
  ADMIN: Shield,
  VIEWER: Users,
}

interface RoleIconProps {
  role: EventRole
  className?: string
}

/** Decorative; pair it with visible or visually hidden role text. */
export function RoleIcon({ role, className }: RoleIconProps) {
  const Icon = icons[role]
  return <Icon className={className} aria-hidden="true" />
}
