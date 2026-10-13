import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { useSession } from '../../app/session/sessionContext.ts'
import { validateSignIn } from '../../domain/accounts.ts'
import { isDomainError } from '../../domain/errors.ts'
import { describeError } from '../../shared/errorMessage.ts'
import { Button } from '../../shared/ui/Button.tsx'
import { TextField } from '../../shared/ui/Field.tsx'
import { useEnterDemo } from '../landing/useEnterDemo.ts'
import { AuthPage, DemoLink } from './AuthPage.tsx'

type Field = 'email' | 'password'

export function SignInPage() {
  const { t } = useTranslation()
  const { signIn } = useSession()
  const demo = useEnterDemo()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fieldError, setFieldError] = useState<Field | null>(null)
  const [failure, setFailure] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)

  function fail(error: unknown) {
    const field = isDomainError(error, 'VALIDATION')
      ? error.details.field
      : null
    if (field === 'email' || field === 'password') {
      setFieldError(field)
    } else {
      setFailure(describeError(t, error))
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setFieldError(null)
    setFailure(null)
    const input = { email, password }
    try {
      validateSignIn(input)
    } catch (error) {
      fail(error)
      return
    }
    setIsPending(true)
    // On success the route guard leaves this page for My Events.
    signIn(input).catch((error: unknown) => {
      setIsPending(false)
      fail(error)
    })
  }

  return (
    <AuthPage
      title={t('auth.signIn.title')}
      subtitle={t('auth.signIn.subtitle')}
      failure={failure}
      onSubmit={handleSubmit}
      footer={
        <>
          <p>
            {t('auth.signIn.noAccount')}{' '}
            <Link to="/signup">{t('auth.signUp.action')}</Link>
          </p>
          <DemoLink onClick={demo.enter} />
        </>
      }
    >
      <TextField
        label={t('auth.fields.email')}
        type="email"
        autoComplete="email"
        required
        value={email}
        error={fieldError === 'email' ? t('auth.errors.email') : undefined}
        onChange={(change) => setEmail(change.target.value)}
      />
      <TextField
        label={t('auth.fields.password')}
        type="password"
        autoComplete="current-password"
        required
        value={password}
        error={
          fieldError === 'password'
            ? t('auth.errors.passwordRequired')
            : undefined
        }
        onChange={(change) => setPassword(change.target.value)}
      />
      <Button type="submit" fullWidth loading={isPending}>
        {t('auth.signIn.action')}
      </Button>
    </AuthPage>
  )
}
