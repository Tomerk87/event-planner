import { useTranslation } from 'react-i18next'
import { describeError } from '../../shared/errorMessage.ts'
import { useToast } from '../../shared/ui/toastContext.ts'
import { useSession } from './sessionContext.ts'

/** Ends the session; the route guard then returns to the landing page. */
export function useSignOut(): () => void {
  const { t } = useTranslation()
  const { signOut } = useSession()
  const { showToast } = useToast()

  return () => {
    signOut().catch((error: unknown) => {
      showToast({ tone: 'danger', message: describeError(t, error) })
    })
  }
}
