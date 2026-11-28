import {
  ArrowLeft,
  ArrowRight,
  CalendarCheck,
  CalendarDays,
  Check,
  ChevronRight,
  Copy,
  LayoutTemplate as LayoutIcon,
  Map as MapIcon,
  MapPin,
  Minus,
  Table2,
  Type,
  User,
  Users,
} from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams, useSearchParams } from 'react-router'
import { assertEmail } from '../../domain/accounts.ts'
import { isDomainError } from '../../domain/errors.ts'
import type { Event } from '../../domain/models.ts'
import {
  sameDayEvents,
  templateFigures,
  venueCan,
  type LayoutTemplate,
  type VenueSpace,
} from '../../domain/venues.ts'
import { getCurrentLanguage } from '../../i18n/i18n.ts'
import { useFormatters } from '../../i18n/format.ts'
import { describeError } from '../../shared/errorMessage.ts'
import { NotFoundPage } from '../../shared/NotFoundPage.tsx'
import { Badge } from '../../shared/ui/Badge.tsx'
import { Button } from '../../shared/ui/Button.tsx'
import { ButtonLink } from '../../shared/ui/ButtonLink.tsx'
import { Card, KpiCard, KpiGrid } from '../../shared/ui/Card.tsx'
import { cx } from '../../shared/ui/cx.ts'
import { TextField } from '../../shared/ui/Field.tsx'
import { Notice } from '../../shared/ui/Notice.tsx'
import { PageHeader } from '../../shared/ui/PageHeader.tsx'
import { EmptyState, LoadingState } from '../../shared/ui/States.tsx'
import { CoverPhotoField } from '../events/CoverPhotoField.tsx'
import {
  earliestStart,
  isTypedStartPast,
  timeZoneChoice,
  toStartsAt,
} from '../events/eventForm.ts'
import { LayoutPreview } from './LayoutPreview.tsx'
import { SpaceCover } from './SpaceCover.tsx'
import styles from './VenueCreateEventPage.module.css'
import { useCreateVenueEvent } from './venueMutations.ts'
import {
  useVenueEvents,
  useVenueSpace,
  useVenueSpaces,
  useVenueWorkspace,
} from './venueQueries.ts'

const NAME_MAX_LENGTH = 120
const STEPS = ['space', 'layout', 'details', 'review'] as const
type Step = (typeof STEPS)[number]

interface Details {
  name: string
  date: string
  time: string
  coverImage: string | null
  clientEmail: string
}

type DetailsError = 'name' | 'date' | 'time' | 'past' | 'email'

function StepIndicator({
  current,
  hints,
}: {
  current: number
  hints: Record<Step, string>
}) {
  const { t } = useTranslation()
  return (
    <Card>
      <ol
        className={styles.steps}
        aria-label={t('createVenueEvent.steps.label')}
      >
        {STEPS.map((step, index) => {
          const done = index < current
          const active = index === current
          return (
            <li
              key={step}
              className={cx(
                styles.step,
                done && styles.stepDone,
                active && styles.stepActive,
              )}
              aria-current={active ? 'step' : undefined}
            >
              <span className={styles.stepMark} aria-hidden="true">
                {done ? <Check /> : index + 1}
              </span>
              <span className={styles.stepText}>
                <span className={styles.stepName}>
                  {t(`createVenueEvent.steps.${step}`)}
                  {done && (
                    <span className="visually-hidden">
                      {' '}
                      ({t('createVenueEvent.steps.done')})
                    </span>
                  )}
                </span>
                <span className={styles.stepHint}>{hints[step]}</span>
              </span>
            </li>
          )
        })}
      </ol>
    </Card>
  )
}

function ChoiceCard({
  selected,
  disabled = false,
  onSelect,
  children,
}: {
  selected: boolean
  disabled?: boolean
  onSelect: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      className={cx(styles.choice, selected && styles.choiceSelected)}
      aria-pressed={selected}
      disabled={disabled}
      onClick={onSelect}
    >
      {children}
      {selected && <Check className={styles.choiceCheck} aria-hidden="true" />}
    </button>
  )
}

/**
 * Creating a venue event (V2.2, Phase 27, mockup #9): choose a space, one of
 * its layouts, then the name, date and time, and review. The event gets its
 * own copy of the layout (D111); the client may be invited at once.
 */
