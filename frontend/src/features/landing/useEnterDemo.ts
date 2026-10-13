import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSession } from '../../app/session/sessionContext.ts'
import { describeError } from '../../shared/errorMessage.ts'
import { useToast } from '../../shared/ui/toastContext.ts'

/** Opens the demo; the route guard then moves on to My Events. */
export function useEnterDemo(): { enter: () => void; isPending: boolean } {
  const { t } = useTranslation()
  const { enterDemo } = useSession()
  const { showToast } = useToast()
  const [isPending, setIsPending] = useState(false)

  return {
    isPending,
    enter: () => {
      setIsPending(true)
      enterDemo().catch((error: unknown) => {
        setIsPending(false)
        showToast({ tone: 'danger', message: describeError(t, error) })
      })
    },
  }
}
