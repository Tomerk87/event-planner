import {
  ArrowLeft,
  Copy,
  Download,
  ExternalLink,
  Eye,
  ImageUp,
  Link as LinkIcon,
  QrCode,
  Save,
  Trash2,
} from 'lucide-react'
import {
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router'
import { canEditEvent } from '../../domain/access.ts'
import { isDomainError } from '../../domain/errors.ts'
import { EVENT_LIMITS } from '../../domain/events.ts'
import type { Event, RsvpLanguage, RsvpSettings } from '../../domain/models.ts'
import {
  CALENDAR_TEXT_MAX_LENGTH,
  RSVP_MESSAGE_MAX_LENGTH,
  RSVP_TITLE_MAX_LENGTH,
  validateRsvpSettings,
} from '../../domain/rsvpSettings.ts'
import { useFormatters } from '../../i18n/format.ts'
import { LANGUAGES } from '../../i18n/languages.ts'
import { LocaleScope } from '../../i18n/LocaleScope.tsx'
import type {
  EventAccessInfo,
  RsvpSettingsInput,
} from '../../services/contracts/index.ts'
import { useEventAccessInfo } from '../../services/queries.ts'
import { ReadOnlyNotice } from '../../shared/access/EventAccess.tsx'
import { useEventAccess } from '../../shared/access/eventAccessContext.ts'
import { safeFileName } from '../../shared/download.ts'
import { describeError } from '../../shared/errorMessage.ts'
import { UnsavedChangesGuard } from '../../shared/UnsavedChangesGuard.tsx'
import { Badge } from '../../shared/ui/Badge.tsx'
import { Button, IconButton } from '../../shared/ui/Button.tsx'
import { ButtonLink } from '../../shared/ui/ButtonLink.tsx'
import { Card } from '../../shared/ui/Card.tsx'
import { Dialog } from '../../shared/ui/Dialog.tsx'
import { SelectField, TextArea, TextField } from '../../shared/ui/Field.tsx'
import { Notice } from '../../shared/ui/Notice.tsx'
import { PageHeader } from '../../shared/ui/PageHeader.tsx'
import { ErrorState, LoadingState } from '../../shared/ui/States.tsx'
import { Switch } from '../../shared/ui/Switch.tsx'
import { Tabs } from '../../shared/ui/Tabs.tsx'
import { useToast } from '../../shared/ui/toastContext.ts'
import { DESKTOP_QUERY, useMediaQuery } from '../../shared/useMediaQuery.ts'
import {
  RsvpCard,
  type RsvpCardView,
  type RsvpScreen,
} from '../public-rsvp/RsvpCard.tsx'
import {
  checkImageFile,
  IMAGE_TYPES,
  shrinkImage,
  type ImageProblem,
} from './imageTools.ts'
import { downloadQr, drawQr } from './qr.ts'
import { useRsvpSettings, useSaveRsvpSettings } from './rsvpQueries.ts'
import styles from './RsvpSettings.module.css'

interface Values extends RsvpSettingsInput {
  language: RsvpLanguage
  rsvpTitle: string
}

type ErrorField =
  'calendarTitle' | 'calendarDate' | 'calendarTime' | 'youtubeUrl'

const MESSAGES = [
  ['welcomeMessage', 'rsvpSettings.content.welcome'],
  ['approvedMessage', 'rsvpSettings.content.approved'],
  ['declinedMessage', 'rsvpSettings.content.declined'],
  ['notSureMessage', 'rsvpSettings.content.notSure'],
] as const

const SCREENS = [
  ['WELCOME', 'rsvpSettings.preview.welcome'],
  ['APPROVED', 'rsvpSettings.preview.approved'],
  ['DECLINED', 'rsvpSettings.preview.declined'],
  ['NOT_SURE', 'rsvpSettings.preview.notSure'],
] as const

function toValues(settings: RsvpSettings, event: Event): Values {
  const { eventId: _eventId, ...rest } = settings
  return {
    ...rest,
    calendar: { ...rest.calendar },
    youtube: { ...rest.youtube },
    language: event.rsvpLanguage,
    rsvpTitle: event.rsvpTitle ?? '',
  }
}

function toSettings(values: Values): RsvpSettingsInput {
  const { language: _language, rsvpTitle: _rsvpTitle, ...settings } = values
  return settings
}

function QrDialog({
  open,
  onClose,
  url,
  eventName,
}: {
  open: boolean
  onClose: () => void
  url: string
  eventName: string
}) {
  const { t } = useTranslation()
  const drawing = open ? drawQr(url) : null

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('rsvpSettings.qr.title')}
      footer={
        <Button
          icon={<Download />}
          onClick={() =>
            drawing &&
            downloadQr(drawing, `${safeFileName(eventName)} RSVP QR.png`)
          }
        >
          {t('rsvpSettings.qr.download')}
        </Button>
      }
    >
      <div className={styles.qr}>
        <p>{t('rsvpSettings.qr.body')}</p>
        {drawing && (
          <svg
            className={styles.qrCode}
            viewBox={`0 0 ${drawing.size} ${drawing.size}`}
            role="img"
            aria-label={t('rsvpSettings.qr.alt')}
            shapeRendering="crispEdges"
          >
            <path d={drawing.path} />
          </svg>
        )}
      </div>
    </Dialog>
  )
}

