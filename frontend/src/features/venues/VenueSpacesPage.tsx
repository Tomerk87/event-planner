import {
  Archive,
  ArchiveRestore,
  ArrowRight,
  CalendarDays,
  Ellipsis,
  Image,
  Info,
  MapPin,
  Pencil,
  Plus,
  Search,
  SearchX,
  TriangleAlert,
  Warehouse,
} from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router'
import { venueCan, type VenueSpace } from '../../domain/venues.ts'
import { useFormatters } from '../../i18n/format.ts'
import type { SpaceSummary } from '../../services/contracts/index.ts'
import { describeError } from '../../shared/errorMessage.ts'
import { Badge } from '../../shared/ui/Badge.tsx'
import { Button } from '../../shared/ui/Button.tsx'
import { ButtonLink } from '../../shared/ui/ButtonLink.tsx'
import { Card } from '../../shared/ui/Card.tsx'
import { TextField } from '../../shared/ui/Field.tsx'
import { Menu, type MenuItem } from '../../shared/ui/Menu.tsx'
import { PageHeader } from '../../shared/ui/PageHeader.tsx'
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from '../../shared/ui/States.tsx'
import { Tabs } from '../../shared/ui/Tabs.tsx'
import { useToast } from '../../shared/ui/toastContext.ts'
import { PHONE_QUERY, useMediaQuery } from '../../shared/useMediaQuery.ts'
import { useQueryParams } from '../../shared/useQueryParams.ts'
import { SpaceCover } from './SpaceCover.tsx'
import { SpaceDialog } from './SpaceDialog.tsx'
import styles from './VenueSpacesPage.module.css'
import { TemplateNameDialog } from './TemplateNameDialog.tsx'
import { useCreateTemplate, useSetSpaceArchived } from './venueMutations.ts'
import { useVenueSpaces, useVenueWorkspace } from './venueQueries.ts'

type Show = 'active' | 'archived'

/** The space dialog: closed, creating, or editing one space. */
type DialogState = { space: VenueSpace | null } | null

