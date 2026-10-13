import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { SeatedTable } from '../../domain/tableList.ts'
import { useFormatters } from '../../i18n/format.ts'
import { describeError } from '../../shared/errorMessage.ts'
import { Button } from '../../shared/ui/Button.tsx'
import { Dialog } from '../../shared/ui/Dialog.tsx'
import { Notice } from '../../shared/ui/Notice.tsx'
import { useToast } from '../../shared/ui/toastContext.ts'
import formStyles from '../guests/Guests.module.css'
import { useRemoveTable } from './tableQueries.ts'

interface DeleteTableDialogProps {
  open: boolean
  onClose: () => void
  eventId: string
  item: SeatedTable | null
  /** How many parties sit at the table. */
  parties: number
}

/** Confirms deleting a table. Its guests stay, without a table. */
export function DeleteTableDialog({
  open,
  onClose,
  eventId,
  item,
  parties,
}: DeleteTableDialogProps) {
  const { t } = useTranslation()
  const format = useFormatters()
  const { showToast } = useToast()
  const remove = useRemoveTable(eventId)
  const [failure, setFailure] = useState<string | null>(null)
  const number = format.number(item?.table.number ?? 0)

  function close() {
    setFailure(null)
    onClose()
  }

  function confirm() {
    if (!item) {
      return
    }
    setFailure(null)
    remove.mutate(item.table.id, {
      onSuccess: () => {
        showToast({
          tone: 'success',
          message: t('layout.delete.done', { number }),
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
      title={t('layout.delete.title', { number })}
      footer={
        <>
          <Button variant="ghost" onClick={close}>
            {t('common.cancel')}
          </Button>
          <Button variant="danger" loading={remove.isPending} onClick={confirm}>
            {t('layout.delete.confirm')}
          </Button>
        </>
      }
    >
      <div className={formStyles.form}>
        {failure && <Notice tone="danger" title={failure} announce />}
        <p>{t('layout.delete.body', { number })}</p>
        {parties > 0 && (
          <p>
            {t('layout.delete.seated', {
              parties: format.number(parties),
              attendees: format.number(item?.assigned ?? 0),
            })}
          </p>
        )}
      </div>
    </Dialog>
  )
}
