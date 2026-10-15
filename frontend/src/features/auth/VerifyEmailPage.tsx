import { useQueryClient } from '@tanstack/react-query'
import { useContext, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router'
import { useSession } from '../../app/session/sessionContext.ts'
import { isDomainError } from '../../domain/errors.ts'
import { ServicesContext } from '../../services/servicesContext.ts'
import { describeError } from '../../shared/errorMessage.ts'
import { Button } from '../../shared/ui/Button.tsx'
import { Notice } from '../../shared/ui/Notice.tsx'
import { LoadingState } from '../../shared/ui/States.tsx'
import { useToast } from '../../shared/ui/toastContext.ts'
import { AuthPage } from './AuthPage.tsx'

type Outcome =
  | { status: 'checking' }
  | { status: 'verified' }
  | { status: 'failed'; message: string }

/**
 * Opened from the verification email (D89), signed in or not, on any
 * device. Verifying turns the invitations to the email into access.
 */
export function VerifyEmailPage() {
  const { t } = useTranslation()
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const { session, accountEmail } = useSession()
  const services = useContext(ServicesContext)
  const queryClient = useQueryClient()
  const { showToast } = useToast()
  const [outcome, setOutcome] = useState<Outcome>(() =>
    token
      ? { status: 'checking' }
      : { status: 'failed', message: t('errors.LINK_EXPIRED') },
  )
  const [isResending, setIsResending] = useState(false)
  // A link works once, so it is sent once, even when React runs the effect
  // twice in development.
  const sent = useRef(false)
  const signedIn = session?.workspace === 'account'

  useEffect(() => {
    if (sent.current || !token) {
      return
    }
    sent.current = true
    accountEmail
      .verifyEmail(token)
      .then(() => {
        setOutcome({ status: 'verified' })
        // Invitations to this email became events of the account.
        void queryClient.invalidateQueries()
      })
      .catch((error: unknown) =>
        setOutcome({
          status: 'failed',
          message: isDomainError(error, 'LINK_EXPIRED')
            ? t('errors.LINK_EXPIRED')
            : describeError(t, error),
        }),
      )
  }, [accountEmail, queryClient, t, token])

  function resend() {
    if (!services) {
      return
    }
    setIsResending(true)
    services.session
      .resendVerification()
      .then(() =>
        showToast({ tone: 'success', message: t('email.notice.sent') }),
      )
      .catch((error: unknown) =>
        showToast({ tone: 'danger', message: describeError(t, error) }),
      )
      .finally(() => setIsResending(false))
  }

  const footer = signedIn ? (
    <p>
      <Link to="/events">{t('auth.verify.toEvents')}</Link>
    </p>
  ) : (
    <p>
      <Link to="/signin">{t('auth.signIn.action')}</Link>
    </p>
  )

  return (
    <AuthPage
      title={t('auth.verify.title')}
      subtitle={t('app.name')}
      footer={footer}
    >
      {outcome.status === 'checking' && (
        <LoadingState label={t('auth.verify.checking')} />
      )}
      {outcome.status === 'verified' && (
        <Notice tone="success" title={t('auth.verify.doneTitle')} announce>
          <p>{t('auth.verify.doneBody')}</p>
        </Notice>
      )}
      {outcome.status === 'failed' && (
        <>
          <Notice tone="danger" title={t('auth.verify.failedTitle')} announce>
            <p>{outcome.message}</p>
            <p>
              {t(
                signedIn ? 'auth.verify.resendHint' : 'auth.verify.signInHint',
              )}
            </p>
          </Notice>
          {signedIn && services && (
            <Button
              variant="secondary"
              fullWidth
              loading={isResending}
              onClick={resend}
            >
              {t('auth.verify.resend')}
            </Button>
          )}
        </>
      )}
    </AuthPage>
  )
}
