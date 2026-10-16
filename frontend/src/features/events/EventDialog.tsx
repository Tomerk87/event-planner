import { useId, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { EVENT_LIMITS } from '../../domain/events.ts'
import { isRsvpLanguage, type Event } from '../../domain/models.ts'
import { COUNTRIES, isCountry } from '../../domain/phone.ts'
import { getCurrentLanguage } from '../../i18n/i18n.ts'
import { LANGUAGES } from '../../i18n/languages.ts'
import { describeError } from '../../shared/errorMessage.ts'
import { Button } from '../../shared/ui/Button.tsx'
import { Dialog } from '../../shared/ui/Dialog.tsx'
import { SelectField, TextField } from '../../shared/ui/Field.tsx'
import { Notice } from '../../shared/ui/Notice.tsx'
import { useToast } from '../../shared/ui/toastContext.ts'
import styles from './EventDialog.module.css'
import {
  browserTimeZone,
  defaultEventFormValues,
  eventFormErrorMessage,
  fieldErrorOf,
  listTimeZones,
  timeZoneLabel,
  toInteger,
  clampToRange,
  earliestStart,
  isTypedStartPast,
  toStartsAt,
  validateEventForm,
  type EventFormErrors,
  type EventFormField,
  type EventFormValues,
} from './eventForm.ts'
import { CoverPhotoField } from './CoverPhotoField.tsx'
import { useCreateEvent, useDuplicateEvent } from './eventMutations.ts'

interface EventDialogProps {
  open: boolean
  onClose: () => void
  /** The event being duplicated; leave out to create a new event. */
  source?: Event | null
}

function EventForm({
  source,
  onClose,
}: {
  source: Event | null
  onClose: () => void
}) {
  const { t } = useTranslation()
  const { showToast } = useToast()
  const dateErrorId = useId()
  const create = useCreateEvent()
  const duplicate = useDuplicateEvent(source?.id ?? '')
  const [values, setValues] = useState<EventFormValues>(() =>
    source
      ? {
          ...defaultEventFormValues(source.timeZone, getCurrentLanguage()),
          name: t('events.duplicate.defaultName', { name: source.name }),
        }
      : defaultEventFormValues(browserTimeZone(), getCurrentLanguage()),
  )
  const [timeZones] = useState(() => listTimeZones(values.timeZone))
  const [errors, setErrors] = useState<EventFormErrors>({})
  const [failure, setFailure] = useState<string | null>(null)
  const isPending = create.isPending || duplicate.isPending

  function set<Field extends keyof EventFormValues>(
    field: Field,
    value: EventFormValues[Field],
  ) {
    setValues((current) => ({ ...current, [field]: value }))
  }

  const message = (field: EventFormField) =>
    eventFormErrorMessage(t, errors, field)

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const startsAt = toStartsAt(values.date, values.time, values.timeZone)
    const found = validateEventForm(values, startsAt)
    setErrors(found)
    setFailure(null)
    if (Object.keys(found).length > 0 || startsAt === null) {
      return
    }

    const handlers = {
      onSuccess: () => {
        showToast({
          tone: 'success',
          message: t(source ? 'events.duplicate.done' : 'events.create.done'),
        })
        onClose()
      },
      onError: (error: unknown) => {
        const fieldError = fieldErrorOf(error)
        if (fieldError) {
          setErrors(fieldError)
        } else {
          setFailure(describeError(t, error))
        }
      },
    }

    if (source) {
      duplicate.mutate({ name: values.name, startsAt }, handlers)
    } else {
      create.mutate(
        {
          name: values.name,
          startsAt,
          timeZone: values.timeZone,
          maxAttendees: toInteger(values.maxAttendees),
          defaultAllowedAttendees: toInteger(values.defaultAllowedAttendees),
          rsvpLanguage: values.rsvpLanguage,
          country: values.country,
          location: values.location,
          coverImage: values.coverImage,
        },
        handlers,
      )
    }
  }

  // A past date and time is pointed out as soon as it is typed.
  const startsAtError = isTypedStartPast(values)
    ? t('events.form.errors.startsAtPast')
    : message('startsAt')
  const earliest = earliestStart(values.timeZone)

  return (
    <form className={styles.form} noValidate onSubmit={handleSubmit}>
      {source && (
        <Notice title={t('events.duplicate.noticeTitle')}>
          {t('events.duplicate.noticeBody')}
        </Notice>
      )}
      {failure && <Notice tone="danger" title={failure} announce />}
      <TextField
        label={t('events.form.name')}
        required
        maxLength={120}
        value={values.name}
        error={message('name')}
        onChange={(event) => set('name', event.target.value)}
      />
      <div className={styles.row}>
        <TextField
          label={t('events.form.date')}
          type="date"
          required
          value={values.date}
          min={earliest?.date}
          aria-describedby={startsAtError ? dateErrorId : undefined}
          aria-invalid={startsAtError ? true : undefined}
          onChange={(event) => set('date', event.target.value)}
        />
        <TextField
          label={t('events.form.time')}
          type="time"
          required
          value={values.time}
          min={values.date === earliest?.date ? earliest.time : undefined}
          aria-describedby={startsAtError ? dateErrorId : undefined}
          aria-invalid={startsAtError ? true : undefined}
          onChange={(event) => set('time', event.target.value)}
        />
      </div>
      {startsAtError && (
        <p id={dateErrorId} className={styles.error}>
          {startsAtError}
        </p>
      )}
      {source ? (
        <p className={styles.hint}>
          {t('events.duplicate.timeZone', { timeZone: source.timeZone })}
        </p>
      ) : (
        <>
          <SelectField
            label={t('events.form.timeZone')}
            required
            value={values.timeZone}
            error={message('timeZone')}
            searchable
            emptyLabel={t('events.form.timeZoneNoMatch')}
            onChange={(event) => set('timeZone', event.target.value)}
          >
            {timeZones.map((timeZone) => (
              <option key={timeZone} value={timeZone}>
                {timeZoneLabel(timeZone)}
              </option>
            ))}
          </SelectField>
          <div className={styles.row}>
            <TextField
              label={t('events.form.maxAttendees')}
              type="number"
              inputMode="numeric"
              required
              min={EVENT_LIMITS.maxAttendees.min}
              max={EVENT_LIMITS.maxAttendees.max}
              value={values.maxAttendees}
              hint={t(
                'events.form.maxAttendeesHint',
                EVENT_LIMITS.maxAttendees,
              )}
              error={message('maxAttendees')}
              onChange={(event) => set('maxAttendees', event.target.value)}
              onBlur={() =>
                set(
                  'maxAttendees',
                  clampToRange(values.maxAttendees, EVENT_LIMITS.maxAttendees),
                )
              }
            />
            <TextField
              label={t('events.form.defaultAllowedAttendees')}
              type="number"
              inputMode="numeric"
              required
              min={EVENT_LIMITS.allowedAttendees.min}
              max={EVENT_LIMITS.allowedAttendees.max}
              value={values.defaultAllowedAttendees}
              hint={t(
                'events.form.defaultAllowedAttendeesHint',
                EVENT_LIMITS.allowedAttendees,
              )}
              error={message('defaultAllowedAttendees')}
              onChange={(event) =>
                set('defaultAllowedAttendees', event.target.value)
              }
            />
          </div>
          <SelectField
            label={t('events.form.rsvpLanguage')}
            required
            value={values.rsvpLanguage}
            hint={t('events.form.rsvpLanguageHint')}
            onChange={(event) => {
              if (isRsvpLanguage(event.target.value)) {
                set('rsvpLanguage', event.target.value)
              }
            }}
          >
            {LANGUAGES.map((language) => (
              <option key={language} value={language} lang={language}>
                {t(`language.${language}`)}
              </option>
            ))}
          </SelectField>
          <SelectField
            label={t('events.form.country')}
            required
            value={values.country}
            hint={t('events.form.countryHint')}
            onChange={(event) => {
              if (isCountry(event.target.value)) {
                set('country', event.target.value)
              }
            }}
          >
            {COUNTRIES.map((country) => (
              <option key={country} value={country}>
                {t(`countries.${country}`)}
              </option>
            ))}
          </SelectField>
          <TextField
            label={t('events.form.location')}
            maxLength={120}
            value={values.location}
            onChange={(event) => set('location', event.target.value)}
          />
          <CoverPhotoField
            value={values.coverImage}
            onChange={(image) => set('coverImage', image)}
          />
        </>
      )}
      <div className={styles.actions}>
        <Button variant="ghost" onClick={onClose}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" loading={isPending}>
          {t(source ? 'events.duplicate.submit' : 'events.create.submit')}
        </Button>
      </div>
    </form>
  )
}

/** Creates an event, or duplicates `source` under a new name and date. */
export function EventDialog({
  open,
  onClose,
  source = null,
}: EventDialogProps) {
  const { t } = useTranslation()

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t(source ? 'events.duplicate.title' : 'events.create.title')}
    >
      <EventForm source={source} onClose={onClose} />
    </Dialog>
  )
}
