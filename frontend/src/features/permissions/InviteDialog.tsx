import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { isDomainError } from '../../domain/errors.ts'
import type { EventRole } from '../../domain/roles.ts'
import { useEmailEnabled } from '../../services/queries.ts'
import { describeError } from '../../shared/errorMessage.ts'
import { Button } from '../../shared/ui/Button.tsx'
import { Dialog } from '../../shared/ui/Dialog.tsx'
import { SelectField, TextField } from '../../shared/ui/Field.tsx'
import { ltr } from '../../shared/ltr.ts'
import { Notice } from '../../shared/ui/Notice.tsx'
import { useToast } from '../../shared/ui/toastContext.ts'
import formStyles from '../guests/Guests.module.css'
import { useInvite } from './permissionQueries.ts'

type EmailError = 'invalid' | 'member' | 'invited'

interface InviteDialogProps {
  open: boolean
  onClose: () => void
  eventId: string
  /** The roles this user may give. */
  roles: readonly EventRole[]
}

function InviteForm({
  eventId,
  roles,
  onClose,
}: Omit<InviteDialogProps, 'open'>) {
  const { t } = useTranslation()
  const { showToast } = useToast()
  const invite = useInvite(eventId)
  const emailEnabled = useEmailEnabled()
  const [email, setEmail] = useState('')
  // The least access is offered first; more is a deliberate choice.
  const [role, setRole] = useState<EventRole>(roles.at(-1) ?? 'VIEWER')
  const [emailError, setEmailError] = useState<EmailError | null>(null)
  const [failure, setFailure] = useState<string | null>(null)

  function fail(error: unknown) {
    if (isDomainError(error, 'VALIDATION') && error.details.field === 'email') {
      return setEmailError('invalid')
    }
    if (isDomainError(error, 'ALREADY_MEMBER')) {
      return setEmailError('member')
    }
    if (isDomainError(error, 'ALREADY_INVITED')) {
      return setEmailError('invited')
    }
    setFailure(describeError(t, error))
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setEmailError(null)
    setFailure(null)
    if (email.trim() === '') {
      return setEmailError('invalid')
    }
    invite.mutate(
      { email, role },
      {
        onSuccess: (result) => {
          showToast({
            tone: 'success',
            message:
              result.kind === 'member'
                ? t('permissions.invite.added', {
                    name: result.member.user.name,
                  })
                : t(
                    emailEnabled
                      ? 'permissions.invite.pendingSent'
                      : 'permissions.invite.pending',
                    { email: ltr(result.invitation.email) },
                  ),
          })
          onClose()
        },
        onError: fail,
      },
    )
  }

  return (
    <form className={formStyles.form} noValidate onSubmit={handleSubmit}>
      {failure && <Notice tone="danger" title={failure} announce />}
      <TextField
        label={t('permissions.invite.email')}
        type="email"
        inputMode="email"
        autoComplete="off"
        dir="ltr"
        required
        value={email}
        hint={t(
          emailEnabled
            ? 'permissions.invite.emailHintSending'
            : 'permissions.invite.emailHint',
        )}
        error={
          emailError ? t(`permissions.invite.errors.${emailError}`) : undefined
        }
        onChange={(event) => setEmail(event.target.value)}
      />
      <SelectField
        label={t('permissions.columns.role')}
        value={role}
        hint={t(`permissions.roleHints.${role}`)}
        onChange={(event) => setRole(event.target.value as EventRole)}
      >
        {roles.map((option) => (
          <option key={option} value={option}>
            {t(`roles.${option}`)}
          </option>
        ))}
      </SelectField>
      <div className={formStyles.formActions}>
        <Button variant="ghost" onClick={onClose}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" loading={invite.isPending}>
          {t('permissions.invite.submit')}
        </Button>
      </div>
    </form>
  )
}

/** Gives access by email: at once to an account, pending for anyone else. */
export function InviteDialog({ open, onClose, ...rest }: InviteDialogProps) {
  const { t } = useTranslation()

  return (
    <Dialog open={open} onClose={onClose} title={t('permissions.invite.title')}>
      <InviteForm onClose={onClose} {...rest} />
    </Dialog>
  )
}