function SpaceCard({
  summary,
  canManage,
  onEdit,
  onArchive,
  onAddLayout,
}: {
  summary: SpaceSummary
  canManage: boolean
  onEdit: () => void
  onArchive: (archived: boolean) => void
  onAddLayout: () => void
}) {
  const { t } = useTranslation()
  const format = useFormatters()
  const { space, layoutCount, upcomingEventCount, nextEvent } = summary
  const address = space.id
  const menuItems: MenuItem[] = [
    {
      id: 'edit',
      label: t('venueSpaces.card.edit'),
      icon: <Pencil />,
      onSelect: onEdit,
    },
    space.archived
      ? {
          id: 'restore',
          label: t('venueSpaces.card.restore'),
          icon: <ArchiveRestore />,
          onSelect: () => onArchive(false),
        }
      : {
          id: 'archive',
          label: t('venueSpaces.card.archive'),
          icon: <Archive />,
          onSelect: () => onArchive(true),
        },
  ]

  return (
    <article className={styles.card}>
      <div className={styles.media}>
        <SpaceCover id={space.id} name={space.name} photo={space.photo} />
        {space.photo && (
          <span className={styles.photoBadge}>
            <Badge tone="neutral" icon={<Image />}>
              {t('venueSpaces.card.photo')}
            </Badge>
          </span>
        )}
        {space.archived && (
          <span className={styles.photoBadge}>
            <Badge tone="neutral" icon={<Archive />}>
              {t('venueSpaces.card.archived')}
            </Badge>
          </span>
        )}
        {canManage && (
          <span className={styles.menu}>
            <Menu
              label={t('venueSpaces.card.actions', { name: space.name })}
              triggerClassName={styles.menuButton}
              items={menuItems}
            >
              <Ellipsis aria-hidden="true" />
            </Menu>
          </span>
        )}
      </div>
      <div className={styles.body}>
        <h2 className={styles.name}>{space.name}</h2>
        <p className={styles.address}>
          <MapPin aria-hidden="true" />
          {space.address}
        </p>
        <dl className={styles.figures}>
          <div>
            <dt>{t('venueSpaces.card.maxPeople')}</dt>
            <dd>{format.number(space.maxPeople)}</dd>
          </div>
          <div>
            <dt>
              {t('venueSpaces.card.maxTables')}
              <span title={t('venueSpaces.card.maxTablesHint')}>
                <Info className={styles.info} aria-hidden="true" />
                <span className="visually-hidden">
                  {t('venueSpaces.card.maxTablesHint')}
                </span>
              </span>
            </dt>
            <dd
              className={space.maxTables === null ? styles.notSet : undefined}
            >
              {space.maxTables === null
                ? t('venueSpaces.card.notSet')
                : format.number(space.maxTables)}
            </dd>
          </div>
          <div>
            <dt>{t('venueSpaces.card.layouts')}</dt>
            <dd>{format.number(layoutCount)}</dd>
          </div>
          <div>
            <dt>{t('venueSpaces.card.upcoming')}</dt>
            <dd>{format.number(upcomingEventCount)}</dd>
          </div>
        </dl>
        {layoutCount === 0 ? (
          <p className={styles.warning}>
            <TriangleAlert aria-hidden="true" />
            {t('venueSpaces.card.noLayouts')}
          </p>
        ) : nextEvent ? (
          <p className={styles.next}>
            <CalendarDays aria-hidden="true" />
            <span>
              {t('venueSpaces.card.next')}{' '}
              <strong>
                {nextEvent.name} ·{' '}
                {format.date(new Date(nextEvent.startsAt), nextEvent.timeZone)}
              </strong>
            </span>
          </p>
        ) : null}
        <div className={styles.footer}>
          {layoutCount === 0 && canManage && !space.archived && (
            <Button variant="secondary" icon={<Plus />} onClick={onAddLayout}>
              {t('venueSpaces.card.addLayout')}
            </Button>
          )}
          <ButtonLink
            to={address}
            icon={<ArrowRight />}
            iconPosition="end"
            label={t('venueSpaces.card.openNamed', { name: space.name })}
          >
            {t('venueSpaces.card.open')}
          </ButtonLink>
        </div>
      </div>
    </article>
  )
}