function RsvpSettingsForm({
  info,
  settings,
}: {
  info: EventAccessInfo
  settings: RsvpSettings
}) {
  const { t } = useTranslation()
  const format = useFormatters()
  const { showToast } = useToast()
  const formId = useId()
  const overlayId = useId()
  const formRef = useRef<HTMLFormElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const { event, isPast } = info
  const access = useEventAccess()
  const canEdit = access !== null && canEditEvent(access)
  const isDesktop = useMediaQuery(DESKTOP_QUERY)
  const save = useSaveRsvpSettings(event.id)
  const saved = toValues(settings, event)
  const [values, setValues] = useState(saved)
  const [errorField, setErrorField] = useState<ErrorField | null>(null)
  const [failure, setFailure] = useState<string | null>(null)
  const [imageProblem, setImageProblem] = useState<ImageProblem | null>(null)
  const [view, setView] = useState<'settings' | 'preview'>('settings')
  const [screen, setScreen] = useState<RsvpScreen>('WELCOME')
  const [qrOpen, setQrOpen] = useState(false)
  const [fullPreview, setFullPreview] = useState(false)
  const isDirty = canEdit && JSON.stringify(values) !== JSON.stringify(saved)
  const publicPath = `/rsvp/${event.rsvpSlug}`
  const publicUrl = new URL(publicPath, window.location.origin).href

  // A rejected save moves focus to the field that needs attention.
  useEffect(() => {
    formRef.current
      ?.querySelector<HTMLElement>('[aria-invalid="true"]')
      ?.focus()
  }, [errorField])

  function set<Field extends keyof Values>(field: Field, value: Values[Field]) {
    setValues((current) => ({ ...current, [field]: value }))
  }

  const setCalendar = (patch: Partial<Values['calendar']>) =>
    set('calendar', { ...values.calendar, ...patch })
  const setYoutube = (patch: Partial<Values['youtube']>) =>
    set('youtube', { ...values.youtube, ...patch })

  const errorOf = (field: ErrorField) =>
    errorField === field ? t(`rsvpSettings.actions.errors.${field}`) : undefined

  function fail(error: unknown) {
    const field = isDomainError(error, 'VALIDATION')
      ? String(error.details.field)
      : ''
    if (
      field === 'calendarTitle' ||
      field === 'calendarDate' ||
      field === 'calendarTime' ||
      field === 'youtubeUrl'
    ) {
      setErrorField(field)
    } else {
      setFailure(describeError(t, error))
    }
  }

  function handleSubmit(submission: FormEvent) {
    submission.preventDefault()
    setErrorField(null)
    setFailure(null)
    let tidy: RsvpSettingsInput
    try {
      tidy = validateRsvpSettings(toSettings(values))
    } catch (error) {
      return fail(error)
    }
    const eventChanged =
      values.language !== saved.language ||
      values.rsvpTitle.trim() !== saved.rsvpTitle

    save.mutate(
      {
        settings: tidy,
        event: eventChanged
          ? {
              name: event.name,
              startsAt: event.startsAt,
              timeZone: event.timeZone,
              maxAttendees: event.maxAttendees,
              defaultAllowedAttendees: event.defaultAllowedAttendees,
              location: event.location,
              rsvpLanguage: values.language,
              rsvpTitle: values.rsvpTitle,
            }
          : null,
      },
      {
        onSuccess: (result) => {
          setValues(toValues(result.settings, result.event ?? event))
          showToast({ tone: 'success', message: t('rsvpSettings.saved') })
        },
        onError: fail,
      },
    )
  }

  async function handleImage(change: ChangeEvent<HTMLInputElement>) {
    const file = change.target.files?.[0]
    // Lets the same file be chosen again after it was removed.
    change.target.value = ''
    if (!file) {
      return
    }
    const problem = checkImageFile(file)
    setImageProblem(problem)
    if (problem) {
      return
    }
    try {
      set('backgroundImage', await shrinkImage(file))
    } catch {
      setImageProblem('failed')
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(publicUrl)
      showToast({ tone: 'success', message: t('rsvpSettings.link.copied') })
    } catch {
      showToast({ tone: 'danger', message: t('rsvpSettings.link.copyFailed') })
    }
  }

  const start = new Date(event.startsAt)
  const startsAtText = {
    date: format.date(start, event.timeZone),
    time: format.time(start, event.timeZone),
    timeZone: event.timeZone,
  }
  const previewView: RsvpCardView = {
    title: values.rsvpTitle.trim() || event.name,
    startsAt: event.startsAt,
    timeZone: event.timeZone,
    location: event.location,
    maxSelectableAttendees: EVENT_LIMITS.allowedAttendees.max,
    settings: toSettings(values),
  }

  const openPublic = (
    <ButtonLink
      to={publicPath}
      newTab
      variant={isDesktop ? 'secondary' : 'primary'}
      icon={<ExternalLink />}
    >
      {t('rsvpSettings.openPublic')}
    </ButtonLink>
  )
  const saveButton = canEdit && (
    <Button
      type="submit"
      form={formId}
      icon={<Save />}
      loading={save.isPending}
      disabled={!isDirty}
    >
      {t('rsvpSettings.save')}
    </Button>
  )
  const headerActions = isDesktop ? (
    <>
      <Button
        variant="secondary"
        icon={<Eye />}
        onClick={() => setFullPreview(true)}
      >
        {t('rsvpSettings.previewPublic')}
      </Button>
      {saveButton}
    </>
  ) : view === 'settings' ? (
    <>
      <Button
        variant="secondary"
        icon={<Eye />}
        onClick={() => setView('preview')}
      >
        {t('rsvpSettings.previewPublic')}
      </Button>
      {saveButton}
    </>
  ) : (
    <>
      <Button
        variant="secondary"
        icon={<ArrowLeft />}
        onClick={() => setView('settings')}
      >
        {t('rsvpSettings.backToSettings')}
      </Button>
      {openPublic}
    </>
  )

  const preview = (
    <div className={`${styles.fields} ${styles.states}`}>
      <Tabs
        label={t('rsvpSettings.preview.states')}
        variant="segmented"
        value={screen}
        onChange={(id) =>
          setScreen(SCREENS.find(([key]) => key === id)?.[0] ?? 'WELCOME')
        }
        tabs={SCREENS.map(([id, label]) => ({ id, label: t(label) }))}
      />
      <div
        className={styles.phone}
        role="group"
        aria-label={t('rsvpSettings.preview.frame')}
      >
        <LocaleScope language={values.language}>
          <RsvpCard
            view={previewView}
            screen={screen}
            confirmedAttendees={screen === 'APPROVED' ? 2 : null}
          />
        </LocaleScope>
      </div>
    </div>
  )

  const previewCard = (
    <Card
      title={t('rsvpSettings.preview.title')}
      subtitle={t('rsvpSettings.preview.subtitle')}
      actions={isDesktop ? openPublic : undefined}
    >
      <div className={styles.fields}>
        {preview}
        {isDirty && (
          <Notice title={t('rsvpSettings.preview.unsavedTitle')}>
            {t('rsvpSettings.preview.unsavedBody')}
          </Notice>
        )}
        <Notice title={t('rsvpSettings.preview.sameLinkTitle')}>
          {t('rsvpSettings.preview.sameLinkBody')}
        </Notice>
      </div>
    </Card>
  )

  const settingsCards = (
    <form
      id={formId}
      ref={formRef}
      className={styles.column}
      noValidate
      onSubmit={handleSubmit}
    >
      <Card
        title={t('rsvpSettings.link.title')}
        subtitle={t('rsvpSettings.link.subtitle')}
        actions={
          <Badge tone={isPast ? 'neutral' : 'success'}>
            {t(
              isPast ? 'rsvpSettings.link.closed' : 'rsvpSettings.link.active',
            )}
          </Badge>
        }
      >
        <div className={styles.fields}>
          <div className={styles.linkRow}>
            <TextField
              label={t('rsvpSettings.link.label')}
              hideLabel
              readOnly
              dir="ltr"
              icon={<LinkIcon />}
              value={publicUrl}
              onFocus={(focus) => focus.target.select()}
            />
            <Button icon={<Copy />} onClick={() => void copyLink()}>
              {t('rsvpSettings.link.copy')}
            </Button>
            <IconButton
              label={t('rsvpSettings.link.qr')}
              onClick={() => setQrOpen(true)}
            >
              <QrCode />
            </IconButton>
          </div>
          <Notice title={t('rsvpSettings.link.localTitle')}>
            {t('rsvpSettings.link.localBody')}
          </Notice>
        </div>
      </Card>

      <Card
        title={t('rsvpSettings.content.title')}
        subtitle={t('rsvpSettings.content.subtitle')}
      >
        <div className={styles.fields}>
          <TextField
            label={t('rsvpSettings.content.rsvpTitle')}
            maxLength={RSVP_TITLE_MAX_LENGTH}
            disabled={!canEdit}
            value={values.rsvpTitle}
            placeholder={event.name}
            hint={t('rsvpSettings.content.rsvpTitleHint')}
            onChange={(change) => set('rsvpTitle', change.target.value)}
          />
          <div className={styles.row}>
            {MESSAGES.map(([field, label]) => (
              <TextArea
                key={field}
                label={t(label)}
                rows={3}
                maxLength={RSVP_MESSAGE_MAX_LENGTH}
                disabled={!canEdit}
                value={values[field]}
                onChange={(change) => set(field, change.target.value)}
              />
            ))}
          </div>
          <p className={styles.note}>{t('rsvpSettings.content.emptyHint')}</p>
        </div>
      </Card>

      <Card
        title={t('rsvpSettings.background.title')}
        subtitle={t('rsvpSettings.background.subtitle')}
      >
        <div className={styles.background}>
          <div className={styles.thumbnail}>
            {values.backgroundImage ? (
              <>
                <img
                  src={values.backgroundImage}
                  alt={t('rsvpSettings.background.alt')}
                />
                {canEdit && (
                  <IconButton
                    label={t('rsvpSettings.background.remove')}
                    className={styles.remove}
                    onClick={() => set('backgroundImage', null)}
                  >
                    <Trash2 />
                  </IconButton>
                )}
              </>
            ) : (
              <p className={styles.note}>{t('rsvpSettings.background.none')}</p>
            )}
          </div>
          <div className={styles.fields}>
            {canEdit && (
              <div>
                <input
                  ref={fileRef}
                  type="file"
                  className="visually-hidden"
                  tabIndex={-1}
                  aria-hidden="true"
                  accept={IMAGE_TYPES.join(',')}
                  data-testid="background-file"
                  onChange={(change) => void handleImage(change)}
                />
                <Button
                  variant="secondary"
                  icon={<ImageUp />}
                  onClick={() => fileRef.current?.click()}
                >
                  {t(
                    values.backgroundImage
                      ? 'rsvpSettings.background.change'
                      : 'rsvpSettings.background.upload',
                  )}
                </Button>
              </div>
            )}
            <p className={styles.note}>
              {t('rsvpSettings.background.requirements')}
            </p>
            {imageProblem && (
              <Notice
                tone="danger"
                title={t(`rsvpSettings.background.errors.${imageProblem}`)}
                announce
              />
            )}
            <div className={styles.overlay}>
              <label htmlFor={overlayId} className={styles.label}>
                {t('rsvpSettings.background.overlay')}
              </label>
              <div className={styles.slider}>
                <input
                  id={overlayId}
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  disabled={!canEdit}
                  value={values.overlayOpacity}
                  aria-valuetext={`${values.overlayOpacity}%`}
                  onChange={(change) =>
                    set('overlayOpacity', Number(change.target.value))
                  }
                />
                <output htmlFor={overlayId} dir="ltr">
                  {values.overlayOpacity}%
                </output>
              </div>
              <p className={styles.note}>
                {t('rsvpSettings.background.overlayHint')}
              </p>
            </div>
          </div>
        </div>
      </Card>

      <Card
        title={t('rsvpSettings.actions.title')}
        subtitle={t('rsvpSettings.actions.subtitle')}
      >
        <div className={styles.fields}>
          <Switch
            label={t('rsvpSettings.actions.calendar')}
            hint={t('rsvpSettings.actions.calendarHint')}
            disabled={!canEdit}
            checked={values.calendar.enabled}
            onChange={(change) =>
              setCalendar({ enabled: change.target.checked })
            }
          />
          {values.calendar.enabled && (
            <div className={styles.row}>
              <TextField
                label={t('rsvpSettings.actions.calendarTitle')}
                required
                maxLength={CALENDAR_TEXT_MAX_LENGTH}
                disabled={!canEdit}
                value={values.calendar.title}
                error={errorOf('calendarTitle')}
                onChange={(change) =>
                  setCalendar({ title: change.target.value })
                }
              />
              <TextField
                label={t('rsvpSettings.actions.location')}
                maxLength={CALENDAR_TEXT_MAX_LENGTH}
                disabled={!canEdit}
                value={values.calendar.location}
                onChange={(change) =>
                  setCalendar({ location: change.target.value })
                }
              />
              <TextField
                label={t('rsvpSettings.actions.date')}
                type="date"
                required
                disabled={!canEdit}
                value={values.calendar.date}
                error={errorOf('calendarDate')}
                onChange={(change) =>
                  setCalendar({ date: change.target.value })
                }
              />
              <TextField
                label={t('rsvpSettings.actions.time')}
                type="time"
                required
                disabled={!canEdit}
                value={values.calendar.time}
                error={errorOf('calendarTime')}
                onChange={(change) =>
                  setCalendar({ time: change.target.value })
                }
              />
            </div>
          )}
          <hr className={styles.divider} />
          <Switch
            label={t('rsvpSettings.actions.youtube')}
            hint={t('rsvpSettings.actions.youtubeHint')}
            disabled={!canEdit}
            checked={values.youtube.enabled}
            onChange={(change) =>
              setYoutube({ enabled: change.target.checked })
            }
          />
          {values.youtube.enabled && (
            <TextField
              label={t('rsvpSettings.actions.youtubeUrl')}
              type="url"
              dir="ltr"
              required
              maxLength={200}
              disabled={!canEdit}
              value={values.youtube.url}
              placeholder="https://www.youtube.com/watch?v="
              error={errorOf('youtubeUrl')}
              onChange={(change) => setYoutube({ url: change.target.value })}
            />
          )}
        </div>
      </Card>

      <Card title={t('rsvpSettings.additional.title')}>
        <div className={styles.fields}>
          <SelectField
            label={t('rsvpSettings.additional.language')}
            disabled={!canEdit}
            value={values.language}
            hint={t('rsvpSettings.additional.languageHint')}
            onChange={(change) =>
              set('language', change.target.value === 'he' ? 'he' : 'en')
            }
          >
            {LANGUAGES.map((language) => (
              <option key={language} value={language} lang={language}>
                {t(`language.${language}`)}
              </option>
            ))}
          </SelectField>
          <Notice
            title={t(
              isPast ? 'settings.rsvp.closedTitle' : 'settings.rsvp.openTitle',
            )}
          >
            {t(
              isPast ? 'settings.rsvp.closedBody' : 'settings.rsvp.openBody',
              startsAtText,
            )}
          </Notice>
        </div>
      </Card>
    </form>
  )

  return (
    <>
      <PageHeader
        title={t('pages.rsvpSettings')}
        subtitle={t('rsvpSettings.subtitle')}
        compactActions="bar"
        actions={headerActions}
      />
      <div className={styles.page}>
        <ReadOnlyNotice />
        {failure && <Notice tone="danger" title={failure} announce />}
        {isDesktop ? (
          <div className={styles.columns}>
            {settingsCards}
            <div className={styles.sticky}>{previewCard}</div>
          </div>
        ) : (
          <Tabs
            label={t('rsvpSettings.tabs.label')}
            variant="segmented"
            value={view}
            onChange={(id) =>
              setView(id === 'preview' ? 'preview' : 'settings')
            }
            tabs={[
              {
                id: 'settings',
                label: t('rsvpSettings.tabs.settings'),
                panel: settingsCards,
              },
              {
                id: 'preview',
                label: t('rsvpSettings.tabs.preview'),
                panel: previewCard,
              },
            ]}
          />
        )}
      </div>
      <QrDialog
        open={qrOpen}
        onClose={() => setQrOpen(false)}
        url={publicUrl}
        eventName={event.name}
      />
      <Dialog
        open={fullPreview}
        onClose={() => setFullPreview(false)}
        title={t('rsvpSettings.preview.fullTitle')}
      >
        {fullPreview && preview}
      </Dialog>
      <UnsavedChangesGuard active={isDirty} />
    </>
  )
}

export function RsvpSettingsPage() {
  const { t } = useTranslation()
  const { eventId = '' } = useParams()
  // The layout has already loaded the event, so this read comes from the cache.
  const info = useEventAccessInfo(eventId)
  const settings = useRsvpSettings(eventId)

  if (!info.data || !settings.data) {
    return (
      <>
        <PageHeader
          title={t('pages.rsvpSettings')}
          subtitle={t('rsvpSettings.subtitle')}
        />
        <Card>
          {settings.isError ? (
            <ErrorState
              description={describeError(t, settings.error)}
              onRetry={() => void settings.refetch()}
            />
          ) : (
            <LoadingState />
          )}
        </Card>
      </>
    )
  }
  // Another event gets a fresh form rather than the previous one's values.
  return (
    <RsvpSettingsForm
      key={info.data.event.id}
      info={info.data}
      settings={settings.data}
    />
  )
}
