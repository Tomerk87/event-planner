import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CalendarPlus,
  ChevronRight,
  Clock,
  Copy,
  LayoutTemplate,
  MapPin,
  Pencil,
  Plus,
  Table2,
  Users,
} from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router'
import { isDomainError } from '../../domain/errors.ts'
import { venueCan } from '../../domain/venues.ts'
import { getCurrentLanguage } from '../../i18n/i18n.ts'
import { useFormatters } from '../../i18n/format.ts'
import type {
  SpaceDetails,
  TemplateSummary,
} from '../../services/contracts/index.ts'
import { describeError } from '../../shared/errorMessage.ts'
import { NotFoundPage } from '../../shared/NotFoundPage.tsx'
import { Button, IconButton } from '../../shared/ui/Button.tsx'
import { ButtonLink } from '../../shared/ui/ButtonLink.tsx'
import { Card, KpiCard, KpiGrid } from '../../shared/ui/Card.tsx'
import { DataTable, type Column } from '../../shared/ui/DataTable.tsx'
import { Notice } from '../../shared/ui/Notice.tsx'
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from '../../shared/ui/States.tsx'
import { Tabs } from '../../shared/ui/Tabs.tsx'
import { useToast } from '../../shared/ui/toastContext.ts'
import { timeZoneChoice } from '../events/eventForm.ts'
import { LayoutPreview } from './LayoutPreview.tsx'
import { SpaceCover } from './SpaceCover.tsx'
import { SpaceDialog } from './SpaceDialog.tsx'
import styles from './VenueSpaceDetailsPage.module.css'
import { VenueStatusBadge } from './VenueEventCard.tsx'
import { TemplateNameDialog } from './TemplateNameDialog.tsx'
import {
  useCreateTemplate,
  useDuplicateTemplate,
  useSetSpaceArchived,
  useSetTemplateArchived,
} from './venueMutations.ts'
import {
  useVenueSpace,
  useVenueSpaces,
  useVenueWorkspace,
} from './venueQueries.ts'

type UpcomingEvent = SpaceDetails['upcomingEvents'][number]

function TemplateCard({
  summary,
  space,
  canManage,
  onDuplicate,
  onArchive,
}: {
  summary: TemplateSummary
  space: SpaceDetails['space']
  canManage: boolean
  onDuplicate: () => void
  onArchive: (archived: boolean) => void
}) {
  const { t } = useTranslation()
  const format = useFormatters()
  const { organizationId = '' } = useParams()
  const { template, figures, upcomingEventCount } = summary
  const warn = figures.extraChairs > 0 || figures.extraTables > 0

  return (
    <article className={styles.template}>
      <LayoutPreview
        template={template}
        label={t('spaceDetails.template.preview', { name: template.name })}
      />
      <div className={styles.templateBody}>
        <h3 className={styles.templateName}>{template.name}</h3>
        <p className={styles.usage}>
          <CalendarDays aria-hidden="true" />
          {upcomingEventCount > 0
            ? t('spaceDetails.template.used', {
                count: format.number(upcomingEventCount),
              })
            : t('spaceDetails.template.unused')}
        </p>
        <dl className={styles.templateFigures}>
          <div className={figures.extraTables > 0 ? styles.over : undefined}>
            <dt>{t('spaceDetails.template.tables')}</dt>
            <dd>{format.number(figures.tables)}</dd>
          </div>
          <div className={figures.extraChairs > 0 ? styles.over : undefined}>
            <dt>{t('spaceDetails.template.chairs')}</dt>
            <dd>{format.number(figures.chairs)}</dd>
          </div>
          <div>
            <dt>{t('spaceDetails.template.edited')}</dt>
            <dd className={styles.date}>
              {format.date(new Date(template.updatedAt), space.timeZone)}
            </dd>
          </div>
        </dl>
        {warn && (
          <Notice
            tone="warning"
            title={
              figures.extraChairs > 0
                ? t('spaceDetails.template.moreChairs', {
                    count: format.number(figures.extraChairs),
                  })
                : t('spaceDetails.template.moreTables')
            }
          >
            {[
              figures.extraChairs > 0 &&
                t('spaceDetails.template.chairsFor', {
                  chairs: format.number(figures.chairs),
                  people: format.number(space.maxPeople),
                }),
              figures.extraTables > 0 &&
                space.maxTables !== null &&
                t('spaceDetails.template.tablesNote', {
                  tables: format.number(figures.tables),
                  max: format.number(space.maxTables),
                }),
              t('spaceDetails.template.nothingBlocked'),
            ]
              .filter(Boolean)
              .join(' ')}
          </Notice>
        )}
        {canManage && (
          <div className={styles.templateActions}>
            <div className={styles.templateRow}>
              <ButtonLink
                to={`layouts/${template.id}`}
                variant="secondary"
                icon={<Pencil />}
                label={`${t('spaceDetails.template.edit')}: ${template.name}`}
              >
                {t('spaceDetails.template.edit')}
              </ButtonLink>
              {!template.archived && (
                <Button
                  variant="secondary"
                  icon={<Copy />}
                  onClick={onDuplicate}
                >
                  {t('spaceDetails.template.duplicate')}
                </Button>
              )}
              <IconButton
                label={t(
                  template.archived
                    ? 'spaceDetails.template.restore'
                    : 'spaceDetails.template.archive',
                  { name: template.name },
                )}
                onClick={() => onArchive(!template.archived)}
              >
                {template.archived ? <ArchiveRestore /> : <Archive />}
              </IconButton>
            </div>
            {!template.archived && !space.archived && (
              <ButtonLink
                to={`/venues/${organizationId}/events/new?space=${space.id}&layout=${template.id}`}
                icon={<CalendarPlus />}
                label={`${t('spaceDetails.template.createEvent')}: ${template.name}`}
              >
                {t('spaceDetails.template.createEvent')}
              </ButtonLink>
            )}
          </div>
        )}
      </div>
    </article>
  )
}

