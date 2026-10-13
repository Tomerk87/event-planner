import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { guestFullName } from '../../domain/guestList.ts'
import { guestDisplayStatus } from '../../domain/guestStatus.ts'
import type { Guest } from '../../domain/models.ts'
import { useFormatters } from '../../i18n/format.ts'
import { Button } from '../../shared/ui/Button.tsx'
import { Drawer } from '../../shared/ui/Dialog.tsx'
import { LtrText } from '../../shared/ui/LtrText.tsx'
import styles from './Guests.module.css'
import { GuestStatusBadge } from './GuestStatusBadge.tsx'

interface GuestDetailsDrawerProps {
  open: boolean
  onClose: () => void
  guest: Guest | null
  tableLabel: string | null
  canEdit: boolean
  onEdit: () => void
  onChangeRsvp: () => void
}

const NONE = '—'

export function GuestDetailsDrawer({
  open,
  onClose,
  guest,
  tableLabel,
  canEdit,
  onEdit,
  onChangeRsvp,
}: GuestDetailsDrawerProps) {
  const { t } = useTranslation()
  const format = useFormatters()
  const moment = (value: string | null) =>
    value === null
      ? t('guests.details.never')
      : t('dashboard.activity.onDate', {
          date: format.date(new Date(value)),
          time: format.time(new Date(value)),
        })

  const rows: [string, ReactNode][] = guest
    ? [
        [t('guests.columns.name'), guestFullName(guest)],
        [t('guests.columns.invitationName'), guest.invitationName ?? NONE],
        [
          t('guests.columns.phone'),
          <LtrText key="phone">{guest.phone}</LtrText>,
        ],
        [
          t('guests.columns.status'),
          <GuestStatusBadge key="status" status={guestDisplayStatus(guest)} />,
        ],
        [t('guests.columns.group'), guest.group ?? NONE],
        [t('guests.columns.allowed'), format.number(guest.allowedAttendees)],
        [
          t('guests.columns.confirmed'),
          guest.confirmedAttendees === null
            ? NONE
            : format.number(guest.confirmedAttendees),
        ],
        [t('guests.columns.sent'), format.number(guest.invitationSentCount)],
        [t('guests.details.lastSent'), moment(guest.lastInvitationSentAt)],
        [t('guests.details.lastResponse'), moment(guest.lastRsvpResponseAt)],
        [t('guests.columns.table'), tableLabel ?? t('guests.table.noTable')],
      ]
    : []

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={t('guests.details.title')}
      footer={
        canEdit && (
          <>
            <Button variant="secondary" onClick={onChangeRsvp}>
              {t('guests.row.changeRsvp')}
            </Button>
            <Button onClick={onEdit}>{t('guests.details.edit')}</Button>
          </>
        )
      }
    >
      <dl className={styles.details}>
        {rows.map(([label, value]) => (
          <div key={label} className={styles.detail}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </Drawer>
  )
}
