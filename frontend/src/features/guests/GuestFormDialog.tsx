import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { isDomainError } from '../../domain/errors.ts'
import { EVENT_LIMITS } from '../../domain/events.ts'
import { GROUP_MAX_LENGTH, type GuestInput } from '../../domain/guests.ts'
import type { Guest } from '../../domain/models.ts'
import type { TableWithOccupancy } from '../../services/contracts/index.ts'
import { describeError } from '../../shared/errorMessage.ts'
import { Button } from '../../shared/ui/Button.tsx'
import { Combobox } from '../../shared/ui/Combobox.tsx'
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
import { useTableOptions } from './TableOptions.tsx'

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
  const tableOptions = useTableOptions()
  const [firstName, setFirstName] = useState(guest?.firstName ?? '')
  const [lastName, setLastName] = useState(guest?.lastName ?? '')
  const [phone, setPhone] = useState(guest?.phone ?? '')
  const [allowed, setAllowed] = useState(
    String(guest?.allowedAttendees ?? defaultAllowedAttendees),
  )
  const [group, setGroup] = useState(guest?.group ?? '')
  const [tableId, setTableId] = useState(guest?.tableId ?? null)
  const [isSaving, setIsSaving] = useState(false)
  // A guest waiting for the organizer to confirm that its group is new.
  const [awaitingNewGroup, setAwaitingNewGroup] = useState<GuestInput | null>(
    null,
  )
  const [fieldError, setFieldError] = useState<FieldError | null>(null)
  const [failure, setFailure] = useState<string | null>(null)
  const limits = EVENT_LIMITS.allowedAttendees
  // An approved guest's allowance cannot drop below the attendees they
  // confirmed; the server refuses it too.
  const confirmed =
    guest?.rsvpStatus === 'APPROVED' ? (guest.confirmedAttendees ?? 0) : 0
  const lowest = Math.max(limits.min, confirmed)
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

  function handleSubmit(event: FormEvent) {
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
    if (allowedAttendees < confirmed) {
      return setFieldError({
        field: 'allowed',
        reason: 'belowConfirmed',
        count: confirmed,
      })
    }
    const input = { firstName, lastName, phone, allowedAttendees, group }
    const wanted = group.trim().toLocaleLowerCase()
    const isNewGroup =
      wanted !== '' &&
      !groups.some((existing) => existing.toLocaleLowerCase() === wanted)
    if (isNewGroup) {
      // A typo should not quietly become a group.
      setAwaitingNewGroup(input)
    } else {
      void save(input)
    }
  }

  async function save(input: GuestInput) {
    setAwaitingNewGroup(null)
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
    <form className={styles.form} noValidate onSubmit={handleSubmit}>
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
        min={lowest}
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
        <Combobox
          label={t('guests.form.group')}
          value={group}
          onChange={setGroup}
          options={groups}
          clearLabel={t('guests.filters.groupNone')}
          createLabel={(name) => t('guests.form.groupCreate', { name })}
          toggleLabel={t('guests.form.groupShow')}
          hint={t('guests.form.groupHint')}
          maxLength={GROUP_MAX_LENGTH}
          openUp
        />
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
          {tableOptions(tables, guest?.tableId ?? null)}
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
      <Dialog
        open={awaitingNewGroup !== null}
        onClose={() => setAwaitingNewGroup(null)}
        title={t('guests.form.newGroup.title')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setAwaitingNewGroup(null)}>
              {t('common.cancel')}
            </Button>
            <Button
              data-autofocus
              onClick={() => awaitingNewGroup && void save(awaitingNewGroup)}
            >
              {t('guests.form.newGroup.confirm')}
            </Button>
          </>
        }
      >
        <p>
          {t('guests.form.newGroup.body', {
            name: awaitingNewGroup?.group?.trim() ?? '',
          })}
        </p>
      </Dialog>
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
