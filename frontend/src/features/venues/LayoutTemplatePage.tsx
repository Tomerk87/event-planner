import {
  ArrowLeft,
  Building2,
  ChevronRight,
  Clock,
  Copy,
  Pencil,
  Plus,
  Table2,
  Trash2,
  TriangleAlert,
  Users,
} from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { isDomainError } from '../../domain/errors.ts'
import type { SeatedTable } from '../../domain/tableList.ts'
import {
  templateAsLayout,
  templateFigures,
  templateTables,
  venueCan,
} from '../../domain/venues.ts'
import { useFormatters } from '../../i18n/format.ts'
import { describeError } from '../../shared/errorMessage.ts'
import { NotFoundPage } from '../../shared/NotFoundPage.tsx'
import { Button, IconButton } from '../../shared/ui/Button.tsx'
import { Card, KpiCard, KpiGrid } from '../../shared/ui/Card.tsx'
import { DataTable, type Column } from '../../shared/ui/DataTable.tsx'
import { Dialog } from '../../shared/ui/Dialog.tsx'
import { Notice } from '../../shared/ui/Notice.tsx'
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from '../../shared/ui/States.tsx'
import { Tabs } from '../../shared/ui/Tabs.tsx'
import { useToast } from '../../shared/ui/toastContext.ts'
import { PHONE_QUERY, useMediaQuery } from '../../shared/useMediaQuery.ts'
import { useQueryParams } from '../../shared/useQueryParams.ts'
import { ArrangementTab } from '../event-layout/ArrangementTab.tsx'
import type { LayoutSource } from '../event-layout/layoutQueries.ts'
import { ShapeLabel } from '../event-layout/TableBits.tsx'
import { TableDialog, type TableSaver } from '../event-layout/TableDialog.tsx'
import styles from './LayoutTemplatePage.module.css'
import { TemplateNameDialog } from './TemplateNameDialog.tsx'
import {
  useRemoveTemplateTable,
  useRenameTemplate,
  useSaveTemplateLayout,
  useSaveTemplateTable,
} from './venueMutations.ts'
import { useVenueTemplate, useVenueWorkspace } from './venueQueries.ts'

type Panel =
  | { kind: 'add' }
  | { kind: 'edit'; item: SeatedTable }
  | { kind: 'delete'; item: SeatedTable }
  | { kind: 'rename' }

/**
 * A venue's layout template in the floor-plan editor (V2.2, Phase 26,
 * mockup #6). The editor is the event's own (D100) working on the template
 * through a layout source; a template has no guests, so its tables have no
 * seating.
 */
