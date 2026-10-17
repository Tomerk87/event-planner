import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { useSession } from '../../app/session/sessionContext.ts'
import {
  PASSWORD_MIN_LENGTH,
  validateNewPassword,
} from '../../domain/accounts.ts'
import { isDomainError } from '../../domain/errors.ts'
import { describeError } from '../../shared/errorMessage.ts'
import { Button } from '../../shared/ui/Button.tsx'
import { TextField } from '../../shared/ui/Field.tsx'
import { Notice } from '../../shared/ui/Notice.tsx'
import { AuthPage } from './AuthPage.tsx'

/** Where Sign In says the password was changed. */
export interface SignInState {
  passwordChanged?: boolean
}

/**
 * Opened from the reset email (D88). A new password ends every session of
 * the account, this browser's included, so it continues to Sign In.
 */
export function ResetPasswordPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const { session, accountEmail, signOut } = useSession()
  const [password, setPassword] = useState('')
  const [invalid, setInvalid] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const [expired, setExpired] = useState(false)
  const [isPending, setIsPending] = useState(false)

  const footer = (
    <p>
      <Link to="/signin">{t('auth.backToSignIn')}</Link>
    </p>
  )

  if (!token || expired) {
    return (
      <AuthPage
        title={t('auth.reset.title')}
        subtitle={t('auth.reset.subtitle')}
        footer={footer}
      >
        <Notice
          tone="danger"
          title={t(expired ? 'errors.LINK_EXPIRED' : 'auth.reset.missing')}
          announce
        />
        <Link to="/forgot-password">{t('auth.reset.newLink')}</Link>
      </AuthPage>
    )
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setInvalid(false)
    setFailure(null)
    try {
      validateNewPassword(password)
    } catch {
      setInvalid(true)
      return
    }
    setIsPending(true)
    accountEmail
      .resetPassword(token, password)
      .then(async () => {
        if (session?.workspace === 'account') {
          // The server has already ended the session; this forgets it here.
          await signOut().catch(() => undefined)
        }
        const state: SignInState = { passwordChanged: true }
        void navigate('/signin', { replace: true, state })
      })
      .catch((error: unknown) => {
        setIsPending(false)
        if (isDomainError(error, 'LINK_EXPIRED')) {
          setExpired(true)
        } else if (isDomainError(error, 'VALIDATION')) {
          setInvalid(true)
        } else {
          setFailure(describeError(t, error))
        }
      })
  }

  return (
    <AuthPage
      title={t('auth.reset.title')}
      subtitle={t('auth.reset.subtitle')}
      failure={failure}
      onSubmit={handleSubmit}
      footer={footer}
    >
      <TextField
        label={t('auth.reset.field')}
        type="password"
        autoComplete="new-password"
        required
        value={password}
        hint={t('auth.fields.passwordHint', { min: PASSWORD_MIN_LENGTH })}
        error={
          invalid
            ? t('auth.errors.passwordLength', { min: PASSWORD_MIN_LENGTH })
            : undefined
        }
        onChange={(change) => {
          setPassword(change.target.value)
          setInvalid(false)
        }}
      />
      <Button type="submit" fullWidth loading={isPending}>
        {t('auth.reset.action')}
      </Button>
    </AuthPage>
  )
}
