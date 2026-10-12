import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import type { Event } from '../../domain/models.ts'
import { describeError } from '../../shared/errorMessage.ts'
import { Button } from '../../shared/ui/Button.tsx'
import { Dialog } from '../../shared/ui/Dialog.tsx'
import { TextField } from '../../shared/ui/Field.tsx'
import { Notice } from '../../shared/ui/Notice.tsx'
import { useToast } from '../../shared/ui/toastContext.ts'
import styles from './EventDialog.module.css'
import { useDeleteEvent } from './eventMutations.ts'

interface DeleteEventDialogProps {
  open: boolean
  onClose: () => void
  event: Event | null
}

function DeleteForm({ event, onClose }: { event: Event; onClose: () => void }) {
  const { t } = useTranslation()
  const { showToast } = useToast()
  const remove = useDeleteEvent(event.id)
  const [typed, setTyped] = useState('')
  const [failure, setFailure] = useState<string | null>(null)
  const matches = typed.trim() === event.name.trim()

  function handleSubmit(submit: FormEvent) {
    submit.preventDefault()
    if (!matches) {
      return
    }
    setFailure(null)
    remove.mutate(undefined, {
      onSuccess: () => {
        showToast({ tone: 'success', message: t('events.delete.done') })
        onClose()
      },
      onError: (error) => setFailure(describeError(t, error)),
    })
  }

  return (
    <form className={styles.form} noValidate onSubmit={handleSubmit}>
      <Notice
        tone="danger"
        title={t('events.delete.warningTitle', { name: event.name })}
      >
        {t('events.delete.warningBody')}
      </Notice>
      {failure && <Notice tone="danger" title={failure} announce />}
      <TextField
        label={t('events.delete.confirmLabel')}
        hint={t('events.delete.confirmHint', { name: event.name })}
        autoComplete="off"
        value={typed}
        onChange={(change) => setTyped(change.target.value)}
      />
      <div className={styles.actions}>
        <Button variant="ghost" onClick={onClose}>
          {t('common.cancel')}
        </Button>
        <Button
          type="submit"
          variant="danger"
          disabled={!matches}
          loading={remove.isPending}
        >
          {t('events.delete.submit')}
        </Button>
      </div>
    </form>
  )
}

/** Permanent deletion, confirmed by typing the event's name. */
export function DeleteEventDialog({
  open,
  onClose,
  event,
}: DeleteEventDialogProps) {
  const { t } = useTranslation()

  return (
    <Dialog open={open} onClose={onClose} title={t('events.delete.title')}>
      {event && <DeleteForm event={event} onClose={onClose} />}
    </Dialog>
  )
}
