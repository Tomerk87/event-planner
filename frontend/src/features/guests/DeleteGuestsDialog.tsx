import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { guestFullName } from '../../domain/guestList.ts'
import type { Guest } from '../../domain/models.ts'
import { useFormatters } from '../../i18n/format.ts'
import { describeError } from '../../shared/errorMessage.ts'
import { Button } from '../../shared/ui/Button.tsx'
import { Dialog } from '../../shared/ui/Dialog.tsx'
import { Notice } from '../../shared/ui/Notice.tsx'
import { useToast } from '../../shared/ui/toastContext.ts'
import styles from './Guests.module.css'
import { useRemoveGuests } from './guestQueries.ts'

interface DeleteGuestsDialogProps {
  open: boolean
  onClose: () => void
  /** Called after the guests were deleted, before the dialog closes. */
  onDeleted: () => void
  eventId: string
  guests: readonly Guest[]
}

/** Confirms deleting one guest or several. Deletion is a soft delete. */
export function DeleteGuestsDialog({
  open,
  onClose,
  onDeleted,
  eventId,
  guests,
}: DeleteGuestsDialogProps) {
  const { t } = useTranslation()
  const format = useFormatters()
  const { showToast } = useToast()
  const remove = useRemoveGuests(eventId)
  const [failure, setFailure] = useState<string | null>(null)
  const [only] = guests
  const single = guests.length === 1 && only !== undefined
  const count = format.number(guests.length)

  function close() {
    setFailure(null)
    onClose()
  }

  function confirm() {
    setFailure(null)
    remove.mutate(
      guests.map((guest) => guest.id),
      {
        onSuccess: () => {
          showToast({
            tone: 'success',
            message: single
              ? t('guests.delete.doneOne')
              : t('guests.delete.doneMany', { count }),
          })
          onDeleted()
          close()
        },
        onError: (error) => setFailure(describeError(t, error)),
      },
    )
  }

  return (
    <Dialog
      open={open}
      onClose={close}
      title={t(single ? 'guests.delete.titleOne' : 'guests.delete.titleMany')}
      footer={
        <>
          <Button variant="ghost" onClick={close}>
            {t('common.cancel')}
          </Button>
          <Button variant="danger" loading={remove.isPending} onClick={confirm}>
            {t('guests.delete.confirm')}
          </Button>
        </>
      }
    >
      <div className={styles.form}>
        {failure && <Notice tone="danger" title={failure} announce />}
        <p>
          {single
            ? t('guests.delete.bodyOne', { name: guestFullName(only) })
            : t('guests.delete.bodyMany', { count })}
        </p>
        <p>{t('guests.delete.note')}</p>
      </div>
    </Dialog>
  )
}
