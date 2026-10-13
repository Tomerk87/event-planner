import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { GROUP_MAX_LENGTH } from '../../domain/guests.ts'
import type { Guest } from '../../domain/models.ts'
import { useFormatters } from '../../i18n/format.ts'
import { describeError } from '../../shared/errorMessage.ts'
import { Button } from '../../shared/ui/Button.tsx'
import { Combobox } from '../../shared/ui/Combobox.tsx'
import { Dialog } from '../../shared/ui/Dialog.tsx'
import { Notice } from '../../shared/ui/Notice.tsx'
import { useToast } from '../../shared/ui/toastContext.ts'
import styles from './Guests.module.css'
import { useSetGuestsGroup } from './guestQueries.ts'

interface GroupDialogProps {
  open: boolean
  onClose: () => void
  /** Called after the guests were moved, before the dialog closes. */
  onSaved: () => void
  eventId: string
  guests: readonly Guest[]
  /** The groups already used in the event. */
  groups: readonly string[]
}

function GroupForm({
  onClose,
  onSaved,
  eventId,
  guests,
  groups,
}: Omit<GroupDialogProps, 'open'>) {
  const { t } = useTranslation()
  const format = useFormatters()
  const { showToast } = useToast()
  const setGuestsGroup = useSetGuestsGroup(eventId)
  const [group, setGroup] = useState('')
  const [confirmingNew, setConfirmingNew] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const name = group.trim()
  const count = format.number(guests.length)
  const moving = guests.filter((guest) => guest.group !== null).length

  function save() {
    setConfirmingNew(false)
    setFailure(null)
    setGuestsGroup.mutate(
      { guestIds: guests.map((guest) => guest.id), group: name || null },
      {
        onSuccess: () => {
          showToast({
            tone: 'success',
            message: name
              ? t('guests.bulk.group.done', { count, name })
              : t('guests.bulk.group.cleared', { count }),
          })
          onSaved()
          onClose()
        },
        onError: (error) => setFailure(describeError(t, error)),
      },
    )
  }

  function submit() {
    const wanted = name.toLocaleLowerCase()
    const isNew =
      wanted !== '' &&
      !groups.some((existing) => existing.toLocaleLowerCase() === wanted)
    if (isNew) {
      // A typo should not quietly become a group.
      setConfirmingNew(true)
    } else {
      save()
    }
  }

  return (
    <div className={styles.form}>
      {failure && <Notice tone="danger" title={failure} announce />}
      <p>{t('guests.bulk.group.body', { count })}</p>
      <Combobox
        label={t('guests.form.group')}
        value={group}
        onChange={setGroup}
        options={groups}
        clearLabel={t('guests.filters.groupNone')}
        createLabel={(created) =>
          t('guests.form.groupCreate', { name: created })
        }
        toggleLabel={t('guests.form.groupShow')}
        hint={t('guests.bulk.group.hint')}
        maxLength={GROUP_MAX_LENGTH}
      />
      {moving > 0 && (
        <Notice
          tone="warning"
          title={t('guests.bulk.group.moving', {
            count: format.number(moving),
          })}
        />
      )}
      <div className={styles.formActions}>
        <Button variant="ghost" onClick={onClose}>
          {t('common.cancel')}
        </Button>
        <Button loading={setGuestsGroup.isPending} onClick={submit}>
          {t(name ? 'guests.bulk.group.save' : 'guests.bulk.group.remove')}
        </Button>
      </div>
      <Dialog
        open={confirmingNew}
        onClose={() => setConfirmingNew(false)}
        title={t('guests.form.newGroup.title')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmingNew(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={save}>{t('guests.form.newGroup.confirm')}</Button>
          </>
        }
      >
        <p>{t('guests.bulk.group.newBody', { name, count })}</p>
      </Dialog>
    </div>
  )
}

/** Moves the selected guests to one group, or takes them out of their groups. */
export function GroupDialog({ open, onClose, ...rest }: GroupDialogProps) {
  const { t } = useTranslation()

  return (
    <Dialog open={open} onClose={onClose} title={t('guests.bulk.group.title')}>
      {open && <GroupForm onClose={onClose} {...rest} />}
    </Dialog>
  )
}
