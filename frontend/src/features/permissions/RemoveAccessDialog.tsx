import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { AccessRow } from '../../domain/memberList.ts'
import { describeError } from '../../shared/errorMessage.ts'
import { Button } from '../../shared/ui/Button.tsx'
import { Dialog } from '../../shared/ui/Dialog.tsx'
import { Notice } from '../../shared/ui/Notice.tsx'
import { useToast } from '../../shared/ui/toastContext.ts'
import formStyles from '../guests/Guests.module.css'
import { useRemoveAccess } from './permissionQueries.ts'

interface RemoveAccessDialogProps {
  open: boolean
  onClose: () => void
  eventId: string
  row: AccessRow | null
}

/** Confirms removing a member, or cancelling a pending invitation. */
export function RemoveAccessDialog({
  open,
  onClose,
  eventId,
  row,
}: RemoveAccessDialogProps) {
  const { t } = useTranslation()
  const { showToast } = useToast()
  const remove = useRemoveAccess(eventId)
  const [failure, setFailure] = useState<string | null>(null)
  const kind = row?.kind ?? 'member'
  const name = row?.name ?? row?.email ?? ''

  function close() {
    setFailure(null)
    onClose()
  }

  function confirm() {
    if (!row) {
      return
    }
    setFailure(null)
    remove.mutate(row, {
      onSuccess: () => {
        showToast({
          tone: 'success',
          message: t(`permissions.remove.${kind}.done`, { name }),
        })
        close()
      },
      onError: (error) => setFailure(describeError(t, error)),
    })
  }

  return (
    <Dialog
      open={open}
      onClose={close}
      title={t(`permissions.remove.${kind}.title`)}
      footer={
        <>
          <Button data-autofocus variant="ghost" onClick={close}>
            {t('common.cancel')}
          </Button>
          <Button variant="danger" loading={remove.isPending} onClick={confirm}>
            {t(`permissions.remove.${kind}.confirm`)}
          </Button>
        </>
      }
    >
      <div className={formStyles.form}>
        {failure && <Notice tone="danger" title={failure} announce />}
        <p>{t(`permissions.remove.${kind}.body`, { name })}</p>
      </div>
    </Dialog>
  )
}
