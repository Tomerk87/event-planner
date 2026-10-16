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
  /** After every table was deleted. */
  onDeleted?: () => void
  eventId: string
  /** One table, or the selected tables. */
  items: readonly SeatedTable[]
  /** How many parties sit at these tables. */
  parties: number
}

/** Confirms deleting tables. Their guests stay, without a table. */
export function DeleteTableDialog({
  open,
  onClose,
  onDeleted,
  eventId,
  items,
  parties,
}: DeleteTableDialogProps) {
  const { t } = useTranslation()
  const format = useFormatters()
  const { showToast } = useToast()
  const remove = useRemoveTable(eventId)
  const [failure, setFailure] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [first] = items
  const number = format.number(first?.table.number ?? 0)
  const count = format.number(items.length)
  const single = items.length === 1
  const attendees = items.reduce((sum, item) => sum + item.assigned, 0)

  function close() {
    setFailure(null)
    onClose()
  }

  async function confirm() {
    if (items.length === 0) {
      return
    }
    setFailure(null)
    setPending(true)
    try {
      // One at a time, so a failure leaves the rest as they were.
      for (const item of items) {
        await remove.mutateAsync(item.table.id)
      }
      showToast({
        tone: 'success',
        message: single
          ? t('layout.delete.done', { number })
          : t('layout.delete.doneMany', { count }),
      })
      onDeleted?.()
      close()
    } catch (error) {
      setFailure(describeError(t, error))
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={close}
      title={
        single
          ? t('layout.delete.title', { number })
          : t('layout.delete.titleMany', { count })
      }
      footer={
        <>
          <Button data-autofocus variant="ghost" onClick={close}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="danger"
            loading={pending}
            onClick={() => void confirm()}
          >
            {single
              ? t('layout.delete.confirm')
              : t('layout.delete.confirmMany', { count })}
          </Button>
        </>
      }
    >
      <div className={formStyles.form}>
        {failure && <Notice tone="danger" title={failure} announce />}
        <p>
          {single
            ? t('layout.delete.body', { number })
            : t('layout.delete.bodyMany', {
                count,
                numbers: format.list(
                  items.map((item) => format.number(item.table.number)),
                ),
              })}
        </p>
        {parties > 0 && (
          <p>
            {t(single ? 'layout.delete.seated' : 'layout.delete.seatedMany', {
              parties: format.number(parties),
              attendees: format.number(attendees),
            })}
          </p>
        )}
      </div>
    </Dialog>
  )
}
