import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import type { AccessRow } from '../../domain/memberList.ts'
import type { EventRole } from '../../domain/roles.ts'
import { describeError } from '../../shared/errorMessage.ts'
import { Button } from '../../shared/ui/Button.tsx'
import { Dialog } from '../../shared/ui/Dialog.tsx'
import { SelectField } from '../../shared/ui/Field.tsx'
import { Notice } from '../../shared/ui/Notice.tsx'
import { useToast } from '../../shared/ui/toastContext.ts'
import formStyles from '../guests/Guests.module.css'
import { useChangeRole } from './permissionQueries.ts'

interface ChangeRoleDialogProps {
  open: boolean
  onClose: () => void
  eventId: string
  row: AccessRow | null
  /** The roles this user may give. */
  roles: readonly EventRole[]
}

function ChangeRoleForm({
  eventId,
  row,
  roles,
  onClose,
}: Omit<ChangeRoleDialogProps, 'open' | 'row'> & { row: AccessRow }) {
  const { t } = useTranslation()
  const { showToast } = useToast()
  const change = useChangeRole(eventId)
  const [role, setRole] = useState<EventRole>(row.role)
  const [failure, setFailure] = useState<string | null>(null)
  const who = row.name ?? row.email

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setFailure(null)
    if (role === row.role) {
      return onClose()
    }
    change.mutate(
      { target: row, role },
      {
        onSuccess: () => {
          showToast({
            tone: 'success',
            message: t('permissions.change.done', {
              name: who,
              role: t(`roles.${role}`),
            }),
          })
          onClose()
        },
        onError: (error) => setFailure(describeError(t, error)),
      },
    )
  }

  return (
    <form className={formStyles.form} noValidate onSubmit={handleSubmit}>
      {failure && <Notice tone="danger" title={failure} announce />}
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
        <Button type="submit" loading={change.isPending}>
          {t('permissions.change.submit')}
        </Button>
      </div>
    </form>
  )
}

/** Changes the role of a member or of a pending invitation. */
export function ChangeRoleDialog({
  open,
  onClose,
  row,
  ...rest
}: ChangeRoleDialogProps) {
  const { t } = useTranslation()

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('permissions.change.title', {
        name: row?.name ?? row?.email ?? '',
      })}
    >
      {row && <ChangeRoleForm row={row} onClose={onClose} {...rest} />}
    </Dialog>
  )
}
