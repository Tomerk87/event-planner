import { Armchair, FileText, Save, UserCheck, UserX, Users } from 'lucide-react'
import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router'
import { canEditEvent } from '../../domain/access.ts'
import { EVENT_LIMITS, maxAttendeesRange } from '../../domain/events.ts'
import type { Event } from '../../domain/models.ts'
import { COUNTRIES, isCountry } from '../../domain/phone.ts'
import { useFormatters } from '../../i18n/format.ts'
import { useSeatingNotice } from '../dashboard/useSeatingNotice.ts'
import { CoverPhotoField } from '../events/CoverPhotoField.tsx'
import type { EventAccessInfo } from '../../services/contracts/index.ts'
import { useEventAccessInfo } from '../../services/queries.ts'
import { ReadOnlyNotice } from '../../shared/access/EventAccess.tsx'
import { useEventAccess } from '../../shared/access/eventAccessContext.ts'
import { describeError } from '../../shared/errorMessage.ts'
import { FailureNotice } from '../../shared/FailureNotice.tsx'
import { UnsavedChangesGuard } from '../../shared/UnsavedChangesGuard.tsx'
import { Button } from '../../shared/ui/Button.tsx'
import { Card, KpiCard } from '../../shared/ui/Card.tsx'
import { SelectField, TextField } from '../../shared/ui/Field.tsx'
import { Notice } from '../../shared/ui/Notice.tsx'
import { PageHeader } from '../../shared/ui/PageHeader.tsx'
import { ErrorState, LoadingState } from '../../shared/ui/States.tsx'
import { useToast } from '../../shared/ui/toastContext.ts'
import { useDashboard } from '../dashboard/dashboardQueries.ts'
import {
  eventFormErrorMessage,
  fieldErrorOf,
  listTimeZones,
  timeZoneLabel,
  toDateAndTime,
  toInteger,
  clampToRange,
  earliestStart,
  isTypedStartPast,
  toStartsAt,
  validateEventForm,
  type EventFormErrors,
  type EventFormField,
  type EventFormValues,
} from '../events/eventForm.ts'
import { useUpdateEvent } from '../events/eventMutations.ts'
import { EventRulesDialog } from './EventRulesDialog.tsx'
import styles from './EventSettings.module.css'

function toFormValues(event: Event): EventFormValues {
  return {
    name: event.name,
    ...toDateAndTime(new Date(event.startsAt), event.timeZone),
    timeZone: event.timeZone,
    maxAttendees: String(event.maxAttendees),
    defaultAllowedAttendees: String(event.defaultAllowedAttendees),
    rsvpLanguage: event.rsvpLanguage,
    country: event.country,
    location: event.location ?? '',
    coverImage: event.coverImage,
  }
}

function differs(a: EventFormValues, b: EventFormValues): boolean {
  return (Object.keys(a) as (keyof EventFormValues)[]).some(
    (field) => a[field] !== b[field],
  )
}

/** The saved figures, the same ones the Dashboard shows. */
function CapacitySummary({ event }: { event: Event }) {
  const { t } = useTranslation()
  const { number } = useFormatters()
  const dashboard = useDashboard(event.id)
  const seating = useSeatingNotice(dashboard.data, event.maxAttendees)

  if (dashboard.isError) {
    return (
      <ErrorState
        description={describeError(t, dashboard.error)}
        onRetry={() => void dashboard.refetch()}
      />
    )
  }
  if (!dashboard.data) {
    return <LoadingState />
  }

  const { metrics, warnings } = dashboard.data

  return (
    <div className={styles.fields}>
      <div className={styles.figures}>
        <KpiCard
          label={t('settings.capacity.maxAttendees')}
          value={number(event.maxAttendees)}
          icon={<Users />}
        />
        <KpiCard
          label={t('dashboard.kpis.confirmedAttendees')}
          value={number(metrics.confirmedAttendees)}
          icon={<UserCheck />}
          tone="success"
        />
        <KpiCard
          label={t('dashboard.kpis.seatingCapacity')}
          value={number(metrics.seatingCapacity)}
          icon={<Armchair />}
          tone="warning"
        />
        <KpiCard
          label={t('dashboard.kpis.unassignedConfirmedAttendees')}
          value={number(metrics.unassignedConfirmedAttendees)}
          icon={<UserX />}
          tone={metrics.unassignedConfirmedAttendees > 0 ? 'danger' : 'neutral'}
        />
      </div>
      {warnings.attendeesOverMaximum > 0 && (
        <Notice tone="danger" title={t('dashboard.warnings.overMaximum.title')}>
          {t('dashboard.warnings.overMaximum.body', {
            over: number(warnings.attendeesOverMaximum),
            confirmed: number(metrics.confirmedAttendees),
            max: number(event.maxAttendees),
          })}
        </Notice>
      )}
      {seating && (
        <Notice tone={seating.tone} title={seating.title}>
          {seating.body}
        </Notice>
      )}
    </div>
  )
}