/** One space of a venue: its details, layouts and upcoming events (mockup #5). */
export function VenueSpaceDetailsPage() {
  const { t } = useTranslation()
  const format = useFormatters()
  const { organizationId = '', spaceId = '' } = useParams()
  const workspace = useVenueWorkspace(organizationId)
  const details = useVenueSpace(organizationId, spaceId)
  const spaces = useVenueSpaces(organizationId)
  const archiveSpace = useSetSpaceArchived(organizationId)
  const duplicate = useDuplicateTemplate(organizationId)
  const archiveTemplate = useSetTemplateArchived(organizationId)
  const { showToast } = useToast()
  const [editing, setEditing] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const [creating, setCreating] = useState(false)
  const createTemplate = useCreateTemplate(organizationId)
  const navigate = useNavigate()

  if (isDomainError(details.error, 'NOT_FOUND')) {
    return <NotFoundPage />
  }
  if (details.isPending) {
    return (
      <Card>
        <h1 className="visually-hidden">{t('common.loading')}</h1>
        <LoadingState />
      </Card>
    )
  }
  if (details.isError) {
    return (
      <Card>
        <ErrorState
          asPageHeading
          description={describeError(t, details.error)}
          onRetry={() => void details.refetch()}
        />
      </Card>
    )
  }

  const { space, templates, upcomingEvents } = details.data
  const canManage = venueCan(workspace.data?.role ?? null, 'MANAGE_SPACES')
  const active = templates.filter((summary) => !summary.template.archived)
  const archived = templates.filter((summary) => summary.template.archived)
  const shownTemplates = showArchived ? archived : active
  const fail = (error: unknown) =>
    showToast({ tone: 'danger', message: describeError(t, error) })
  const zone = timeZoneChoice(space.timeZone, getCurrentLanguage()).label

  const columns: Column<UpcomingEvent>[] = [
    {
      id: 'event',
      header: t('spaceDetails.upcoming.columns.event'),
      wrap: true,
      cell: (row) => <span className={styles.eventName}>{row.event.name}</span>,
    },
    {
      id: 'date',
      header: t('spaceDetails.upcoming.columns.date'),
      align: 'center',
      cell: (row) => (
        <span className={styles.stacked}>
          <span>
            {format.date(new Date(row.event.startsAt), row.event.timeZone)}
          </span>
          <span className={styles.muted}>
            {format.time(new Date(row.event.startsAt), row.event.timeZone)}
          </span>
        </span>
      ),
    },
    {
      id: 'layout',
      header: t('spaceDetails.upcoming.columns.layout'),
      wrap: true,
      cell: (row) => (
        <span className={styles.stacked}>
          <span>{row.templateName ?? t('spaceDetails.upcoming.noLayout')}</span>
          <span className={styles.muted}>
            {t('spaceDetails.upcoming.ownCopy')}
          </span>
        </span>
      ),
    },
    {
      id: 'client',
      header: t('spaceDetails.upcoming.columns.client'),
      wrap: true,
      cell: (row) =>
        row.client ? (
          <span className={styles.stacked}>
            <span className={styles.eventName}>{row.client.name}</span>
            <span className={styles.muted}>{row.client.email}</span>
          </span>
        ) : (
          <span className={styles.muted}>
            {t('spaceDetails.upcoming.noClient')}
          </span>
        ),
    },
    {
      id: 'maxPeople',
      header: t('spaceDetails.upcoming.columns.maxPeople'),
      align: 'center',
      cell: (row) => format.number(row.event.maxAttendees),
    },
    {
      id: 'status',
      header: t('spaceDetails.upcoming.columns.status'),
      align: 'center',
      cell: (row) => <VenueStatusBadge status={row.status} />,
    },
  ]

  return (
    <>
      <nav
        aria-label={t('spaceDetails.breadcrumb')}
        className={styles.breadcrumb}
      >
        <Link to=".." relative="path" className={styles.back}>
          <ArrowLeft className={styles.directional} aria-hidden="true" />
          {t('spaceDetails.back')}
        </Link>
        <ChevronRight className={styles.directional} aria-hidden="true" />
        <span aria-current="page">{space.name}</span>
      </nav>

      <header className={styles.header}>
        <SpaceCover
          id={space.id}
          name={space.name}
          photo={space.photo}
          size="tile"
        />
        <div className={styles.heading}>
          <h1 className={styles.title}>{space.name}</h1>
          <p className={styles.meta}>
            <span>
              <MapPin aria-hidden="true" />
              {space.address}
            </span>
            <span>
              <Clock aria-hidden="true" />
              {zone}
            </span>
          </p>
        </div>
        {canManage && (
          <div className={styles.headerActions}>
            <Button
              variant="secondary"
              icon={space.archived ? <ArchiveRestore /> : <Archive />}
              loading={archiveSpace.isPending}
              onClick={() =>
                archiveSpace.mutate(
                  { spaceId: space.id, archived: !space.archived },
                  {
                    onSuccess: () =>
                      showToast({
                        tone: 'success',
                        message: t(
                          space.archived
                            ? 'venueSpaces.restoredDone'
                            : 'venueSpaces.archivedDone',
                        ),
                      }),
                    onError: fail,
                  },
                )
              }
            >
              {t(
                space.archived
                  ? 'spaceDetails.restore'
                  : 'spaceDetails.archive',
              )}
            </Button>
            <Button
              variant="secondary"
              icon={<Pencil />}
              onClick={() => setEditing(true)}
            >
              {t('spaceDetails.edit')}
            </Button>
          </div>
        )}
      </header>

      {space.archived && (
        <div className={styles.section}>
          <Notice tone="warning" title={t('spaceDetails.archivedNotice.title')}>
            {t('spaceDetails.archivedNotice.body')}
          </Notice>
        </div>
      )}

      <div className={styles.section}>
        <KpiGrid label={space.name}>
          <KpiCard
            label={t('spaceDetails.kpi.maxPeople')}
            value={format.number(space.maxPeople)}
            hint={t('spaceDetails.kpi.people')}
            icon={<Users />}
          />
          <KpiCard
            label={t('spaceDetails.kpi.maxTables')}
            value={
              space.maxTables === null
                ? t('spaceDetails.kpi.notSet')
                : format.number(space.maxTables)
            }
            hint={t('spaceDetails.kpi.forInformation')}
            icon={<Table2 />}
          />
          <KpiCard
            label={t('spaceDetails.kpi.layouts')}
            value={format.number(active.length)}
            hint={t('spaceDetails.kpi.layoutsUnit')}
            icon={<LayoutTemplate />}
          />
          <KpiCard
            label={t('spaceDetails.kpi.upcoming')}
            value={format.number(upcomingEvents.length)}
            hint={t('spaceDetails.kpi.events')}
            icon={<CalendarDays />}
            tone="success"
          />
        </KpiGrid>
      </div>

      <section className={styles.section} aria-labelledby="layouts-heading">
        <h2 id="layouts-heading" className={styles.sectionTitle}>
          {t('spaceDetails.layouts.title')}
        </h2>
        <p className={styles.sectionSubtitle}>
          {t('spaceDetails.layouts.subtitle')}
        </p>
        <div className={styles.layoutsToolbar}>
          <Tabs
            variant="segmented"
            label={t('spaceDetails.layouts.tabsLabel')}
            value={showArchived ? 'archived' : 'active'}
            onChange={(id) => setShowArchived(id === 'archived')}
            tabs={[
              {
                id: 'active',
                label: t('spaceDetails.layouts.active'),
                count: active.length,
              },
              {
                id: 'archived',
                label: t('spaceDetails.layouts.archived'),
                count: archived.length,
              },
            ]}
          />
          {canManage && !space.archived && (
            <Button icon={<Plus />} onClick={() => setCreating(true)}>
              {t('spaceDetails.layouts.add')}
            </Button>
          )}
        </div>
        {shownTemplates.length === 0 ? (
          <Card>
            <EmptyState
              icon={showArchived ? <Archive /> : <LayoutTemplate />}
              title={t(
                showArchived
                  ? 'spaceDetails.layouts.archivedEmpty.title'
                  : 'spaceDetails.layouts.empty.title',
              )}
              description={t(
                showArchived
                  ? 'spaceDetails.layouts.archivedEmpty.body'
                  : 'spaceDetails.layouts.empty.body',
              )}
            />
          </Card>
        ) : (
          <ul
            className={styles.templates}
            aria-label={t('spaceDetails.layouts.listLabel')}
          >
            {shownTemplates.map((summary) => (
              <li key={summary.template.id}>
                <TemplateCard
                  summary={summary}
                  space={space}
                  canManage={canManage}
                  onDuplicate={() =>
                    duplicate.mutate(summary.template.id, {
                      onSuccess: (copy) =>
                        showToast({
                          tone: 'success',
                          message: t('spaceDetails.template.duplicated', {
                            name: copy.name,
                          }),
                        }),
                      onError: fail,
                    })
                  }
                  onArchive={(archive) =>
                    archiveTemplate.mutate(
                      { templateId: summary.template.id, archived: archive },
                      {
                        onSuccess: () =>
                          showToast({
                            tone: 'success',
                            message: t(
                              archive
                                ? 'spaceDetails.template.archivedDone'
                                : 'spaceDetails.template.restoredDone',
                            ),
                          }),
                        onError: fail,
                      },
                    )
                  }
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={styles.section} aria-labelledby="upcoming-heading">
        <div className={styles.sectionHead}>
          <div>
            <h2 id="upcoming-heading" className={styles.sectionTitle}>
              {t('spaceDetails.upcoming.title')}
            </h2>
            <p className={styles.sectionSubtitle}>
              {t('spaceDetails.upcoming.subtitle')}
            </p>
          </div>
          <ButtonLink
            to={`/venues/${organizationId}/events?space=${space.id}`}
            variant="soft"
            icon={<ArrowRight />}
            iconPosition="end"
          >
            {t('spaceDetails.upcoming.viewAll')}
          </ButtonLink>
        </div>
        {upcomingEvents.length === 0 ? (
          <Card>
            <p className={styles.muted}>{t('spaceDetails.upcoming.empty')}</p>
          </Card>
        ) : (
          <DataTable
            caption={t('spaceDetails.upcoming.caption')}
            columns={columns}
            rows={upcomingEvents}
            getRowKey={(row) => row.event.id}
            renderCard={(row) => (
              <div className={styles.eventCard}>
                <div className={styles.eventCardTop}>
                  <span className={styles.eventName}>{row.event.name}</span>
                  <VenueStatusBadge status={row.status} />
                </div>
                <p className={styles.muted}>
                  {format.date(
                    new Date(row.event.startsAt),
                    row.event.timeZone,
                  )}{' '}
                  ·{' '}
                  {format.time(
                    new Date(row.event.startsAt),
                    row.event.timeZone,
                  )}
                </p>
                <p>
                  {row.templateName ?? t('spaceDetails.upcoming.noLayout')}{' '}
                  <span className={styles.muted}>
                    ({t('spaceDetails.upcoming.ownCopy')})
                  </span>
                </p>
                <p>{row.client?.name ?? t('spaceDetails.upcoming.noClient')}</p>
              </div>
            )}
          />
        )}
      </section>

      {creating && (
        <TemplateNameDialog
          mode="create"
          pending={createTemplate.isPending}
          onSubmit={(name) =>
            createTemplate.mutateAsync({ spaceId: space.id, name })
          }
          onDone={(template) => {
            showToast({
              tone: 'success',
              message: t('templateEditor.createDialog.created', {
                name: template.name,
              }),
            })
            void navigate(`layouts/${template.id}`)
          }}
          onClose={() => setCreating(false)}
        />
      )}
      {editing && (
        <SpaceDialog
          open
          onClose={() => setEditing(false)}
          organizationId={organizationId}
          space={space}
          country={
            workspace.data?.organization.defaultLanguage === 'pt' ? 'BR' : 'IL'
          }
          otherNames={(spaces.data ?? [])
            .filter((summary) => summary.space.id !== space.id)
            .map((summary) => summary.space.name)}
        />
      )}
    </>
  )
}
