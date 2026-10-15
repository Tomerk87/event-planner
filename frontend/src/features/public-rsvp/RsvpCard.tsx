import {
  CalendarPlus,
  Check,
  CircleHelp,
  MapPin,
  Navigation,
  Phone,
  Play,
  User,
  Users,
  X,
} from 'lucide-react'
import { useId, type CSSProperties, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { RsvpResponse } from '../../domain/models.ts'
import {
  buildGoogleCalendarUrl,
  isYouTubeUrl,
} from '../../domain/rsvpSettings.ts'
import { useFormatters } from '../../i18n/format.ts'
import type { PublicRsvpView } from '../../services/contracts/index.ts'
import { cx } from '../../shared/ui/cx.ts'
import { Select } from '../../shared/ui/Select.tsx'
import styles from './RsvpCard.module.css'
import { mapLinks } from './mapLinks.ts'

/** The page before a response, after one, or once the event has started. */
export type RsvpScreen = 'WELCOME' | 'CLOSED' | RsvpResponse

export type RsvpCardView = Pick<
  PublicRsvpView,
  | 'title'
  | 'startsAt'
  | 'timeZone'
  | 'location'
  | 'maxSelectableAttendees'
  | 'settings'
>

export interface RsvpFormValues {
  name: string
  phone: string
  attendees: string
}

export type RsvpFormField = keyof RsvpFormValues

export interface RsvpFormState {
  values: RsvpFormValues
  errors: Partial<Record<RsvpFormField, string>>
  /** A problem that is not about one field. */
  failure: string | null
  /** The response being sent, while it is on its way. */
  sending: RsvpResponse | null
  onChange: (field: RsvpFormField, value: string) => void
  onSubmit: (status: RsvpResponse) => void
}

interface RsvpCardProps {
  view: RsvpCardView
  screen: RsvpScreen
  /** Leave out to show the page without letting anyone use it (a preview). */
  form?: RsvpFormState
  /** Shown after an approval. */
  confirmedAttendees?: number | null
  onChangeResponse?: () => void
  /** The public page's title is the page heading; a preview's is not. */
  titleLevel?: 'h1' | 'h3'
}

const EMPTY_FORM: RsvpFormState = {
  values: { name: '', phone: '', attendees: '' },
  errors: {},
  failure: null,
  sending: null,
  onChange: () => undefined,
  onSubmit: () => undefined,
}

const RESPONSES = [
  { status: 'APPROVED', label: 'publicRsvp.approve', icon: Check },
  { status: 'DECLINED', label: 'publicRsvp.decline', icon: X },
  { status: 'NOT_SURE', label: 'publicRsvp.notSure', icon: CircleHelp },
] as const

const RESPONSE_STYLE = {
  APPROVED: styles.approved,
  DECLINED: styles.declined,
  NOT_SURE: styles.notSure,
} as const

function TextInput({
  label,
  icon,
  error,
  hint,
  value,
  onChange,
  ...rest
}: {
  label: string
  icon: ReactNode
  error: string | undefined
  hint?: string
  value: string
  onChange: (value: string) => void
  type?: 'text' | 'tel'
  autoComplete: string
  maxLength: number
  dir?: 'ltr'
}) {
  const id = useId()
  const describedBy =
    [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') ||
    undefined

  return (
    <div className={styles.field}>
      <div className={styles.control}>
        <span className={styles.fieldIcon} aria-hidden="true">
          {icon}
        </span>
        <input
          className={styles.input}
          aria-label={label}
          placeholder={`${label} *`}
          required
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          {...rest}
        />
      </div>
      {hint && (
        <p id={`${id}-hint`} className={styles.hint}>
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className={styles.error}>
          {error}
        </p>
      )}
    </div>
  )
}

/**
 * The guest-facing RSVP page. The same component is the public page and the
 * organizer's preview of it, so the two cannot drift apart. It is written in
 * the language of the surrounding `LocaleScope`.
 */
export function RsvpCard({
  view,
  screen,
  form,
  confirmedAttendees = null,
  onChangeResponse,
  titleLevel: Title = 'h3',
}: RsvpCardProps) {
  const { t } = useTranslation()
  const format = useFormatters()
  const attendeesErrorId = useId()
  const { settings } = view
  const { values, errors, failure, sending, onChange, onSubmit } =
    form ?? EMPTY_FORM
  const start = new Date(view.startsAt)
  const message = {
    WELCOME: settings.welcomeMessage || t('publicRsvp.defaults.welcome'),
    APPROVED: settings.approvedMessage || t('publicRsvp.defaults.approved'),
    DECLINED: settings.declinedMessage || t('publicRsvp.defaults.declined'),
    NOT_SURE: settings.notSureMessage || t('publicRsvp.defaults.notSure'),
    CLOSED: t('publicRsvp.closed.body'),
  }[screen]
  const links = [
    {
      id: 'calendar',
      label: t('publicRsvp.addToCalendar'),
      icon: <CalendarPlus />,
      url: settings.calendar.enabled
        ? buildGoogleCalendarUrl(settings.calendar, view.timeZone)
        : null,
    },
    {
      id: 'youtube',
      label: t('publicRsvp.watchYoutube'),
      icon: <Play />,
      url:
        settings.youtube.enabled && isYouTubeUrl(settings.youtube.url)
          ? settings.youtube.url.trim()
          : null,
    },
  ].filter((link) => link.url !== null)
  const ResultIcon = RESPONSES.find(
    (response) => response.status === screen,
  )?.icon

  return (
    <div
      className={styles.card}
      style={
        {
          '--rsvp-overlay': settings.overlayOpacity / 100,
        } as CSSProperties
      }
      // A preview shows the page; it is not a second form to fill in.
      inert={form === undefined}
    >
      {settings.backgroundImage && (
        // Zoomed in on, and centred at, the point the organizer chose.
        <img
          className={styles.picture}
          src={settings.backgroundImage}
          alt=""
          style={{
            objectPosition: `${settings.imagePositionX}% ${settings.imagePositionY}%`,
            transformOrigin: `${settings.imagePositionX}% ${settings.imagePositionY}%`,
            transform: `scale(${settings.imageZoom / 100})`,
          }}
        />
      )}
      <div className={styles.content}>
        <header className={styles.header}>
          <Title className={styles.title}>{view.title}</Title>
          <p className={styles.when}>
            <span>
              {format.date(start, view.timeZone)}
              {' · '}
              {format.time(start, view.timeZone)}
            </span>
            {view.location && <span>{view.location}</span>}
          </p>
          {view.location && (
            <p className={styles.maps}>
              <a
                className={styles.mapLink}
                href={mapLinks(view.location).google}
                target="_blank"
                rel="noopener noreferrer"
              >
                <MapPin aria-hidden="true" />
                {t('publicRsvp.maps.google')}
              </a>
              <a
                className={styles.mapLink}
                href={mapLinks(view.location).waze}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Navigation aria-hidden="true" />
                {t('publicRsvp.maps.waze')}
              </a>
            </p>
          )}
        </header>

        <div className={styles.panel}>
          {screen !== 'WELCOME' && screen !== 'CLOSED' && ResultIcon && (
            <span
              className={cx(styles.resultIcon, RESPONSE_STYLE[screen])}
              aria-hidden="true"
            >
              <ResultIcon />
            </span>
          )}
          {screen === 'CLOSED' && (
            <p className={styles.count}>{t('publicRsvp.closed.title')}</p>
          )}
          <p
            className={styles.message}
            role={screen === 'WELCOME' ? undefined : 'status'}
          >
            {message}
          </p>

          {screen === 'WELCOME' ? (
            <form
              className={styles.form}
              noValidate
              onSubmit={(event) => event.preventDefault()}
            >
              {failure && (
                <p className={styles.failure} role="alert">
                  {failure}
                </p>
              )}
              <TextInput
                label={t('publicRsvp.name')}
                icon={<User />}
                autoComplete="name"
                maxLength={80}
                value={values.name}
                error={errors.name}
                onChange={(value) => onChange('name', value)}
              />
              <TextInput
                label={t('publicRsvp.phone')}
                icon={<Phone />}
                type="tel"
                dir="ltr"
                autoComplete="tel"
                maxLength={24}
                value={values.phone}
                error={errors.phone}
                hint={t('publicRsvp.phoneHint')}
                onChange={(value) => onChange('phone', value)}
              />
              <div className={styles.field}>
                <Select
                  aria-label={t('publicRsvp.attendees')}
                  aria-invalid={errors.attendees ? true : undefined}
                  aria-describedby={
                    errors.attendees ? attendeesErrorId : undefined
                  }
                  icon={<Users />}
                  value={values.attendees}
                  onChange={(value) => onChange('attendees', value)}
                  options={[
                    {
                      value: '',
                      label: `${t('publicRsvp.attendees')} *`,
                      disabled: true,
                    },
                    ...Array.from(
                      { length: view.maxSelectableAttendees },
                      (_, index) => ({
                        value: String(index + 1),
                        label: format.number(index + 1),
                      }),
                    ),
                  ]}
                />
                {errors.attendees && (
                  <p id={attendeesErrorId} className={styles.error}>
                    {errors.attendees}
                  </p>
                )}
              </div>
              {RESPONSES.map(({ status, label, icon: Icon }) => (
                <button
                  key={status}
                  type="button"
                  className={cx(styles.response, RESPONSE_STYLE[status])}
                  disabled={sending !== null}
                  aria-busy={sending === status || undefined}
                  onClick={() => onSubmit(status)}
                >
                  <Icon aria-hidden="true" />
                  {t(label)}
                </button>
              ))}
            </form>
          ) : (
            <div className={styles.form}>
              {screen === 'APPROVED' && confirmedAttendees !== null && (
                <p className={styles.count}>
                  {t('publicRsvp.result.attendees', {
                    count: format.number(confirmedAttendees),
                  })}
                </p>
              )}
              {screen === 'APPROVED' && links.length > 0 && (
                <div className={styles.links}>
                  {links.map((link) => (
                    <a
                      key={link.id}
                      className={styles.link}
                      href={link.url ?? undefined}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <span className={styles.linkIcon} aria-hidden="true">
                        {link.icon}
                      </span>
                      {link.label}
                    </a>
                  ))}
                </div>
              )}
              {onChangeResponse && screen !== 'CLOSED' && (
                <button
                  type="button"
                  className={styles.change}
                  onClick={onChangeResponse}
                >
                  {t('publicRsvp.result.change')}
                </button>
              )}
            </div>
          )}
        </div>

        {screen === 'WELCOME' && links.length > 0 && (
          <div className={styles.after}>
            <p className={styles.afterTitle}>
              {t('publicRsvp.afterConfirming')}
            </p>
            <ul className={styles.links}>
              {links.map((link) => (
                <li key={link.id} className={styles.link}>
                  <span className={styles.linkIcon} aria-hidden="true">
                    {link.icon}
                  </span>
                  {link.label}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