function EventSettings({ info }: { info: EventAccessInfo }) {
  const { t } = useTranslation()
  const format = useFormatters()
  const { showToast } = useToast()
  const formId = useId()
  const dateErrorId = useId()
  const formRef = useRef<HTMLFormElement>(null)
  const { event, isPast } = info
  const access = useEventAccess()
  const canEdit = access !== null && canEditEvent(access)
  const update = useUpdateEvent(event.id)
  const [values, setValues] = useState(() => toFormValues(event))
  const [timeZones] = useState(() => listTimeZones(event.timeZone))
  const [errors, setErrors] = useState<EventFormErrors>({})
  const [failure, setFailure] = useState<string | null>(null)
  const [rulesOpen, setRulesOpen] = useState(false)
  const isDirty = canEdit && differs(values, toFormValues(event))
  // The maximum may not drop below the attendees already confirmed (D94);
  // an unchanged maximum is kept as it is.
  const confirmed = useDashboard(event.id).data?.metrics.confirmedAttendees ?? 0
  const allowedMax = maxAttendeesRange(confirmed)
  const maxChanged = values.maxAttendees !== String(event.maxAttendees)
  const checkedMax = maxChanged ? allowedMax : EVENT_LIMITS.maxAttendees

  // A rejected save moves focus to the first field that needs attention.
  useEffect(() => {
    formRef.current
      ?.querySelector<HTMLElement>('[aria-invalid="true"]')
      ?.focus()
  }, [errors])

  function set<Field extends keyof EventFormValues>(
    field: Field,
    value: EventFormValues[Field],
  ) {
    setValues((current) => ({ ...current, [field]: value }))
  }

  const message = (field: EventFormField) =>
    eventFormErrorMessage(t, errors, field, checkedMax)

  function handleSubmit(submission: FormEvent) {
    submission.preventDefault()
    void saveChanges()
  }

  /** Saves the form; resolves to whether it was saved. */
  function saveChanges(): Promise<boolean> {
    const startsAt = toStartsAt(values.date, values.time, values.timeZone)
    const found = validateEventForm(values, startsAt, checkedMax)
    setErrors(found)
    setFailure(null)
    if (Object.keys(found).length > 0 || startsAt === null) {
      return Promise.resolve(false)
    }

    return new Promise((resolve) =>
      update.mutate(
        {
          name: values.name,
          startsAt,
          timeZone: values.timeZone,
          maxAttendees: toInteger(values.maxAttendees),
          defaultAllowedAttendees: toInteger(values.defaultAllowedAttendees),
          location: values.location,
          coverImage: values.coverImage,
          country: values.country,
          // Edited on RSVP Settings; sent back as they are.
          rsvpLanguage: event.rsvpLanguage,
          rsvpTitle: event.rsvpTitle,
        },
        {
          onSuccess: (saved) => {
            setValues(toFormValues(saved))
            showToast({ tone: 'success', message: t('settings.saved') })
            resolve(true)
          },
          onError: (error) => {
            const fieldError = fieldErrorOf(error)
            if (fieldError) {
              setErrors(fieldError)
            } else {
              setFailure(describeError(t, error))
            }
            resolve(false)
          },
        },
      ),
    )
  }

  // A past date and time is pointed out as soon as it is typed; the saved
  // date of an event that has started is not a mistake.
  const savedValues = toFormValues(event)
  const startChanged =
    values.date !== savedValues.date ||
    values.time !== savedValues.time ||
    values.timeZone !== savedValues.timeZone
  const startsAtError =
    canEdit && startChanged && isTypedStartPast(values)
      ? t('events.form.errors.startsAtPast')
      : message('startsAt')
  const earliest = earliestStart(values.timeZone)
  const start = new Date(event.startsAt)
  const startsAtText = {
    date: format.date(start, event.timeZone),
    time: format.time(start, event.timeZone),
    timeZone: event.timeZone,
  }

  return (
    <>
      <PageHeader
        title={t('pages.eventSettings')}
        subtitle={t('settings.subtitle')}
        compactActions="bar"
        actions={
          canEdit && (
            <Button
              type="submit"
              form={formId}
              icon={<Save />}
              loading={update.isPending}
              disabled={!isDirty}
            >
              {t('settings.save')}
            </Button>
          )
        }
      />
      <div className={styles.page}>
        <ReadOnlyNotice />
        {failure && <FailureNotice message={failure} />}
        <div className={styles.columns}>
          <form
            id={formId}
            ref={formRef}
            className={styles.column}
            noValidate
            onSubmit={handleSubmit}
          >
            <Card
              title={t('settings.general.title')}
              subtitle={t('settings.general.subtitle')}
            >
              <div className={styles.fields}>
                <TextField
                  label={t('settings.general.name')}
                  required
                  maxLength={120}
                  disabled={!canEdit}
                  value={values.name}
                  error={message('name')}
                  onChange={(change) => set('name', change.target.value)}
                />
                <TextField
                  label={t('settings.general.location')}
                  maxLength={120}
                  disabled={!canEdit}
                  value={values.location}
                  hint={t('settings.general.locationHint')}
                  onChange={(change) => set('location', change.target.value)}
                />
                <CoverPhotoField
                  eventId={event.id}
                  value={values.coverImage}
                  disabled={!canEdit}
                  onChange={(image) => set('coverImage', image)}
                />
                <TextField
                  label={t('settings.general.maxAttendees')}
                  type="number"
                  inputMode="numeric"
                  required
                  min={allowedMax.min}
                  max={allowedMax.max}
                  disabled={!canEdit}
                  value={values.maxAttendees}
                  hint={
                    confirmed > EVENT_LIMITS.maxAttendees.min
                      ? t('settings.general.maxAttendeesConfirmedHint', {
                          ...allowedMax,
                          confirmed,
                        })
                      : t('settings.general.maxAttendeesHint', allowedMax)
                  }
                  error={message('maxAttendees')}
                  onChange={(change) =>
                    set('maxAttendees', change.target.value)
                  }
                  onBlur={() => {
                    if (maxChanged) {
                      set(
                        'maxAttendees',
                        clampToRange(values.maxAttendees, allowedMax),
                      )
                    }
                  }}
                />
                <div className={styles.row}>
                  <TextField
                    label={t('settings.general.date')}
                    type="date"
                    required
                    disabled={!canEdit}
                    value={values.date}
                    min={earliest?.date}
                    aria-describedby={startsAtError ? dateErrorId : undefined}
                    aria-invalid={startsAtError ? true : undefined}
                    onChange={(change) => set('date', change.target.value)}
                  />
                  <TextField
                    label={t('settings.general.time')}
                    type="time"
                    required
                    disabled={!canEdit}
                    value={values.time}
                    min={
                      values.date === earliest?.date ? earliest.time : undefined
                    }
                    aria-describedby={startsAtError ? dateErrorId : undefined}
                    aria-invalid={startsAtError ? true : undefined}
                    onChange={(change) => set('time', change.target.value)}
                  />
                </div>
                {startsAtError && (
                  <p id={dateErrorId} className={styles.error}>
                    {startsAtError}
                  </p>
                )}
                <SelectField
                  label={t('settings.general.timeZone')}
                  required
                  disabled={!canEdit}
                  value={values.timeZone}
                  error={message('timeZone')}
                  searchable
                  emptyLabel={t('events.form.timeZoneNoMatch')}
                  onChange={(change) => set('timeZone', change.target.value)}
                >
                  {timeZones.map((timeZone) => (
                    <option key={timeZone} value={timeZone}>
                      {timeZoneLabel(timeZone)}
                    </option>
                  ))}
                </SelectField>
                <div>
                  <p className={styles.label}>{t('settings.general.status')}</p>
                  <Notice
                    tone={isPast ? 'warning' : 'success'}
                    title={t(
                      isPast ? 'events.status.past' : 'events.status.upcoming',
                    )}
                  >
                    {t(
                      isPast
                        ? 'settings.general.pastBody'
                        : 'settings.general.upcomingBody',
                    )}
                  </Notice>
                </div>
              </div>
            </Card>

            <Card
              title={t('settings.guestDefaults.title')}
              subtitle={t('settings.guestDefaults.subtitle')}
            >
              <div className={styles.fields}>
                <TextField
                  label={t('settings.guestDefaults.allowed')}
                  type="number"
                  inputMode="numeric"
                  required
                  min={EVENT_LIMITS.allowedAttendees.min}
                  max={EVENT_LIMITS.allowedAttendees.max}
                  disabled={!canEdit}
                  value={values.defaultAllowedAttendees}
                  hint={t(
                    'settings.guestDefaults.allowedHint',
                    EVENT_LIMITS.allowedAttendees,
                  )}
                  error={message('defaultAllowedAttendees')}
                  onChange={(change) =>
                    set('defaultAllowedAttendees', change.target.value)
                  }
                />
                <SelectField
                  label={t('events.form.country')}
                  required
                  disabled={!canEdit}
                  value={values.country}
                  hint={t('events.form.countryHint')}
                  onChange={(change) => {
                    if (isCountry(change.target.value)) {
                      set('country', change.target.value)
                    }
                  }}
                >
                  {COUNTRIES.map((country) => (
                    <option key={country} value={country}>
                      {t(`countries.${country}`)}
                    </option>
                  ))}
                </SelectField>
                <Notice title={t('settings.guestDefaults.overrideTitle')}>
                  {t('settings.guestDefaults.overrideBody')}
                </Notice>
              </div>
            </Card>
          </form>

          <div className={styles.column}>
            <Card
              title={t('settings.rsvp.title')}
              subtitle={t('settings.rsvp.subtitle')}
            >
              <Notice
                title={t(
                  isPast
                    ? 'settings.rsvp.closedTitle'
                    : 'settings.rsvp.openTitle',
                )}
              >
                {t(
                  isPast
                    ? 'settings.rsvp.closedBody'
                    : 'settings.rsvp.openBody',
                  startsAtText,
                )}
              </Notice>
            </Card>

            <Card
              title={t('settings.capacity.title')}
              subtitle={t('settings.capacity.subtitle')}
            >
              <CapacitySummary event={event} />
            </Card>

            <section className={styles.danger}>
              <div>
                <h2 className={styles.dangerTitle}>
                  {t('settings.danger.title')}
                </h2>
                <p className={styles.dangerSubtitle}>
                  {t('settings.danger.subtitle')}
                </p>
              </div>
              <div className={styles.dangerBox}>
                <Notice
                  tone="warning"
                  title={t('settings.danger.lockTitle')}
                  action={
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={<FileText />}
                      onClick={() => setRulesOpen(true)}
                    >
                      {t('settings.danger.viewRules')}
                    </Button>
                  }
                >
                  {t(
                    isPast
                      ? 'settings.danger.lockedBody'
                      : 'settings.danger.lockBody',
                    startsAtText,
                  )}
                </Notice>
              </div>
            </section>
          </div>
        </div>
      </div>
      <EventRulesDialog open={rulesOpen} onClose={() => setRulesOpen(false)} />
      <UnsavedChangesGuard active={isDirty} onSave={saveChanges} />
    </>
  )
}

export function EventSettingsPage() {
  const { t } = useTranslation()
  const { eventId = '' } = useParams()
  // The layout has already loaded the event, so this read comes from the cache.
  const info = useEventAccessInfo(eventId)

  if (!info.data) {
    return (
      <>
        <PageHeader
          title={t('pages.eventSettings')}
          subtitle={t('settings.subtitle')}
        />
        <Card>
          <LoadingState />
        </Card>
      </>
    )
  }
  // Another event gets a fresh form rather than the previous one's values.
  return <EventSettings key={info.data.event.id} info={info.data} />
}