export function VenueCreateEventPage() {
  const { t } = useTranslation()
  const format = useFormatters()
  const { organizationId = '' } = useParams()
  const [search] = useSearchParams()
  const workspace = useVenueWorkspace(organizationId)
  const spaces = useVenueSpaces(organizationId)
  const events = useVenueEvents(organizationId)
  const create = useCreateVenueEvent(organizationId)

  const [spaceId, setSpaceId] = useState(search.get('space') ?? '')
  const [templateId, setTemplateId] = useState(search.get('layout') ?? '')
  const [step, setStep] = useState<Step>(
    search.get('layout') ? 'details' : search.get('space') ? 'layout' : 'space',
  )
  const [details, setDetails] = useState<Details>({
    name: '',
    date: '',
    time: '',
    coverImage: null,
    clientEmail: '',
  })
  const [error, setError] = useState<DetailsError | null>(null)
  const [failure, setFailure] = useState<string | null>(null)
  const [created, setCreated] = useState<Event | null>(null)
  const spaceDetails = useVenueSpace(organizationId, spaceId)

  if (workspace.isPending || spaces.isPending) {
    return (
      <Card>
        <h1 className="visually-hidden">{t('common.loading')}</h1>
        <LoadingState />
      </Card>
    )
  }
  if (!workspace.data || !venueCan(workspace.data.role, 'MANAGE_EVENTS')) {
    return <NotFoundPage />
  }

  const venue = workspace.data.organization
  const active = (spaces.data ?? []).filter(({ space }) => !space.archived)
  const space: VenueSpace | undefined = active.find(
    (summary) => summary.space.id === spaceId,
  )?.space
  const templates = (spaceDetails.data?.templates ?? []).filter(
    (summary) => !summary.template.archived,
  )
  const chosen = templates.find((summary) => summary.template.id === templateId)
  const template: LayoutTemplate | undefined = chosen?.template
  const figures = template && space && templateFigures(template, space)
  const startsAt =
    space && toStartsAt(details.date, details.time, space.timeZone)
  const sameDay =
    space && details.date
      ? sameDayEvents(
          (events.data ?? [])
            .filter((summary) => summary.space.id === space.id)
            .map((summary) => summary.event),
          startsAt ?? `${details.date}T12:00:00.000Z`,
          space.timeZone,
        )
      : []
  const zone = space
    ? timeZoneChoice(space.timeZone, getCurrentLanguage()).label
    : ''
  const earliest = space ? earliestStart(space.timeZone) : null
  const index = STEPS.indexOf(step)
  const set = <Key extends keyof Details>(key: Key, value: Details[Key]) => {
    setDetails((current) => ({ ...current, [key]: value }))
    setError(null)
  }

  function checkDetails(): boolean {
    const name = details.name.trim()
    const found: DetailsError | null =
      name === '' || name.length > NAME_MAX_LENGTH
        ? 'name'
        : !details.date
          ? 'date'
          : !details.time
            ? 'time'
            : !startsAt ||
                isTypedStartPast({
                  date: details.date,
                  time: details.time,
                  timeZone: space?.timeZone ?? '',
                })
              ? 'past'
              : null
    setError(found)
    return found === null
  }

  function submit() {
    if (!space || !template || !startsAt) {
      return
    }
    if (details.clientEmail.trim()) {
      try {
        assertEmail(details.clientEmail)
      } catch {
        setError('email')
        return
      }
    }
    setFailure(null)
    create.mutate(
      {
        spaceId: space.id,
        templateId: template.id,
        name: details.name,
        startsAt,
        coverImage: details.coverImage,
        clientEmail: details.clientEmail.trim() || null,
      },
      {
        onSuccess: setCreated,
        onError: (problem) =>
          isDomainError(problem, 'VALIDATION') &&
          problem.details?.['field'] === 'email'
            ? setError('email')
            : setFailure(describeError(t, problem)),
      },
    )
  }

  const errorText = (which: DetailsError) =>
    error === which
      ? t(`createVenueEvent.errors.${which}`, { max: NAME_MAX_LENGTH })
      : undefined
  const sameDayNotice = sameDay.length > 0 && space && (
    <Notice tone="warning" title={t('createVenueEvent.sameDay.title')}>
      {sameDay
        .map((event) =>
          t('createVenueEvent.sameDay.body', {
            space: space.name,
            name: event.name,
            time: format.time(new Date(event.startsAt), event.timeZone),
            date: format.date(new Date(event.startsAt), event.timeZone),
          }),
        )
        .join(' ')}
    </Notice>
  )
  const hints: Record<Step, string> = {
    space: space?.name ?? t('createVenueEvent.steps.spaceHint'),
    layout: template?.name ?? t('createVenueEvent.steps.layoutHint'),
    details:
      index > 2 && startsAt && space
        ? format.date(new Date(startsAt), space.timeZone)
        : t('createVenueEvent.steps.detailsHint'),
    review: t('createVenueEvent.steps.reviewHint'),
  }

  const header = (
    <>
      <nav
        aria-label={t('createVenueEvent.breadcrumb')}
        className={styles.breadcrumb}
      >
        <Link to=".." relative="path">
          <ArrowLeft className={styles.directional} aria-hidden="true" />
          {t('createVenueEvent.back')}
        </Link>
        <ChevronRight className={styles.directional} aria-hidden="true" />
        <span aria-current="page">{t('createVenueEvent.title')}</span>
      </nav>
      <PageHeader
        title={t('createVenueEvent.title')}
        subtitle={t('createVenueEvent.subtitle')}
      />
    </>
  )

  if (created && space && template) {
    const email = details.clientEmail.trim()
    return (
      <>
        {header}
        <Card>
          <EmptyState
            icon={<CalendarCheck />}
            title={t('createVenueEvent.created.title')}
            description={[
              t('createVenueEvent.created.body', {
                name: created.name,
                space: space.name,
                layout: template.name,
              }),
              email
                ? t('createVenueEvent.created.invited', { email })
                : t('createVenueEvent.created.noClient'),
            ].join(' ')}
            action={
              <div className={styles.createdActions}>
                <ButtonLink to=".." variant="primary">
                  {t('createVenueEvent.created.toEvents')}
                </ButtonLink>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setCreated(null)
                    setDetails({
                      name: '',
                      date: '',
                      time: '',
                      coverImage: null,
                      clientEmail: '',
                    })
                    setStep('space')
                  }}
                >
                  {t('createVenueEvent.created.another')}
                </Button>
              </div>
            }
          />
        </Card>
      </>
    )
  }

  const footer = (next: ReactNode) => (
    <div className={styles.footer}>
      {index > 0 ? (
        <Button
          variant="secondary"
          icon={<ArrowLeft className={styles.directional} />}
          onClick={() => setStep(STEPS[index - 1] ?? 'space')}
        >
          {t('createVenueEvent.backStep')}
        </Button>
      ) : (
        <span />
      )}
      {next}
    </div>
  )
  const nextButton = (enabled: boolean, onNext: () => void) => (
    <Button
      icon={<ArrowRight className={styles.directional} />}
      iconPosition="end"
      disabled={!enabled}
      onClick={onNext}
    >
      {t('createVenueEvent.next')}
    </Button>
  )

  return (
    <>
      {header}
      <div className={styles.stack}>
        <StepIndicator current={index} hints={hints} />

        {step === 'space' && (
          <Card
            title={t('createVenueEvent.space.title')}
            subtitle={t('createVenueEvent.space.subtitle')}
          >
            {active.length === 0 ? (
              <p className={styles.muted}>
                {t('createVenueEvent.space.empty')}
              </p>
            ) : (
              <div className={styles.choices}>
                {active.map(({ space: option, layoutCount }) => (
                  <ChoiceCard
                    key={option.id}
                    selected={option.id === spaceId}
                    disabled={layoutCount === 0}
                    onSelect={() => {
                      setSpaceId(option.id)
                      setTemplateId('')
                    }}
                  >
                    <SpaceCover
                      id={option.id}
                      name={option.name}
                      photo={option.photo}
                    />
                    <span className={styles.choiceBody}>
                      <span className={styles.choiceName}>{option.name}</span>
                      <span className={styles.muted}>
                        <bdi>{option.address}</bdi>
                      </span>
                      <span className={styles.muted}>
                        {t('createVenueEvent.space.people', {
                          count: format.number(option.maxPeople),
                        })}{' '}
                        ·{' '}
                        {layoutCount === 0
                          ? t('createVenueEvent.space.noLayouts')
                          : t('createVenueEvent.space.layouts', {
                              count: format.number(layoutCount),
                            })}
                      </span>
                    </span>
                  </ChoiceCard>
                ))}
              </div>
            )}
            {footer(nextButton(Boolean(space), () => setStep('layout')))}
          </Card>
        )}

        {step === 'layout' && space && (
          <Card
            title={t('createVenueEvent.layout.title')}
            subtitle={t('createVenueEvent.layout.subtitle')}
          >
            {spaceDetails.isPending ? (
              <LoadingState />
            ) : (
              <div className={styles.choices}>
                {templates.map(({ template: option, figures: counts }) => (
                  <ChoiceCard
                    key={option.id}
                    selected={option.id === templateId}
                    onSelect={() => setTemplateId(option.id)}
                  >
                    <LayoutPreview
                      template={option}
                      label={t('spaceDetails.template.preview', {
                        name: option.name,
                      })}
                    />
                    <span className={styles.choiceBody}>
                      <span className={styles.choiceName}>{option.name}</span>
                      <span className={styles.muted}>
                        {t('createVenueEvent.layout.figures', {
                          tables: format.number(counts.tables),
                          chairs: format.number(counts.chairs),
                        })}
                      </span>
                      {counts.extraChairs > 0 && (
                        <span className={styles.warning}>
                          {t('createVenueEvent.layout.moreChairs', {
                            count: format.number(counts.extraChairs),
                          })}
                        </span>
                      )}
                    </span>
                  </ChoiceCard>
                ))}
              </div>
            )}
            {footer(nextButton(Boolean(template), () => setStep('details')))}
          </Card>
        )}

        {step === 'details' && space && template && figures && (
          <Card
            title={t('createVenueEvent.details.title')}
            subtitle={t('createVenueEvent.details.subtitle')}
          >
            <div className={styles.summary}>
              <span>
                <strong>
                  {space.name} · {template.name}
                </strong>{' '}
                {t('createVenueEvent.details.summary', {
                  address: `\u2068${space.address}\u2069`,
                  people: format.number(space.maxPeople),
                  tables: format.number(figures.tables),
                  chairs: format.number(figures.chairs),
                })}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setStep('space')}
              >
                {t('createVenueEvent.details.change')}
              </Button>
            </div>
            <div className={styles.detailsGrid}>
              <div className={styles.fields}>
                <TextField
                  label={t('createVenueEvent.details.name')}
                  required
                  maxLength={NAME_MAX_LENGTH}
                  value={details.name}
                  hint={t('createVenueEvent.details.nameHint')}
                  error={errorText('name')}
                  onChange={(change) => set('name', change.target.value)}
                />
                <div className={styles.row}>
                  <TextField
                    label={t('createVenueEvent.details.date')}
                    type="date"
                    required
                    min={earliest?.date}
                    value={details.date}
                    error={errorText('date') ?? errorText('past')}
                    onChange={(change) => set('date', change.target.value)}
                  />
                  <TextField
                    label={t('createVenueEvent.details.time')}
                    type="time"
                    required
                    value={details.time}
                    hint={t('createVenueEvent.details.timeHint', { zone })}
                    error={errorText('time')}
                    onChange={(change) => set('time', change.target.value)}
                  />
                </div>
                {sameDayNotice}
              </div>
              <CoverPhotoField
                label={t('createVenueEvent.details.photo')}
                value={details.coverImage}
                onChange={(image) => set('coverImage', image)}
              />
            </div>
            {footer(
              nextButton(true, () => {
                if (checkDetails()) {
                  setStep('review')
                }
              }),
            )}
          </Card>
        )}

        {step === 'review' && space && template && figures && startsAt && (
          <Card
            title={t('createVenueEvent.review.title')}
            subtitle={t('createVenueEvent.review.subtitle')}
          >
            {failure && <Notice tone="danger" title={failure} announce />}
            <div className={styles.reviewGrid}>
              <div className={styles.stack}>
                <dl className={styles.reviewList}>
                  {(
                    [
                      [
                        <MapIcon key="i" />,
                        'space',
                        space.name,
                        venue.name,
                        'space',
                      ],
                      [
                        <MapPin key="i" />,
                        'address',
                        space.address,
                        null,
                        null,
                      ],
                      [
                        <CalendarDays key="i" />,
                        'dateTime',
                        `${format.date(new Date(startsAt), space.timeZone)} · ${format.time(new Date(startsAt), space.timeZone)}`,
                        zone,
                        'details',
                      ],
                      [
                        <LayoutIcon key="i" />,
                        'layout',
                        template.name,
                        t('createVenueEvent.review.ownCopy'),
                        'layout',
                      ],
                      [
                        <Type key="i" />,
                        'eventName',
                        details.name.trim(),
                        null,
                        'details',
                      ],
                    ] as const
                  ).map(([icon, label, value, note, target]) => (
                    <div key={label} className={styles.reviewRow}>
                      <dt>
                        <span aria-hidden="true">{icon}</span>
                        {t(`createVenueEvent.review.${label}`)}
                      </dt>
                      <dd>
                        <span className={styles.reviewText}>
                          <span className={styles.reviewValue}>
                            <bdi>{value}</bdi>
                          </span>
                          {note && (
                            <span className={styles.muted}>
                              <bdi>{note}</bdi>
                            </span>
                          )}
                        </span>
                        {target && (
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label={`${t('createVenueEvent.review.edit')}: ${t(`createVenueEvent.review.${label}`)}`}
                            onClick={() => setStep(target)}
                          >
                            {t('createVenueEvent.review.edit')}
                          </Button>
                        )}
                      </dd>
                    </div>
                  ))}
                </dl>
                <KpiGrid label={t('createVenueEvent.review.title')} trio>
                  <KpiCard
                    label={t('createVenueEvent.review.maxPeople')}
                    value={format.number(space.maxPeople)}
                    hint={t('createVenueEvent.review.people')}
                    icon={<Users />}
                  />
                  <KpiCard
                    label={t('createVenueEvent.review.tables')}
                    value={format.number(figures.tables)}
                    hint={t('templateEditor.kpi.tablesHint')}
                    icon={<Table2 />}
                  />
                  <KpiCard
                    label={t('createVenueEvent.review.chairs')}
                    value={format.number(figures.chairs)}
                    hint={t('templateEditor.kpi.chairs')}
                    icon={<Users />}
                  />
                </KpiGrid>
                {sameDayNotice}
              </div>
              <div className={styles.stack}>
                <Card
                  title={t('createVenueEvent.review.client')}
                  actions={
                    <Badge tone="neutral">
                      {t('createVenueEvent.review.optional')}
                    </Badge>
                  }
                >
                  <div className={styles.fields}>
                    <p className={styles.muted}>
                      {t('createVenueEvent.review.clientIntro')}
                    </p>
                    <TextField
                      label={t('createVenueEvent.review.clientEmail')}
                      type="email"
                      value={details.clientEmail}
                      hint={t('createVenueEvent.review.clientHint')}
                      error={errorText('email')}
                      onChange={(change) =>
                        set('clientEmail', change.target.value)
                      }
                    />
                    <ul className={styles.clientList}>
                      <li>
                        <Check aria-hidden="true" />
                        {t('createVenueEvent.review.clientCan1')}
                      </li>
                      <li>
                        <Check aria-hidden="true" />
                        {t('createVenueEvent.review.clientCan2')}
                      </li>
                      <li>
                        <Minus aria-hidden="true" />
                        {t('createVenueEvent.review.clientCannot', {
                          venue: venue.name,
                        })}
                      </li>
                    </ul>
                  </div>
                </Card>
                <Notice
                  title={t('createVenueEvent.review.copyTitle', {
                    layout: template.name,
                  })}
                >
                  {t('createVenueEvent.review.copyBody', { space: space.name })}
                </Notice>
              </div>
            </div>
            {footer(
              <div className={styles.createRow}>
                {details.clientEmail.trim() && (
                  <span className={styles.muted}>
                    <User aria-hidden="true" className={styles.inlineIcon} />
                    {t('createVenueEvent.review.willInvite')} ·{' '}
                    {t('createVenueEvent.review.demoNote')}
                  </span>
                )}
                <Button
                  icon={<Check />}
                  loading={create.isPending}
                  onClick={submit}
                >
                  {t('createVenueEvent.review.create')}
                </Button>
              </div>,
            )}
          </Card>
        )}
        {step !== 'space' && !space && (
          <Card>
            <Notice tone="warning" title={t('createVenueEvent.space.empty')}>
              <Button
                variant="secondary"
                icon={<Copy />}
                onClick={() => setStep('space')}
              >
                {t('createVenueEvent.steps.spaceHint')}
              </Button>
            </Notice>
          </Card>
        )}
      </div>
    </>
  )
}
