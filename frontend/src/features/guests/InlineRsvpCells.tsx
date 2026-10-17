import { useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { guestFullName } from '../../domain/guestList.ts'
import { guestDisplayStatus } from '../../domain/guestStatus.ts'
import {
  RSVP_STATUSES,
  type Guest,
  type RsvpStatus,
} from '../../domain/models.ts'
import { useFormatters } from '../../i18n/format.ts'
import { cx } from '../../shared/ui/cx.ts'
import fieldStyles from '../../shared/ui/Field.module.css'
import { Select } from '../../shared/ui/Select.tsx'
import { toInteger } from '../events/eventForm.ts'
import styles from './Guests.module.css'
import { GuestStatusBadge } from './GuestStatusBadge.tsx'

/** What a cell asks to save: the guest's new answer (D105). */
export type RsvpChange = { status: RsvpStatus; attendees: number | null }

/**
 * How editing starts: a double-click in the desktop table, a tap on a phone
 * card (touch screens have no double-click). Enter and F2 work in both.
 */
export type EditTrigger = 'doubleClick' | 'tap'

const NONE = '—'

/**
 * The choices read like the status badges (D105): no answer is "Not Sent"
 * for a guest who was never sent the invitation, and "Awaiting Response"
 * for one who was.
 */
function choiceLabel(guest: Guest, status: RsvpStatus) {
  if (status !== 'NO_RESPONSE') {
    return status
  }
  return guest.invitationSentCount === 0 ? 'NOT_SENT' : 'AWAITING'
}

/**
 * What starts editing a cell: a double-click (or a tap on a phone card), or
 * Enter or F2, as in a spreadsheet.
 */
function startHandlers(trigger: EditTrigger, start: () => void) {
  return {
    ...(trigger === 'tap' ? { onClick: start } : { onDoubleClick: start }),
    onKeyDown: (event: KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === 'F2') {
        event.preventDefault()
        start()
      }
    },
  }
}

/**
 * The guest's status in the table and on phone cards. An organizer who may
 * edit opens the product's dropdown, as the filters do, by a click or tap (or
 * Enter, Space or an arrow key) and chooses an RSVP answer; it saves at once,
 * and Escape or a click elsewhere closes it. It is the one place an answer
 * is changed by hand (D105).
 */
export function StatusCell({
  guest,
  canEdit,
  maxPerGuest,
  saving,
  onSave,
}: {
  guest: Guest
  canEdit: boolean
  maxPerGuest: number
  saving: boolean
  onSave: (change: RsvpChange) => void
}) {
  const { t } = useTranslation()
  const badge = <GuestStatusBadge status={guestDisplayStatus(guest)} />

  if (!canEdit) {
    return badge
  }

  function choose(status: RsvpStatus) {
    if (status === guest.rsvpStatus) {
      return
    }
    // Approving starts from the guest's Expected Attendees, within the
    // event's maximum (D104, D98).
    onSave({
      status,
      attendees:
        status === 'APPROVED'
          ? Math.min(guest.allowedAttendees, maxPerGuest) || 1
          : null,
    })
  }

  return (
    <Select
      className={styles.statusTrigger}
      aria-label={t('guests.inline.status', {
        name: guestFullName(guest),
        status: t(`guests.status.${guestDisplayStatus(guest)}`),
      })}
      value={guest.rsvpStatus}
      disabled={saving}
      options={RSVP_STATUSES.map((status) => ({
        value: status,
        label: t(`guests.status.${choiceLabel(guest, status)}`),
      }))}
      renderValue={() => badge}
      onChange={(status) => choose(status as RsvpStatus)}
    />
  )
}

/**
 * The confirmed count of an approved guest, changed by double-clicking (or
 * Enter or F2) and typing: Enter or leaving saves, Escape cancels. It must
 * be a whole number from 1 to the event's maximum per guest (D104).
 */
export function ConfirmedCell({
  guest,
  canEdit,
  maxPerGuest,
  saving,
  onSave,
  trigger = 'doubleClick',
}: {
  guest: Guest
  canEdit: boolean
  maxPerGuest: number
  saving: boolean
  onSave: (change: RsvpChange) => void
  trigger?: EditTrigger
}) {
  const { t } = useTranslation()
  const format = useFormatters()
  const [draft, setDraft] = useState<string | null>(null)
  const [invalid, setInvalid] = useState(false)
  const shown =
    guest.confirmedAttendees === null
      ? NONE
      : format.number(guest.confirmedAttendees)

  if (!canEdit || guest.rsvpStatus !== 'APPROVED') {
    return shown
  }
  const start = () => {
    setDraft(String(guest.confirmedAttendees ?? 1))
    setInvalid(false)
  }
  if (draft === null) {
    return (
      <button
        type="button"
        // A double-click to type in shows the text cursor; a tap, the hand.
        className={cx(
          styles.editableCell,
          trigger === 'doubleClick' && styles.typeToEdit,
        )}
        aria-label={t(
          trigger === 'tap'
            ? 'guests.inline.confirmedTap'
            : 'guests.inline.confirmed',
          { name: guestFullName(guest), count: shown },
        )}
        title={t(
          trigger === 'tap' ? 'guests.inline.hintTap' : 'guests.inline.hint',
        )}
        disabled={saving}
        {...startHandlers(trigger, start)}
      >
        {shown}
      </button>
    )
  }

  function commit() {
    const count = toInteger(draft ?? '')
    if (!Number.isInteger(count) || count < 1 || count > maxPerGuest) {
      setInvalid(true)
      return
    }
    setDraft(null)
    if (count !== guest.confirmedAttendees) {
      onSave({ status: 'APPROVED', attendees: count })
    }
  }

  const error = t('guests.inline.confirmedError', { max: maxPerGuest })
  return (
    <span className={styles.cellEditorWrap}>
      <input
        // Opened on purpose by the person, so it takes the focus.
        ref={(node) => {
          if (node && document.activeElement !== node) {
            node.focus()
            node.select()
          }
        }}
        type="number"
        inputMode="numeric"
        min={1}
        max={maxPerGuest}
        className={cx(fieldStyles.input, styles.cellEditor)}
        aria-label={t('guests.inline.confirmedEditor', {
          name: guestFullName(guest),
        })}
        aria-invalid={invalid ? true : undefined}
        title={invalid ? error : undefined}
        value={draft}
        onChange={(event) => {
          setDraft(event.target.value)
          // Editing clears the message (D104).
          setInvalid(false)
        }}
        onBlur={() => {
          // Leaving with an invalid value drops it rather than trapping focus.
          if (invalid) {
            setDraft(null)
          } else {
            commit()
          }
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            commit()
          } else if (event.key === 'Escape') {
            event.stopPropagation()
            setDraft(null)
          }
        }}
      />
      {invalid && (
        <span className={styles.cellError} role="alert">
          {error}
        </span>
      )}
    </span>
  )
}