export function LayoutTemplatePage() {
  const { t } = useTranslation()
  const format = useFormatters()
  const { organizationId = '', spaceId = '', templateId = '' } = useParams()
  const workspace = useVenueWorkspace(organizationId)
  const details = useVenueTemplate(organizationId, templateId)
  const saveLayout = useSaveTemplateLayout(organizationId, templateId)
  const saveTable = useSaveTemplateTable(organizationId, templateId)
  const removeTable = useRemoveTemplateTable(organizationId, templateId)
  const rename = useRenameTemplate(organizationId, templateId)
  const { showToast } = useToast()
  const isPhone = useMediaQuery(PHONE_QUERY)
  const { params, update } = useQueryParams()
  const [panel, setPanel] = useState<Panel | null>(null)
  const [chosenId, setChosenId] = useState<string | null>(null)

  const template = details.data?.template
  const source: LayoutSource = {
    layout: template && templateAsLayout(template),
    error: details.error,
    isError: details.isError,
    reload: async () => {
      const fresh = await details.refetch()
      return fresh.data && templateAsLayout(fresh.data.template)
    },
    save: (input) => saveLayout.mutateAsync(input),
    saving: saveLayout.isPending,
  }

  if (
    isDomainError(details.error, 'NOT_FOUND') ||
    (details.data && details.data.space.id !== spaceId)
  ) {
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
  if (details.isError || !template) {
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

  const { space, upcomingEventCount } = details.data
  const canManage =
    venueCan(workspace.data?.role ?? null, 'MANAGE_SPACES') &&
    !template.archived &&
    !space.archived
  const tables: SeatedTable[] = templateTables(template).map((table) => ({
    table,
    assigned: 0,
    available: table.capacity,
  }))
  const figures = templateFigures(template, space)
  const difference = figures.chairs - space.maxPeople
  const view = params.get('view') === 'tables' ? 'tables' : 'arrangement'
  const chosen = tables.find((item) => item.table.id === chosenId) ?? null
  const spacePath = `/venues/${organizationId}/spaces/${space.id}`
  const tableName = (item: SeatedTable) =>
    t('layout.tableNumber', { number: format.number(item.table.number) })

  const saver: TableSaver = {
    save: (input, editingId) =>
      saveTable.mutateAsync({
        input,
        number:
          tables.find((item) => item.table.id === editingId)?.table.number ??
          null,
      }),
    saving: saveTable.isPending,
  }

  const actionsFor = (item: SeatedTable) =>
    canManage && (
      <span className={styles.rowActions}>
        <IconButton
          label={`${t('templateEditor.selected.edit')}: ${tableName(item)}`}
          onClick={() => setPanel({ kind: 'edit', item })}
        >
          <Pencil />
        </IconButton>
        <IconButton
          variant="danger"
          label={`${t('templateEditor.selected.delete')}: ${tableName(item)}`}
          onClick={() => setPanel({ kind: 'delete', item })}
        >
          <Trash2 />
        </IconButton>
      </span>
    )

  const side = (
    <Card title={t('templateEditor.selected.title')}>
      {chosen ? (
        <div className={styles.selected}>
          <p className={styles.selectedName}>{tableName(chosen)}</p>
          <dl className={styles.selectedFacts}>
            <div>
              <dt>{t('layout.columns.shape')}</dt>
              <dd>
                <ShapeLabel shape={chosen.table.shape} />
              </dd>
            </div>
            <div>
              <dt>{t('layout.columns.capacity')}</dt>
              <dd>{format.number(chosen.table.capacity)}</dd>
            </div>
          </dl>
          {canManage && (
            <div className={styles.selectedActions}>
              <Button
                variant="secondary"
                icon={<Pencil />}
                onClick={() => setPanel({ kind: 'edit', item: chosen })}
              >
                {t('templateEditor.selected.edit')}
              </Button>
              <Button
                variant="danger"
                icon={<Trash2 />}
                onClick={() => setPanel({ kind: 'delete', item: chosen })}
              >
                {t('templateEditor.selected.delete')}
              </Button>
            </div>
          )}
        </div>
      ) : (
        <p className={styles.muted}>{t('templateEditor.selected.hint')}</p>
      )}
    </Card>
  )

  const columns: Column<SeatedTable>[] = [
    {
      id: 'number',
      header: t('layout.columns.number'),
      align: 'center',
      cell: (item) => format.number(item.table.number),
    },
    {
      id: 'shape',
      header: t('layout.columns.shape'),
      cell: (item) => <ShapeLabel shape={item.table.shape} />,
    },
    {
      id: 'capacity',
      header: t('layout.columns.capacity'),
      align: 'center',
      cell: (item) => format.number(item.table.capacity),
    },
    {
      id: 'actions',
      header: t('layout.columns.actions'),
      hideHeader: true,
      pinned: true,
      cell: actionsFor,
    },
  ]

  return (
    <>
      <nav className={styles.back}>
        <Link to={spacePath}>
          <ArrowLeft className={styles.directional} aria-hidden="true" />
          {t('templateEditor.back', { space: space.name })}
        </Link>
      </nav>
      <header className={styles.header}>
        <div className={styles.heading}>
          <h1 className={styles.title}>
            <span className={styles.spaceName}>{space.name}</span>
            <ChevronRight className={styles.directional} aria-hidden="true" />
            <span>{template.name}</span>
          </h1>
          {canManage && (
            <Button
              variant="secondary"
              size="sm"
              icon={<Pencil />}
              onClick={() => setPanel({ kind: 'rename' })}
            >
              {t('templateEditor.rename')}
            </Button>
          )}
        </div>
        {canManage && !isPhone && (
          <Button icon={<Plus />} onClick={() => setPanel({ kind: 'add' })}>
            {t('templateEditor.addTable')}
          </Button>
        )}
      </header>
      <p className={styles.meta}>
        <span>
          <Clock aria-hidden="true" />
          {t('templateEditor.lastEdited', {
            date: format.date(new Date(template.updatedAt), space.timeZone),
          })}
        </span>
        <span>
          <Copy aria-hidden="true" />
          {upcomingEventCount > 0
            ? t('templateEditor.used', {
                count: format.number(upcomingEventCount),
              })
            : t('templateEditor.unused')}
        </span>
      </p>

      {template.archived && (
        <div className={styles.section}>
          <Notice tone="warning" title={t('templateEditor.archived.title')}>
            {t('templateEditor.archived.body')}
          </Notice>
        </div>
      )}

      <div className={styles.section}>
        <Tabs
          variant="segmented"
          label={t('layout.tabs.label')}
          value={view}
          onChange={(id) => update({ view: id === 'arrangement' ? null : id })}
          tabs={[
            { id: 'arrangement', label: t('layout.tabs.arrangement') },
            { id: 'tables', label: t('layout.tabs.tables') },
          ]}
        />
      </div>

      <div className={styles.section}>
        <KpiGrid label={template.name}>
          <KpiCard
            label={t('templateEditor.kpi.tables')}
            value={format.number(figures.tables)}
            hint={
              space.maxTables === null
                ? t('templateEditor.kpi.tablesHint')
                : t('templateEditor.kpi.tablesNoted', {
                    max: format.number(space.maxTables),
                  })
            }
            icon={<Table2 />}
          />
          <KpiCard
            label={t('templateEditor.kpi.capacity')}
            value={format.number(figures.chairs)}
            hint={t('templateEditor.kpi.chairs')}
            icon={<Users />}
          />
          <KpiCard
            label={t('templateEditor.kpi.maxPeople')}
            value={format.number(space.maxPeople)}
            hint={t('templateEditor.kpi.peopleIn', { space: space.name })}
            icon={<Building2 />}
          />
          <KpiCard
            label={t('templateEditor.kpi.diff')}
            value={
              difference > 0
                ? `+${format.number(difference)}`
                : format.number(difference)
            }
            hint={t(
              difference > 0
                ? 'templateEditor.kpi.more'
                : difference < 0
                  ? 'templateEditor.kpi.fewer'
                  : 'templateEditor.kpi.equal',
            )}
            icon={<TriangleAlert />}
            tone={difference > 0 ? 'warning' : 'neutral'}
          />
        </KpiGrid>
      </div>

      {(figures.extraChairs > 0 || figures.extraTables > 0) && (
        <div className={styles.warnings}>
          {figures.extraChairs > 0 && (
            <Notice
              tone="warning"
              title={t('templateEditor.warnings.moreChairsTitle', {
                count: format.number(figures.extraChairs),
              })}
            >
              {t('templateEditor.warnings.moreChairsBody', {
                chairs: format.number(figures.chairs),
                people: format.number(space.maxPeople),
                space: space.name,
              })}
            </Notice>
          )}
          {figures.extraTables > 0 && space.maxTables !== null && (
            <Notice
              tone="warning"
              title={t('templateEditor.warnings.moreTablesTitle')}
            >
              {t('templateEditor.warnings.moreTablesBody', {
                tables: format.number(figures.tables),
                max: format.number(space.maxTables),
                space: space.name,
              })}
            </Notice>
          )}
        </div>
      )}

      {canManage && isPhone && (
        <div className={styles.section}>
          <Button
            icon={<Plus />}
            fullWidth
            onClick={() => setPanel({ kind: 'add' })}
          >
            {t('templateEditor.addTable')}
          </Button>
        </div>
      )}

      {view === 'arrangement' ? (
        <ArrangementTab
          source={source}
          tables={tables}
          chosenId={chosenId}
          onChooseTable={(tableId) =>
            setChosenId((current) => (current === tableId ? null : tableId))
          }
          canEdit={canManage}
          canAddTable={canManage}
          isPhone={isPhone}
          onAddTable={() => setPanel({ kind: 'add' })}
          side={side}
          hint={{
            wide: t('templateEditor.planHint'),
            touch: t('templateEditor.planHintTouch'),
          }}
        />
      ) : tables.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Table2 />}
            title={t('templateEditor.list.caption')}
            description={t('templateEditor.list.empty')}
          />
        </Card>
      ) : (
        <DataTable
          caption={t('templateEditor.list.caption')}
          columns={columns}
          rows={tables}
          getRowKey={(item) => item.table.id}
          renderCard={(item) => (
            <div className={styles.tableCard}>
              <div className={styles.tableCardTop}>
                <span className={styles.selectedName}>{tableName(item)}</span>
                {actionsFor(item)}
              </div>
              <p className={styles.muted}>
                <ShapeLabel shape={item.table.shape} /> ·{' '}
                {t('layout.columns.capacity')}{' '}
                {format.number(item.table.capacity)}
              </p>
            </div>
          )}
        />
      )}

      <TableDialog
        open={panel?.kind === 'add' || panel?.kind === 'edit'}
        onClose={() => setPanel(null)}
        eventId={template.id}
        saver={saver}
        tables={tables}
        editing={panel?.kind === 'edit' ? panel.item : null}
        onDelete={(item) => setPanel({ kind: 'delete', item })}
      />
      {panel?.kind === 'delete' && (
        <Dialog
          open
          onClose={() => setPanel(null)}
          title={t('templateEditor.deleteDialog.title', {
            number: format.number(panel.item.table.number),
          })}
          footer={
            <div className={styles.dialogActions}>
              <Button variant="ghost" onClick={() => setPanel(null)}>
                {t('common.cancel')}
              </Button>
              <Button
                variant="danger"
                loading={removeTable.isPending}
                onClick={() => {
                  const { number } = panel.item.table
                  removeTable.mutate(number, {
                    onSuccess: () => {
                      showToast({
                        tone: 'success',
                        message: t('templateEditor.deleteDialog.done', {
                          number: format.number(number),
                        }),
                      })
                      setChosenId(null)
                      setPanel(null)
                    },
                    onError: (error) =>
                      showToast({
                        tone: 'danger',
                        message: describeError(t, error),
                      }),
                  })
                }}
              >
                {t('templateEditor.deleteDialog.confirm')}
              </Button>
            </div>
          }
        >
          <p>{t('templateEditor.deleteDialog.body')}</p>
        </Dialog>
      )}
      {panel?.kind === 'rename' && (
        <TemplateNameDialog
          mode="rename"
          initialName={template.name}
          pending={rename.isPending}
          onSubmit={(name) => rename.mutateAsync(name)}
          onDone={() => {
            showToast({ tone: 'success', message: t('templateEditor.renamed') })
            setPanel(null)
          }}
          onClose={() => setPanel(null)}
        />
      )}
    </>
  )
}
