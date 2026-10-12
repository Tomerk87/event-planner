import { Eye, Lock } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { canEditEvent, getReadOnlyReason } from '../../domain/access.ts'
import { Badge } from '../ui/Badge.tsx'
import { Notice } from '../ui/Notice.tsx'
import { useEventAccess } from './eventAccessContext.ts'

/** Explains why the event cannot be edited. Renders nothing when it can. */
export function ReadOnlyNotice() {
  const { t } = useTranslation()
  const access = useEventAccess()
  const reason = access ? getReadOnlyReason(access) : null

  if (!reason) {
    return null
  }

  return (
    <Notice
      tone={reason === 'PAST_EVENT' ? 'warning' : 'info'}
      title={t(`access.${reason}.title`)}
    >
      {t(`access.${reason}.body`)}
    </Notice>
  )
}

/** Compact marker for a read-only state, for page headers and toolbars. */
export function ReadOnlyBadge() {
  const { t } = useTranslation()
  const access = useEventAccess()
  const reason = access ? getReadOnlyReason(access) : null

  if (!reason) {
    return null
  }

  return (
    <Badge
      tone={reason === 'PAST_EVENT' ? 'warning' : 'neutral'}
      icon={reason === 'PAST_EVENT' ? <Lock /> : <Eye />}
    >
      {t(`access.${reason}.title`)}
    </Badge>
  )
}

interface EditGateProps {
  children: ReactNode
  fallback?: ReactNode
}

/**
 * Renders editing controls only when the current user may edit the event.
 * This is a convenience for the interface; the data layer enforces the rule.
 */
export function EditGate({ children, fallback = null }: EditGateProps) {
  const access = useEventAccess()

  return access && canEditEvent(access) ? children : fallback
}
