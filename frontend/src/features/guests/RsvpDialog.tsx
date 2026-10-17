import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { guestFullName } from '../../domain/guestList.ts'
import {
  RSVP_STATUSES,
  type Guest,
  type RsvpStatus,
} from '../../domain/models.ts'
import { describeError } from '../../shared/errorMessage.ts'
import { Button } from '../../shared/ui/Button.tsx'
import { Dialog } from '../../shared/ui/Dialog.tsx'
import { TextField } from '../../shared/ui/Field.tsx'
import { Notice } from '../../shared/ui/Notice.tsx'
import { useToast } from '../../shared/ui/toastContext.ts'
import { toInteger } from '../events/eventForm.ts'
import styles from './Guests.module.css'
import { useSetGuestRsvp } from './guestQueries.ts'

interface RsvpDialogProps {
  open: boolean
  onClose: () => void
  eventId: string
  guest: Guest | null
  /** The event's Maximum Attendees per Guest, which limits the answer (D104). */
  maxPerGuest: number
  /** Number of the table the guest is seated at, if any. */
  tableNumber: number | null
}

function RsvpForm({
  eventId,
  guest,
  maxPerGuest,
  tableNumber,
  onClose,
}: {
  eventId: string
  guest: Guest
  maxPerGuest: number
  tableNumber: number | null
  onClose: () => void
}) {
  const { t } = useTranslation()
  const { showToast } = useToast()
  const setRsvp = useSetGuestRsvp(eventId)
  const [status, setStatus] = useState<RsvpStatus>(guest.rsvpStatus)
  // An approved guest keeps their count; otherwise approving starts from
  // the guest's Expected Attendees, within the event's maximum.
  const [attendees, setAttendees] = useState(
    String(
      (guest.rsvpStatus === 'APPROVED' && guest.confirmedAttendees) ||
        Math.min(guest.allowedAttendees, maxPerGuest) ||
        1,
    ),
  )
  const [attendeesInvalid, setAttendeesInvalid] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setFailure(null)
    const count = toInteger(attendees)
    if (
      status === 'APPROVED' &&
      (!Number.isInteger(count) || count < 1 || count > maxPerGuest)
    ) {
      return setAttendeesInvalid(true)
    }
    setAttendeesInvalid(false)
    setRsvp.mutate(
      {
        guestId: guest.id,
        input: { status, attendees: status === 'APPROVED' ? count : null },
      },
      {
        onSuccess: () => {
          showToast({ tone: 'success', message: t('guests.rsvpDialog.saved') })
          onClose()
        },
        onError: (error) => setFailure(describeError(t, error)),
      },
    )
  }

  return (
    <form className={styles.form} noValidate onSubmit={handleSubmit}>
      {failure && <Notice tone="danger" title={failure} announce />}
      <fieldset className={styles.choices}>
        <legend className={styles.legend}>
          {t('guests.rsvpDialog.for', { name: guestFullName(guest) })}
        </legend>
        {RSVP_STATUSES.map((option) => (
          <label key={option} className={styles.choice}>
            <input
              type="radio"
              name="rsvp-status"
              value={option}
              checked={status === option}
              onChange={() => setStatus(option)}
            />
            {t(`guests.rsvp.${option}`)}
          </label>
        ))}
      </fieldset>
      {status === 'APPROVED' && (
        <TextField
          label={t('guests.rsvpDialog.attendees')}
          type="number"
          inputMode="numeric"
          required
          min={1}
          max={maxPerGuest}
          value={attendees}
          hint={t('guests.rsvpDialog.attendeesHint', { max: maxPerGuest })}
          error={
            attendeesInvalid
              ? t('guests.rsvpDialog.attendeesError', { max: maxPerGuest })
              : undefined
          }
          onChange={(event) => {
            setAttendees(event.target.value)
            // Editing clears the message (D104); Save checks again.
            setAttendeesInvalid(false)
          }}
        />
      )}
      {status !== 'APPROVED' && tableNumber !== null && (
        <Notice
          tone="warning"
          title={t('guests.rsvpDialog.tableNotice', { number: tableNumber })}
        />
      )}
      <div className={styles.formActions}>
        <Button variant="ghost" onClick={onClose}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" loading={setRsvp.isPending}>
          {t('guests.rsvpDialog.save')}
        </Button>
      </div>
    </form>
  )
}

/** The organizer's manual RSVP edit; the same rules as the public form apply. */
export function RsvpDialog({
  open,
  onClose,
  eventId,
  guest,
  maxPerGuest,
  tableNumber,
}: RsvpDialogProps) {
  const { t } = useTranslation()

  return (
    <Dialog open={open} onClose={onClose} title={t('guests.rsvpDialog.title')}>
      {guest && (
        <RsvpForm
          eventId={eventId}
          guest={guest}
          maxPerGuest={maxPerGuest}
          tableNumber={tableNumber}
          onClose={onClose}
        />
      )}
    </Dialog>
  )
}
