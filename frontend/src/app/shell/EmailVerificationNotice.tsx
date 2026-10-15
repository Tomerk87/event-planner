import { useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import {
  useCurrentUser,
  useEmailEnabled,
  useEmailVerified,
} from '../../services/queries.ts'
import { useServices } from '../../services/servicesContext.ts'
import { describeError } from '../../shared/errorMessage.ts'
import { Button } from '../../shared/ui/Button.tsx'
import { ltr } from '../../shared/ltr.ts'
import { Notice } from '../../shared/ui/Notice.tsx'
import { useToast } from '../../shared/ui/toastContext.ts'

/**
 * Asks an account to verify its email, above every page, until it does
 * (D89). Shown only while the server sends email; never in the demo.
 */
export function EmailVerificationNotice() {
  const enabled = useEmailEnabled()
  return enabled ? <UnverifiedNotice /> : null
}

function UnverifiedNotice() {
  const { t } = useTranslation()
  const { session } = useServices()
  const user = useCurrentUser()
  const verified = useEmailVerified()
  const { showToast } = useToast()
  const resend = useMutation({
    mutationFn: () => session.resendVerification(),
    onSuccess: () =>
      showToast({ tone: 'success', message: t('email.notice.sent') }),
    onError: (error) =>
      showToast({ tone: 'danger', message: describeError(t, error) }),
  })

  if (verified.data !== false || !user.data) {
    return null
  }
  return (
    <Notice
      tone="warning"
      title={t('email.notice.title')}
      action={
        <Button
          variant="secondary"
          size="sm"
          loading={resend.isPending}
          onClick={() => resend.mutate()}
        >
          {t('email.notice.resend')}
        </Button>
      }
    >
      <p>{t('email.notice.body', { email: ltr(user.data.email) })}</p>
    </Notice>
  )
}
