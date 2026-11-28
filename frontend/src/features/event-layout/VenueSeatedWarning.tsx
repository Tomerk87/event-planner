import { Armchair, Bell, LayoutTemplate, Users } from 'lucide-react'
import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { guestFullName } from '../../domain/guestList.ts'
import type { Guest } from '../../domain/models.ts'
import { VENUE_NOTE_MAX_LENGTH } from '../../domain/venues.ts'
import { useFormatters } from '../../i18n/format.ts'
import { Avatar } from '../../shared/ui/Avatar.tsx'
import { Checkbox } from '../../shared/ui/Checkbox.tsx'
import { TextArea } from '../../shared/ui/Field.tsx'
import styles from './VenueSeatedWarning.module.css'

interface VenueSeatedWarningProps {
  /** Deleting the table, or giving it fewer chairs than people seated. */
  kind: 'delete' | 'shrink'
  tableNumber: number
  /** The client's parties seated at the table. */
  parties: readonly Guest[]
  /** Chairs after the change, for fewer chairs. */
  chairsAfter?: number
  /** The client lead's name; null before one joined. */
  clientName: string | null
  acknowledged: boolean
  onAcknowledge: (value: boolean) => void
  note: string
  onNote: (value: string) => void
}

/**
 * What the venue sees before it changes the room under the client's seated
 * guests (mockup #20, D114, D122): who is affected, what happens, and a box
 * to tick. The client is told on their side; an optional note goes with it.
 */
export function VenueSeatedWarning({
  kind,
  tableNumber,
  parties,
  chairsAfter = 0,
  clientName,
  acknowledged,
  onAcknowledge,
  note,
  onNote,
}: VenueSeatedWarningProps) {
  const { t } = useTranslation()
  const format = useFormatters()
  const listId = useId()
  const people = parties.reduce(
    (sum, guest) => sum + (guest.confirmedAttendees ?? 0),
    0,
  )
  const client = clientName ?? t('venueDashboard.theClient')
  const values = {
    number: format.number(tableNumber),
    parties: format.number(parties.length),
    people: format.number(people),
    count: parties.length,
    chairs: format.number(chairsAfter),
    over: format.number(Math.max(0, people - chairsAfter)),
    client,
  }

  return (
    <div className={styles.warning}>
      <div className={styles.summary} role="alert">
        <Users aria-hidden="true" />
        <div>
          <p className={styles.summaryTitle}>
            {t(`layout.venueWarning.${kind}.title`, values)}
          </p>
          <p>{t(`layout.venueWarning.${kind}.body`, values)}</p>
        </div>
      </div>

      <div>
        <h3 id={listId} className={styles.listTitle}>
          {t(`layout.venueWarning.${kind}.listTitle`)}
          <span className={styles.count}>{format.number(parties.length)}</span>
        </h3>
        <ul className={styles.parties} aria-labelledby={listId}>
          {parties.map((guest) => (
            <li key={guest.id}>
              <Avatar name={guestFullName(guest)} />
              <span className={styles.partyText}>
                <span className={styles.partyName}>{guestFullName(guest)}</span>
                {guest.group && (
                  <span className={styles.muted}>{guest.group}</span>
                )}
              </span>
              <span className={styles.muted}>
                {t('layout.venueWarning.people', {
                  count: guest.confirmedAttendees ?? 0,
                  formatted: format.number(guest.confirmedAttendees ?? 0),
                })}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <ul className={styles.facts}>
        <li>
          <Armchair aria-hidden="true" />
          {t(`layout.venueWarning.${kind}.chairs`, values)}
        </li>
        <li>
          <LayoutTemplate aria-hidden="true" />
          {t('layout.venueWarning.onlyThisEvent')}
        </li>
        <li>
          <Bell aria-hidden="true" />
          {t(`layout.venueWarning.${kind}.notified`, values)}
        </li>
      </ul>

      <TextArea
        label={t('layout.venueWarning.note')}
        hint={t('layout.venueWarning.noteHint', {
          max: VENUE_NOTE_MAX_LENGTH,
          client,
        })}
        maxLength={VENUE_NOTE_MAX_LENGTH}
        rows={2}
        value={note}
        onChange={(change) => onNote(change.target.value)}
      />

      <div className={styles.confirm}>
        <Checkbox
          checked={acknowledged}
          onChange={(change) => onAcknowledge(change.target.checked)}
          label={t(`layout.venueWarning.${kind}.confirm`, values)}
        />
        <p className={styles.confirmHint}>
          {t(`layout.venueWarning.${kind}.confirmHint`, values)}
        </p>
      </div>
    </div>
  )
}
