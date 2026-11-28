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
import type { Guest } from '../../domain/models.ts'
import { useRemoveTable } from './tableQueries.ts'
import { VenueSeatedWarning } from './VenueSeatedWarning.tsx'

interface DeleteTableDialogProps {
  open: boolean
  onClose: () => void
  /** After the table was deleted. */
  onDeleted?: () => void
  eventId: string
  item: SeatedTable | null
  /** How many parties sit at the table. */
  parties: number
  /**
   * The venue's side of a venue event (mockup #20): the parties it would
   * unseat, and who is told.
   */
  venue?: { parties: readonly Guest[]; clientName: string | null } | null
}

/** Confirms deleting a table. Its guests stay, without a table. */
export function DeleteTableDialog({
  open,
  onClose,
  onDeleted,
  eventId,
  item,
  parties,
  venue = null,
}: DeleteTableDialogProps) {
  const { t } = useTranslation()
  const format = useFormatters()
  const { showToast } = useToast()
  const remove = useRemoveTable(eventId)
  const [failure, setFailure] = useState<string | null>(null)
  const [acknowledged, setAcknowledged] = useState(false)
  const [note, setNote] = useState('')
  // The venue unseating the client's guests needs a ticked box (D114).
  const venueWarning = venue !== null && venue.parties.length > 0
  const number = format.number(item?.table.number ?? 0)

  function close() {
    setFailure(null)
    setAcknowledged(false)
    setNote('')
    onClose()
  }

  function confirm() {
    if (!item) {
      return
    }
    setFailure(null)
    remove.mutate(
      {
        tableId: item.table.id,
        options: venueWarning
          ? { acknowledgeSeated: acknowledged, note }
          : undefined,
      },
      {
        onSuccess: () => {
          showToast({
            tone: 'success',
            message: venueWarning
              ? t('layout.venueWarning.delete.done', {
                  number,
                  parties: format.number(venue.parties.length),
                  people: format.number(item.assigned),
                  client: venue.clientName ?? t('venueDashboard.theClient'),
                })
              : t('layout.delete.done', { number }),
          })
          onDeleted?.()
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
      title={t('layout.delete.title', { number })}
      footer={
        <>
          <Button data-autofocus variant="ghost" onClick={close}>
            {t('common.cancel')}
          </Button>
          {venueWarning && !acknowledged && (
            <span className={formStyles.footerHint}>
              {t('layout.venueWarning.checkToDelete')}
            </span>
          )}
          <Button
            variant="danger"
            loading={remove.isPending}
            disabled={venueWarning && !acknowledged}
            onClick={confirm}
          >
            {t('layout.delete.confirm')}
          </Button>
        </>
      }
    >
      <div className={formStyles.form}>
        {failure && <Notice tone="danger" title={failure} announce />}
        {venueWarning && item ? (
          <VenueSeatedWarning
            kind="delete"
            tableNumber={item.table.number}
            parties={venue.parties}
            chairsAfter={0}
            clientName={venue.clientName}
            acknowledged={acknowledged}
            onAcknowledge={setAcknowledged}
            note={note}
            onNote={setNote}
          />
        ) : (
          <p>{t('layout.delete.body', { number })}</p>
        )}
        {!venueWarning && parties > 0 && (
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
