import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Navigate } from 'react-router'
import { useSession } from '../../app/session/sessionContext.ts'
import { assertEmail } from '../../domain/accounts.ts'
import { isDomainError } from '../../domain/errors.ts'
import { useServerFeatures } from '../../services/queries.ts'
import { describeError } from '../../shared/errorMessage.ts'
import { Button } from '../../shared/ui/Button.tsx'
import { TextField } from '../../shared/ui/Field.tsx'
import { ltr } from '../../shared/ltr.ts'
import { Notice } from '../../shared/ui/Notice.tsx'
import { LoadingState } from '../../shared/ui/States.tsx'
import { AuthPage } from './AuthPage.tsx'

/**
 * Asks for a password-reset link (D88). The answer is the same whether or
 * not the email has an account. Only while the server sends email.
 */
export function ForgotPasswordPage() {
  const { t } = useTranslation()
  const { accountEmail } = useSession()
  const features = useServerFeatures()
  const [email, setEmail] = useState('')
  const [invalid, setInvalid] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)

  if (features.isPending) {
    return <LoadingState />
  }
  if (!features.data?.email) {
    return <Navigate to="/signin" replace />
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setInvalid(false)
    setFailure(null)
    let address: string
    try {
      address = assertEmail(email)
    } catch {
      setInvalid(true)
      return
    }
    setIsPending(true)
    accountEmail
      .forgotPassword(address)
      .then(() => setSentTo(address))
      .catch((error: unknown) => {
        if (isDomainError(error, 'VALIDATION')) {
          setInvalid(true)
        } else {
          setFailure(describeError(t, error))
        }
      })
      .finally(() => setIsPending(false))
  }

  const footer = (
    <p>
      <Link to="/signin">{t('auth.backToSignIn')}</Link>
    </p>
  )

  if (sentTo) {
    return (
      <AuthPage
        title={t('auth.forgot.title')}
        subtitle={t('auth.forgot.subtitle')}
        footer={footer}
      >
        <Notice tone="success" title={t('auth.forgot.sentTitle')} announce>
          <p>{t('auth.forgot.sentBody', { email: ltr(sentTo) })}</p>
        </Notice>
      </AuthPage>
    )
  }

  return (
    <AuthPage
      title={t('auth.forgot.title')}
      subtitle={t('auth.forgot.subtitle')}
      failure={failure}
      onSubmit={handleSubmit}
      footer={footer}
    >
      <TextField
        label={t('auth.fields.email')}
        type="email"
        autoComplete="email"
        required
        value={email}
        error={invalid ? t('auth.errors.email') : undefined}
        onChange={(change) => {
          setEmail(change.target.value)
          setInvalid(false)
        }}
      />
      <Button type="submit" fullWidth loading={isPending}>
        {t('auth.forgot.action')}
      </Button>
    </AuthPage>
  )
}
