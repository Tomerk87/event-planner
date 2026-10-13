import { useId, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { isDomainError } from '../../domain/errors.ts'
import { EVENT_LIMITS } from '../../domain/events.ts'
import { GROUP_MAX_LENGTH } from '../../domain/guests.ts'
import type { Guest } from '../../domain/models.ts'
import type { TableWithOccupancy } from '../../services/contracts/index.ts'
import { describeError } from '../../shared/errorMessage.ts'
import { Button } from '../../shared/ui/Button.tsx'
import { Dialog } from '../../shared/ui/Dialog.tsx'
import { SelectField, TextField } from '../../shared/ui/Field.tsx'
import { Notice } from '../../shared/ui/Notice.tsx'
import { useToast } from '../../shared/ui/toastContext.ts'
import { toInteger } from '../events/eventForm.ts'
import styles from './Guests.module.css'
import {
  useAssignTable,
  useCreateGuest,
  useUpdateGuest,
} from './guestQueries.ts'
import { TableOptions } from './TableOptions.tsx'

const NO_TABLE = 'NONE'

type FieldError =
  | { field: 'firstName' }
  | { field: 'phone'; reason: 'invalid' | 'duplicate' }
  | { field: 'allowed'; reason: 'range' | 'belowConfirmed'; count?: number }

interface GuestFormDialogProps {
  open: boolean
  onClose: () => void
  eventId: string
  defaultAllowedAttendees: number
  /** The groups already used in the event, offered as suggestions. */
  groups: readonly string[]
  tables: readonly TableWithOccupancy[]
  /** The guest being edited; leave out to add a new one. */
  guest?: Guest | null
}

function GuestForm({
  eventId,
  defaultAllowedAttendees,
  groups,
  tables,
  guest,
  onClose,
}: Omit<GuestFormDialogProps, 'open'>) {
  const { t } = useTranslation()
  const { showToast } = useToast()
  const create = useCreateGuest(eventId)
  const update = useUpdateGuest(eventId)
  const assignTable = useAssignTable(eventId)
  const groupListId = useId()
  const [firstName, setFirstName] = useState(guest?.firstName ?? '')
  const [lastName, setLastName] = useState(guest?.lastName ?? '')
  const [phone, setPhone] = useState(guest?.phone ?? '')
  const [allowed, setAllowed] = useState(
    String(guest?.allowedAttendees ?? defaultAllowedAttendees),
  )
  const [group, setGroup] = useState(guest?.group ?? '')
  const [tableId, setTableId] = useState(guest?.tableId ?? null)
  const [isSaving, setIsSaving] = useState(false)
  const [fieldError, setFieldError] = useState<FieldError | null>(null)
  const [failure, setFailure] = useState<string | null>(null)
  const limits = EVENT_LIMITS.allowedAttendees
  // Only a guest who approved can be seated, so a new guest never can.
  const canSeat = guest?.rsvpStatus === 'APPROVED'

  function fail(error: unknown) {
    if (isDomainError(error, 'VALIDATION')) {
      if (error.details.field === 'firstName') {
        return setFieldError({ field: 'firstName' })
      }
      if (error.details.field === 'allowedAttendees') {
        return setFieldError({ field: 'allowed', reason: 'range' })
      }
    }
    if (isDomainError(error, 'INVALID_PHONE')) {
      return setFieldError({ field: 'phone', reason: 'invalid' })
    }
    if (isDomainError(error, 'DUPLICATE_PHONE')) {
      return setFieldError({ field: 'phone', reason: 'duplicate' })
    }
    if (isDomainError(error, 'INVALID_ATTENDEE_COUNT')) {
      return setFieldError({
        field: 'allowed',
        reason: 'belowConfirmed',
        count: Number(error.details.min),
      })
    }
    setFailure(describeError(t, error))
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setFieldError(null)
    setFailure(null)
    const allowedAttendees = toInteger(allowed)
    if (firstName.trim() === '') {
      return setFieldError({ field: 'firstName' })
    }
    if (phone.trim() === '') {
      return setFieldError({ field: 'phone', reason: 'invalid' })
    }
    if (
      !Number.isInteger(allowedAttendees) ||
      allowedAttendees < limits.min ||
      allowedAttendees > limits.max
    ) {
      return setFieldError({ field: 'allowed', reason: 'range' })
    }
    const input = { firstName, lastName, phone, allowedAttendees, group }
    setIsSaving(true)
    try {
      if (guest) {
        await update.mutateAsync({ guestId: guest.id, input })
        // Seating goes through its own rules: capacity, and Approved only.
        if (canSeat && tableId !== guest.tableId) {
          await assignTable.mutateAsync({ guestId: guest.id, tableId })
        }
      } else {
        await create.mutateAsync(input)
      }
      showToast({
        tone: 'success',
        message: t(guest ? 'guests.form.saved' : 'guests.form.added'),
      })
      onClose()
    } catch (error) {
      fail(error)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <form
      className={styles.form}
      noValidate
      onSubmit={(event) => void handleSubmit(event)}
    >
      {failure && <Notice tone="danger" title={failure} announce />}
      <div className={styles.formRow}>
        <TextField
          label={t('guests.form.firstName')}
          required
          maxLength={60}
          autoComplete="off"
          value={firstName}
          error={
            fieldError?.field === 'firstName'
              ? t('guests.form.errors.firstName')
              : undefined
          }
          onChange={(event) => setFirstName(event.target.value)}
        />
        <TextField
          label={t('guests.form.lastName')}
          maxLength={60}
          autoComplete="off"
          value={lastName}
          onChange={(event) => setLastName(event.target.value)}
        />
      </div>
      <TextField
        label={t('guests.form.phone')}
        type="tel"
        dir="ltr"
        required
        maxLength={24}
        autoComplete="off"
        value={phone}
        hint={t('guests.form.phoneHint')}
        error={
          fieldError?.field === 'phone'
            ? t(
                fieldError.reason === 'duplicate'
                  ? 'guests.form.errors.duplicate'
                  : 'guests.form.errors.phone',
              )
            : undefined
        }
        onChange={(event) => setPhone(event.target.value)}
      />
      <TextField
        label={t('guests.form.allowed')}
        type="number"
        inputMode="numeric"
        required
        min={limits.min}
        max={limits.max}
        value={allowed}
        hint={t('guests.form.allowedHint', limits)}
        error={
          fieldError?.field === 'allowed'
            ? fieldError.reason === 'belowConfirmed'
              ? t('guests.form.errors.belowConfirmed', {
                  count: fieldError.count,
                })
              : t('guests.form.errors.allowed', limits)
            : undefined
        }
        onChange={(event) => setAllowed(event.target.value)}
      />
      <div className={styles.formRow}>
        <div>
          <TextField
            label={t('guests.form.group')}
            maxLength={GROUP_MAX_LENGTH}
            autoComplete="off"
            list={groupListId}
            value={group}
            hint={t('guests.form.groupHint')}
            onChange={(event) => setGroup(event.target.value)}
          />
          <datalist id={groupListId}>
            {groups.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
        </div>
        <SelectField
          label={t('guests.form.table')}
          disabled={!canSeat}
          value={canSeat ? (tableId ?? NO_TABLE) : NO_TABLE}
          hint={canSeat ? undefined : t('guests.form.tableHint')}
          onChange={(event) =>
            setTableId(
              event.target.value === NO_TABLE ? null : event.target.value,
            )
          }
        >
          <option value={NO_TABLE}>{t('guests.table.noTable')}</option>
          <TableOptions tables={tables} ownTableId={guest?.tableId ?? null} />
        </SelectField>
      </div>
      <div className={styles.formActions}>
        <Button variant="ghost" onClick={onClose}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" loading={isSaving}>
          {t(guest ? 'guests.form.save' : 'guests.form.add')}
        </Button>
      </div>
    </form>
  )
}

export function GuestFormDialog({
  open,
  onClose,
  guest,
  ...rest
}: GuestFormDialogProps) {
  const { t } = useTranslation()

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t(guest ? 'guests.form.editTitle' : 'guests.form.addTitle')}
    >
      <GuestForm guest={guest} onClose={onClose} {...rest} />
    </Dialog>
  )
}
