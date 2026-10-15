import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router'
import { useSession } from '../../app/session/sessionContext.ts'
import { PASSWORD_MIN_LENGTH, validateSignUp } from '../../domain/accounts.ts'
import { isDomainError } from '../../domain/errors.ts'
import { describeError } from '../../shared/errorMessage.ts'
import { Button } from '../../shared/ui/Button.tsx'
import { TextField } from '../../shared/ui/Field.tsx'
import { useEnterDemo } from '../landing/useEnterDemo.ts'
import { AuthPage, DemoLink } from './AuthPage.tsx'

type Field = 'name' | 'email' | 'password'
type FieldError = { field: Field; reason: 'invalid' | 'taken' }

export function SignUpPage() {
  const { t } = useTranslation()
  const { signUp } = useSession()
  const demo = useEnterDemo()
  const [params] = useSearchParams()
  const [name, setName] = useState('')
  // An invitation email links here with the invited address (D90).
  const [email, setEmail] = useState(() => params.get('email') ?? '')
  const [password, setPassword] = useState('')
  const [fieldError, setFieldError] = useState<FieldError | null>(null)
  const [failure, setFailure] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)

  function fail(error: unknown) {
    const field = isDomainError(error, 'VALIDATION')
      ? error.details.field
      : null
    if (field === 'name' || field === 'email' || field === 'password') {
      setFieldError({ field, reason: 'invalid' })
    } else if (isDomainError(error, 'EMAIL_TAKEN')) {
      setFieldError({ field: 'email', reason: 'taken' })
    } else {
      setFailure(describeError(t, error))
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setFieldError(null)
    setFailure(null)
    const input = { name, email, password }
    try {
      validateSignUp(input, [])
    } catch (error) {
      fail(error)
      return
    }
    setIsPending(true)
    // On success the route guard leaves this page for My Events.
    signUp(input).catch((error: unknown) => {
      setIsPending(false)
      fail(error)
    })
  }

  function errorFor(field: Field): string | undefined {
    if (fieldError?.field !== field) {
      return undefined
    }
    if (field === 'email') {
      return t(
        fieldError.reason === 'taken'
          ? 'errors.EMAIL_TAKEN'
          : 'auth.errors.email',
      )
    }
    return field === 'name'
      ? t('auth.errors.name')
      : t('auth.errors.passwordLength', { min: PASSWORD_MIN_LENGTH })
  }

  return (
    <AuthPage
      title={t('auth.signUp.title')}
      subtitle={t('auth.signUp.subtitle')}
      failure={failure}
      onSubmit={handleSubmit}
      footer={
        <>
          <p>
            {t('auth.signUp.haveAccount')}{' '}
            <Link to="/signin">{t('auth.signIn.action')}</Link>
          </p>
          <DemoLink onClick={demo.enter} />
        </>
      }
    >
      <TextField
        label={t('auth.fields.name')}
        autoComplete="name"
        required
        maxLength={80}
        value={name}
        error={errorFor('name')}
        onChange={(change) => setName(change.target.value)}
      />
      <TextField
        label={t('auth.fields.email')}
        type="email"
        autoComplete="email"
        required
        value={email}
        error={errorFor('email')}
        onChange={(change) => setEmail(change.target.value)}
      />
      <TextField
        label={t('auth.fields.password')}
        type="password"
        autoComplete="new-password"
        required
        value={password}
        hint={t('auth.fields.passwordHint', { min: PASSWORD_MIN_LENGTH })}
        error={errorFor('password')}
        onChange={(change) => setPassword(change.target.value)}
      />
      <Button type="submit" fullWidth loading={isPending}>
        {t('auth.signUp.action')}
      </Button>
    </AuthPage>
  )
}
