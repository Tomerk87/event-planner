import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
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
import { toInteger } from '../events/eventForm.ts'
import styles from './Guests.module.css'
import { GuestStatusBadge } from './GuestStatusBadge.tsx'

/** What a cell asks to save: the guest's new answer (D105). */
export type RsvpChange = { status: RsvpStatus; attendees: number | null }

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

/** Double-click, Enter or F2 on a cell starts editing it, as in a spreadsheet. */
function startKeys(event: KeyboardEvent, start: () => void) {
  if (event.key === 'Enter' || event.key === 'F2') {
    event.preventDefault()
    start()
  }
}

/**
 * The guest's status in the table. An organizer who may edit changes it by
 * double-clicking (or Enter or F2) and choosing an RSVP answer; it saves at
 * once, and Escape or leaving the choice cancels.
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
  const [editing, setEditing] = useState(false)
  const selectRef = useRef<HTMLSelectElement>(null)
  const badge = <GuestStatusBadge status={guestDisplayStatus(guest)} />

  useEffect(() => {
    if (!editing) {
      return
    }
    const select = selectRef.current
    select?.focus()
    // Opens the list at once where the browser allows it.
    try {
      select?.showPicker?.()
    } catch {
      // Needs a user gesture in some browsers; the focused field is enough.
    }
  }, [editing])

  if (!canEdit) {
    return badge
  }
  if (!editing) {
    return (
      <button
        type="button"
        className={styles.editableCell}
        aria-label={t('guests.inline.status', {
          name: guestFullName(guest),
          status: t(`guests.status.${guestDisplayStatus(guest)}`),
        })}
        title={t('guests.inline.hint')}
        disabled={saving}
        onDoubleClick={() => setEditing(true)}
        onKeyDown={(event) => startKeys(event, () => setEditing(true))}
      >
        {badge}
      </button>
    )
  }

  function choose(status: RsvpStatus) {
    setEditing(false)
    if (status === guest.rsvpStatus) {
      return
    }
    // Approving starts from the guest's Expected Attendees, within the
    // event's maximum, as in Change RSVP.
    onSave({
      status,
      attendees:
        status === 'APPROVED'
          ? Math.min(guest.allowedAttendees, maxPerGuest) || 1
          : null,
    })
  }

  return (
    <select
      ref={selectRef}
      className={cx(fieldStyles.input, styles.cellEditor)}
      aria-label={t('guests.inline.statusEditor', {
        name: guestFullName(guest),
      })}
      value={guest.rsvpStatus}
      onChange={(event) => choose(event.target.value as RsvpStatus)}
      onBlur={() => setEditing(false)}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          // Cancels the edit only, not a dialog around the table.
          event.stopPropagation()
          setEditing(false)
        }
      }}
    >
      {RSVP_STATUSES.map((status) => (
        <option key={status} value={status}>
          {t(`guests.status.${choiceLabel(guest, status)}`)}
        </option>
      ))}
    </select>
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
}: {
  guest: Guest
  canEdit: boolean
  maxPerGuest: number
  saving: boolean
  onSave: (change: RsvpChange) => void
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
        className={styles.editableCell}
        aria-label={t('guests.inline.confirmed', {
          name: guestFullName(guest),
          count: shown,
        })}
        title={t('guests.inline.hint')}
        disabled={saving}
        onDoubleClick={start}
        onKeyDown={(event) => startKeys(event, start)}
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