/** A venue's spaces (V2.2, mockup #3). */
export function VenueSpacesPage() {
  const { t, i18n } = useTranslation()
  const { organizationId = '' } = useParams()
  const workspace = useVenueWorkspace(organizationId)
  const spaces = useVenueSpaces(organizationId)
  const archive = useSetSpaceArchived(organizationId)
  const { showToast } = useToast()
  const isPhone = useMediaQuery(PHONE_QUERY)
  const { params, update } = useQueryParams()
  const [dialog, setDialog] = useState<DialogState>(null)
  const [addingTo, setAddingTo] = useState<string | null>(null)
  const createTemplate = useCreateTemplate(organizationId)
  const navigate = useNavigate()

  const canManage = venueCan(workspace.data?.role ?? null, 'MANAGE_SPACES')
  const show: Show = params.get('show') === 'archived' ? 'archived' : 'active'
  const query = params.get('q') ?? ''
  const all = spaces.data ?? []
  const needle = query.trim().toLocaleLowerCase(i18n.language)
  const searched = all.filter(({ space }) =>
    [space.name, space.address].some((text) =>
      text.toLocaleLowerCase(i18n.language).includes(needle),
    ),
  )
  const count = (which: Show) =>
    searched.filter(({ space }) => space.archived === (which === 'archived'))
      .length
  const shown = searched.filter(
    ({ space }) => space.archived === (show === 'archived'),
  )
  const country =
    workspace.data?.organization.defaultLanguage === 'pt' ? 'BR' : 'IL'

  function setArchived(space: VenueSpace, archived: boolean) {
    archive.mutate(
      { spaceId: space.id, archived },
      {
        onSuccess: () =>
          showToast({
            tone: 'success',
            message: t(
              archived
                ? 'venueSpaces.archivedDone'
                : 'venueSpaces.restoredDone',
            ),
          }),
        onError: (error) =>
          showToast({ tone: 'danger', message: describeError(t, error) }),
      },
    )
  }

  const createButton = canManage && (
    <Button
      icon={<Plus />}
      fullWidth={isPhone}
      onClick={() => setDialog({ space: null })}
    >
      {t('venueSpaces.create')}
    </Button>
  )

  return (
    <>
      <PageHeader
        title={t('venueSpaces.title')}
        subtitle={t('venueSpaces.subtitle')}
        actions={isPhone ? undefined : createButton || undefined}
      />
      {all.length > 0 && (
        <div className={styles.toolbar}>
          <Tabs
            variant="segmented"
            label={t('venueSpaces.tabs.label')}
            value={show}
            onChange={(id) => update({ show: id === 'active' ? null : id })}
            tabs={[
              {
                id: 'active',
                label: t('venueSpaces.tabs.active'),
                count: count('active'),
              },
              {
                id: 'archived',
                label: t('venueSpaces.tabs.archived'),
                count: count('archived'),
              },
            ]}
          />
          <div className={styles.search}>
            <TextField
              label={t('venueSpaces.search.label')}
              hideLabel
              type="search"
              icon={<Search />}
              placeholder={t('venueSpaces.search.placeholder')}
              value={query}
              onChange={(event) => update({ q: event.target.value || null })}
            />
          </div>
        </div>
      )}
      {isPhone && createButton && (
        <div className={styles.phoneRow}>{createButton}</div>
      )}

      {spaces.isPending ? (
        <Card>
          <LoadingState />
        </Card>
      ) : spaces.isError ? (
        <Card>
          <ErrorState
            description={describeError(t, spaces.error)}
            onRetry={() => void spaces.refetch()}
          />
        </Card>
      ) : all.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Warehouse />}
            title={t('venueSpaces.empty.title')}
            description={t('venueSpaces.empty.body')}
            action={
              canManage && (
                <Button
                  icon={<Plus />}
                  onClick={() => setDialog({ space: null })}
                >
                  {t('venueSpaces.empty.action')}
                </Button>
              )
            }
          />
        </Card>
      ) : shown.length === 0 ? (
        <Card>
          {needle !== '' ? (
            <EmptyState
              icon={<SearchX />}
              title={t('venueSpaces.noMatch.title')}
              description={t('venueSpaces.noMatch.body')}
            />
          ) : (
            <EmptyState
              icon={<Archive />}
              title={t('venueSpaces.archivedEmpty.title')}
              description={t('venueSpaces.archivedEmpty.body')}
            />
          )}
        </Card>
      ) : (
        <ul className={styles.list} aria-label={t('venueSpaces.listLabel')}>
          {shown.map((summary) => (
            <li key={summary.space.id}>
              <SpaceCard
                summary={summary}
                canManage={canManage}
                onEdit={() => setDialog({ space: summary.space })}
                onArchive={(archived) => setArchived(summary.space, archived)}
                onAddLayout={() => setAddingTo(summary.space.id)}
              />
            </li>
          ))}
        </ul>
      )}

      {addingTo && (
        <TemplateNameDialog
          mode="create"
          pending={createTemplate.isPending}
          onSubmit={(name) =>
            createTemplate.mutateAsync({ spaceId: addingTo, name })
          }
          onDone={(template) => {
            showToast({
              tone: 'success',
              message: t('templateEditor.createDialog.created', {
                name: template.name,
              }),
            })
            void navigate(`${addingTo}/layouts/${template.id}`)
          }}
          onClose={() => setAddingTo(null)}
        />
      )}
      {dialog && (
        <SpaceDialog
          open
          onClose={() => setDialog(null)}
          organizationId={organizationId}
          space={dialog.space}
          country={country}
          otherNames={all
            .filter(({ space }) => space.id !== dialog.space?.id)
            .map(({ space }) => space.name)}
        />
      )}
    </>
  )
}
