import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { isDomainError } from '../../domain/errors.ts'
import { EVENT_LIMITS } from '../../domain/events.ts'
import type { Guest } from '../../domain/models.ts'
import { describeError } from '../../shared/errorMessage.ts'
import { Button } from '../../shared/ui/Button.tsx'
import { Dialog } from '../../shared/ui/Dialog.tsx'
import { TextField } from '../../shared/ui/Field.tsx'
import { Notice } from '../../shared/ui/Notice.tsx'
import { useToast } from '../../shared/ui/toastContext.ts'
import { toInteger } from '../events/eventForm.ts'
import styles from './Guests.module.css'
import { useCreateGuest, useUpdateGuest } from './guestQueries.ts'

type FieldError =
  | { field: 'firstName' }
  | { field: 'phone'; reason: 'invalid' | 'duplicate' }
  | { field: 'allowed'; reason: 'range' | 'belowConfirmed'; count?: number }

interface GuestFormDialogProps {
  open: boolean
  onClose: () => void
  eventId: string
  defaultAllowedAttendees: number
  /** The guest being edited; leave out to add a new one. */
  guest?: Guest | null
}

function GuestForm({
  eventId,
  defaultAllowedAttendees,
  guest,
  onClose,
}: Omit<GuestFormDialogProps, 'open'>) {
  const { t } = useTranslation()
  const { showToast } = useToast()
  const create = useCreateGuest(eventId)
  const update = useUpdateGuest(eventId)
  const [firstName, setFirstName] = useState(guest?.firstName ?? '')
  const [lastName, setLastName] = useState(guest?.lastName ?? '')
  const [phone, setPhone] = useState(guest?.phone ?? '')
  const [allowed, setAllowed] = useState(
    String(guest?.allowedAttendees ?? defaultAllowedAttendees),
  )
  const [fieldError, setFieldError] = useState<FieldError | null>(null)
  const [failure, setFailure] = useState<string | null>(null)
  const limits = EVENT_LIMITS.allowedAttendees

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
    const input = { firstName, lastName, phone, allowedAttendees }
    const handlers = {
      onSuccess: () => {
        showToast({
          tone: 'success',
          message: t(guest ? 'guests.form.saved' : 'guests.form.added'),
        })
        onClose()
      },
      onError: fail,
    }
    if (guest) {
      update.mutate({ guestId: guest.id, input }, handlers)
    } else {
      create.mutate(input, handlers)
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
      <div className={styles.formActions}>
        <Button variant="ghost" onClick={onClose}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" loading={create.isPending || update.isPending}>
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
