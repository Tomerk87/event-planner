import {
  Armchair,
  ArrowUpDown,
  CircleCheck,
  Download,
  Ellipsis,
  Pencil,
  Plus,
  Search,
  SearchX,
  Table2,
  Trash2,
  TriangleAlert,
  UserCheck,
  Users,
} from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router'
import { canEditEvent } from '../../domain/access.ts'
import { guestFullName } from '../../domain/guestList.ts'
import {
  computeDashboardMetrics,
  computeDashboardWarnings,
} from '../../domain/metrics.ts'
import { TABLE_SHAPES, type TableShape } from '../../domain/models.ts'
import { DEFAULT_PAGE_SIZE, PAGE_SIZES, paginate } from '../../domain/paging.ts'
import { partiesAt, tableStatus } from '../../domain/seating.ts'
import {
  DEFAULT_TABLE_SORT,
  filterTables,
  sortTables,
  TABLE_SORT_KEYS,
  type SeatedTable,
  type TableListSort,
  type TableSortKey,
} from '../../domain/tableList.ts'
import { useFormatters } from '../../i18n/format.ts'
import { useSeatingNotice } from '../dashboard/useSeatingNotice.ts'
import { WarningCards, type Warning } from '../dashboard/WarningCards.tsx'
import { useEventAccessInfo } from '../../services/queries.ts'
import { ReadOnlyNotice } from '../../shared/access/EventAccess.tsx'
import { useEventAccess } from '../../shared/access/eventAccessContext.ts'
import { describeError } from '../../shared/errorMessage.ts'
import { Button, IconButton } from '../../shared/ui/Button.tsx'
import { Card, KpiCard, KpiGrid } from '../../shared/ui/Card.tsx'
import { cx } from '../../shared/ui/cx.ts'
import { DataTable, type Column } from '../../shared/ui/DataTable.tsx'
import { SelectField, TextField } from '../../shared/ui/Field.tsx'
import { Menu } from '../../shared/ui/Menu.tsx'
import { PageHeader } from '../../shared/ui/PageHeader.tsx'
import { Pagination } from '../../shared/ui/Pagination.tsx'
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from '../../shared/ui/States.tsx'
import { Tabs } from '../../shared/ui/Tabs.tsx'
import { PHONE_QUERY, useMediaQuery } from '../../shared/useMediaQuery.ts'
import { useQueryParams } from '../../shared/useQueryParams.ts'
import type { FileFormat } from '../guests/guestFiles.ts'
import { tablesOf, useGuests, useTables } from '../guests/guestQueries.ts'
import guestStyles from '../guests/Guests.module.css'
import { ArrangementTab } from './ArrangementTab.tsx'
import { DeleteTableDialog } from './DeleteTableDialog.tsx'
import styles from './EventLayout.module.css'
import { ManageGuestsDialog } from './ManageGuestsDialog.tsx'
import { AttendeeCount, ShapeLabel, TableStatusBadge } from './TableBits.tsx'
import { TableDialog } from './TableDialog.tsx'
import { useSeatingExport } from './useSeatingExport.ts'

type OpenPanel =
  { kind: 'add' } | { kind: 'edit' | 'guests' | 'delete'; tableId: string }

/** The choices of the phone's sort menu; on desktop the headings sort. */
const PHONE_SORTS: {
  key: 'number' | 'available' | 'capacity'
  direction: TableListSort['direction']
}[] = [
  { key: 'number', direction: 'asc' },
  { key: 'number', direction: 'desc' },
  { key: 'available', direction: 'asc' },
  { key: 'available', direction: 'desc' },
  { key: 'capacity', direction: 'desc' },
  { key: 'capacity', direction: 'asc' },
]

function isShape(value: string | null): value is TableShape {
  return (TABLE_SHAPES as readonly string[]).includes(value ?? '')
}

function parseSort(value: string | null): TableListSort {
  const descending = value?.startsWith('-') ?? false
  const key = descending ? value?.slice(1) : value
  return (TABLE_SORT_KEYS as readonly string[]).includes(key ?? '')
    ? { key: key as TableSortKey, direction: descending ? 'desc' : 'asc' }
    : DEFAULT_TABLE_SORT
}

function sortParam(sort: TableListSort): string | null {
  if (
    sort.key === DEFAULT_TABLE_SORT.key &&
    sort.direction === DEFAULT_TABLE_SORT.direction
  ) {
    return null
  }
  return sort.direction === 'desc' ? `-${sort.key}` : sort.key
}

export function EventLayoutPage() {
  const { t } = useTranslation()
  const format = useFormatters()
  const { eventId = '' } = useParams()
  const isPhone = useMediaQuery(PHONE_QUERY)
  // Search, filter, sorting and paging live in the address.
  const { params, update: setParam } = useQueryParams()
  const access = useEventAccess()
  const canEdit = access !== null && canEditEvent(access)
  // The layout has already loaded the event, so this read comes from the cache.
  const info = useEventAccessInfo(eventId)
  const guests = useGuests(eventId)
  const tables = useTables(eventId)
  const [panel, setPanel] = useState<OpenPanel | null>(null)
  // One chosen table, shown in the Selected Table card on both tabs.
  const [chosenId, setChosenId] = useState<string | null>(null)
  const exportSeating = useSeatingExport(eventId, info.data?.event.name ?? '')
  const view = params.get('view') === 'arrangement' ? 'arrangement' : 'tables'

  const queries = [guests, tables]
  const failed = queries.find((query) => query.isError)
  const event = info.data?.event
  const guestList = guests.data ?? []
  const tableList: readonly SeatedTable[] = tables.data ?? []
  const ready =
    event !== undefined &&
    guests.data !== undefined &&
    tables.data !== undefined
  const number = format.number
  const tableName = (item: SeatedTable) =>
    t('layout.tableNumber', { number: number(item.table.number) })

  const onExport = (fileFormat: FileFormat) => void exportSeating(fileFormat)

  const actions = (
    <>
      {canEdit && (
        <Button
          icon={<Plus />}
          disabled={!ready}
          onClick={() => setPanel({ kind: 'add' })}
        >
          {t('layout.actions.add')}
        </Button>
      )}
      {/* Offered once the data is in, so a file is never written empty. */}
      {ready && (
        <Menu
          label={t('layout.actions.export')}
          triggerClassName={guestStyles.exportButton}
          items={[
            {
              id: 'csv',
              label: t('guests.actions.exportCsv'),
              onSelect: () => onExport('csv'),
            },
            {
              id: 'xlsx',
              label: t('guests.actions.exportXlsx'),
              onSelect: () => onExport('xlsx'),
            },
          ]}
        >
          <Download aria-hidden="true" />
          <span aria-hidden="true">{t('layout.actions.export')}</span>
        </Menu>
      )}
    </>
  )

  const shapeParam = params.get('shape')
  const filters = {
    query: params.get('q') ?? '',
    shape: isShape(shapeParam) ? shapeParam : ('ALL' as const),
  }
  const sort = parseSort(params.get('sort'))
  const sizeParam = Number(params.get('size'))
  const pageSize = (PAGE_SIZES as readonly number[]).includes(sizeParam)
    ? sizeParam
    : DEFAULT_PAGE_SIZE
  /** Changing what is listed returns to the first page. */
  const setFilter = (name: string, value: string | null) =>
    setParam({ [name]: value, page: null })

  const matching = sortTables(filterTables(tableList, filters), sort)
  const page = paginate(matching, Number(params.get('page') ?? 1), pageSize)
  const byId = new Map(tableList.map((item) => [item.table.id, item]))

  const metrics = computeDashboardMetrics(guestList, tablesOf(tables.data))
  const warnings = event
    ? computeDashboardWarnings(event, metrics, guestList, tablesOf(tables.data))
    : null
  const assignedAttendees =
    metrics.confirmedAttendees - metrics.unassignedConfirmedAttendees

  // A deleted table simply drops out of the choice.
  const chosen = chosenId ? (byId.get(chosenId) ?? null) : null
  const panelItem =
    panel && panel.kind !== 'add' ? (byId.get(panel.tableId) ?? null) : null
  const closePanel = () => setPanel(null)

  /** Chooses a table; choosing the chosen one again clears the choice. */
  function chooseTable(tableId: string) {
    setChosenId((current) => (current === tableId ? null : tableId))
  }

  /** Edit and Delete, for Owners and Admins of an upcoming event. */
  function menuItems(item: SeatedTable) {
    return [
      {
        id: 'edit',
        label: t('layout.selected.edit'),
        icon: <Pencil />,
        onSelect: () => setPanel({ kind: 'edit', tableId: item.table.id }),
      },
      {
        id: 'delete',
        label: t('layout.row.delete'),
        icon: <Trash2 />,
        tone: 'danger' as const,
        onSelect: () => setPanel({ kind: 'delete', tableId: item.table.id }),
      },
    ]
  }

  function rowActions(item: SeatedTable) {
    const name = tableName(item)
    return (
      <div className={guestStyles.rowActions}>
        <IconButton
          label={t(canEdit ? 'layout.row.manage' : 'layout.row.view', { name })}
          variant="ghost"
          onClick={() => setPanel({ kind: 'guests', tableId: item.table.id })}
        >
          <Users />
        </IconButton>
        {canEdit && (
          <Menu
            label={t('layout.row.more', { name })}
            triggerClassName={guestStyles.iconControl}
            items={menuItems(item)}
          >
            <Ellipsis aria-hidden="true" />
          </Menu>
        )}
      </div>
    )
  }

  const available = (item: SeatedTable) => (
    <span className={item.available < 0 ? styles.negative : undefined}>
      {number(item.available)}
    </span>
  )
  const status = (item: SeatedTable) => (
    <TableStatusBadge
      status={tableStatus(item.table.capacity, item.assigned)}
    />
  )

  const columns: Column<SeatedTable>[] = [
    {
      id: 'number',
      header: t('layout.columns.number'),
      sortable: true,
      align: 'center',
      cell: (item) => number(item.table.number),
    },
    {
      id: 'shape',
      header: t('layout.columns.shape'),
      sortable: true,
      cell: (item) => <ShapeLabel shape={item.table.shape} />,
    },
    {
      id: 'capacity',
      header: t('layout.columns.capacity'),
      sortable: true,
      align: 'center',
      cell: (item) => number(item.table.capacity),
    },
    {
      id: 'assigned',
      header: t('layout.columns.assigned'),
      sortable: true,
      align: 'center',
      cell: (item) => number(item.assigned),
    },
    {
      id: 'available',
      header: t('layout.columns.available'),
      sortable: true,
      align: 'center',
      cell: available,
    },
    {
      id: 'status',
      header: t('layout.columns.status'),
      sortable: true,
      cell: status,
    },
    {
      id: 'actions',
      header: t('layout.columns.actions'),
      hideHeader: true,
      pinned: true,
      cell: rowActions,
    },
  ]

  function renderCard(item: SeatedTable) {
    const name = tableName(item)
    return (
      <div className={styles.tableCard}>
        <div className={styles.cardTop}>
          <p className={styles.cardNumber}>{name}</p>
          {status(item)}
          {canEdit && (
            <Menu
              label={t('layout.row.more', { name })}
              triggerClassName={guestStyles.iconControl}
              items={menuItems(item)}
            >
              <Ellipsis aria-hidden="true" />
            </Menu>
          )}
        </div>
        <div className={styles.cardFacts}>
          <ShapeLabel shape={item.table.shape} />
          <dl className={styles.cardFigures}>
            <div>
              <dt>{t('layout.columns.capacity')}</dt>
              <dd>{number(item.table.capacity)}</dd>
            </div>
            <div>
              <dt>{t('layout.columns.assigned')}</dt>
              <dd>{number(item.assigned)}</dd>
            </div>
            <div>
              <dt>{t('layout.columns.available')}</dt>
              <dd>{available(item)}</dd>
            </div>
          </dl>
        </div>
        <div className={styles.cardActions}>
          <Button
            variant="secondary"
            size="sm"
            icon={<Users />}
            aria-label={t(canEdit ? 'layout.row.manage' : 'layout.row.view', {
              name,
            })}
            onClick={() => setPanel({ kind: 'guests', tableId: item.table.id })}
          >
            {t('layout.card.viewGuests', { count: number(item.assigned) })}
          </Button>
        </div>
      </div>
    )
  }

  const seating = useSeatingNotice(
    warnings && { metrics, warnings },
    event?.maxAttendees ?? 0,
  )
  // Seating as a whole, in cards of their own as on the Dashboard.
  const notices: Warning[] = []
  if (seating) {
    notices.push({
      id: 'seating',
      tone: seating.tone,
      icon: seating.tone === 'warning' ? TriangleAlert : CircleCheck,
      title: seating.title,
      lines: [seating.body],
    })
  }
  if (warnings && warnings.attendeesAwaitingTable > 0) {
    notices.push({
      id: 'awaitingTable',
      tone: 'info',
      icon: Armchair,
      title: t('dashboard.warnings.awaitingTable.title'),
      lines: [
        t('dashboard.warnings.awaitingTable.body', {
          count: number(warnings.attendeesAwaitingTable),
        }),
      ],
      to: `/events/${eventId}/guests?rsvp=APPROVED&table=NONE`,
    })
  }
  // The Dashboard's row also has the guests over the maximum and the tables
  // over capacity; the cards here are as wide as there.
  const dashboardCards =
    notices.length +
    (warnings && warnings.attendeesOverMaximum > 0 ? 1 : 0) +
    ((warnings?.tablesOverCapacity.length ?? 0) > 0 ? 1 : 0)

  const selectedParties = chosen ? partiesAt(chosen.table.id, guestList) : []
  const selectedCard = (selected: SeatedTable) => (
    <Card title={t('layout.selected.title')} actions={status(selected)}>
      <div className={styles.selected}>
        <p className={styles.selectedName}>{tableName(selected)}</p>
        <dl className={styles.facts}>
          <div>
            <dt>{t('layout.columns.shape')}</dt>
            <dd>
              <ShapeLabel shape={selected.table.shape} />
            </dd>
          </div>
          <div>
            <dt>{t('layout.columns.capacity')}</dt>
            <dd>{number(selected.table.capacity)}</dd>
          </div>
          <div>
            <dt>{t('layout.columns.assigned')}</dt>
            <dd>{number(selected.assigned)}</dd>
          </div>
          <div>
            <dt>{t('layout.columns.available')}</dt>
            <dd>{available(selected)}</dd>
          </div>
        </dl>
        <h3 className={styles.sectionTitle}>
          {t('layout.selected.parties', {
            count: number(selectedParties.length),
          })}
        </h3>
        {selectedParties.length === 0 ? (
          <p className={styles.muted}>{t('layout.manage.noneSeated')}</p>
        ) : (
          <ul
            className={cx(styles.parties, styles.partiesScroll)}
            aria-label={t('layout.manage.seatedLabel')}
          >
            {selectedParties.map((guest) => (
              <li key={guest.id} className={styles.party}>
                <span className={styles.partyName}>{guestFullName(guest)}</span>
                <span className={styles.muted}>
                  <AttendeeCount count={guest.confirmedAttendees ?? 0} />
                </span>
              </li>
            ))}
          </ul>
        )}
        {canEdit && (
          <div className={styles.selectedActions}>
            <Button
              variant="secondary"
              icon={<Pencil />}
              onClick={() =>
                setPanel({ kind: 'edit', tableId: selected.table.id })
              }
            >
              {t('layout.selected.edit')}
            </Button>
            <Button
              icon={<Users />}
              onClick={() =>
                setPanel({ kind: 'guests', tableId: selected.table.id })
              }
            >
              {t('layout.selected.manage')}
            </Button>
          </div>
        )}
      </div>
    </Card>
  )

  /** The chosen table, or how to choose one, beside the list or the plan. */
  const side = chosen ? (
    selectedCard(chosen)
  ) : (
    <Card title={t('layout.selected.title')}>
      <p className={styles.muted}>
        {t(
          view === 'arrangement'
            ? 'layout.arrangement.selectHint'
            : 'layout.selected.hintList',
        )}
      </p>
    </Card>
  )

  const kpis = [
    { id: 'tables', value: tableList.length, icon: Table2, tone: 'info' },
    {
      id: 'capacity',
      value: metrics.seatingCapacity,
      icon: Users,
      tone: 'info',
    },
    {
      id: 'assigned',
      value: assignedAttendees,
      icon: UserCheck,
      tone: 'success',
    },
    {
      id: 'available',
      value: metrics.seatingCapacity - assignedAttendees,
      icon: Armchair,
      tone: 'warning',
    },
  ] as const

  const tablesCard = (
    <Card title={t('layout.list.title')}>
      {tableList.length === 0 ? (
        <EmptyState
          icon={<Table2 />}
          title={t('layout.empty.title')}
          description={t(
            canEdit ? 'layout.empty.body' : 'layout.empty.bodyReadOnly',
          )}
          action={
            canEdit && (
              <Button icon={<Plus />} onClick={() => setPanel({ kind: 'add' })}>
                {t('layout.actions.add')}
              </Button>
            )
          }
        />
      ) : (
        <div className={guestStyles.stack}>
          <div className={guestStyles.toolbar}>
            <div className={guestStyles.search}>
              <TextField
                label={t('layout.search.label')}
                hideLabel
                type="search"
                inputMode="numeric"
                icon={<Search />}
                placeholder={t('layout.search.placeholder')}
                value={filters.query}
                onChange={(change) => setFilter('q', change.target.value)}
              />
            </div>
            <div className={cx(guestStyles.filters, styles.filters)}>
              <SelectField
                label={t('layout.filters.shape')}
                hideLabel
                value={filters.shape}
                onChange={(change) =>
                  setFilter(
                    'shape',
                    change.target.value === 'ALL' ? null : change.target.value,
                  )
                }
              >
                <option value="ALL">{t('layout.filters.shapeAll')}</option>
                {TABLE_SHAPES.map((shape) => (
                  <option key={shape} value={shape}>
                    {t(`layout.shapes.${shape}`)}
                  </option>
                ))}
              </SelectField>
              {isPhone && (
                <Menu
                  label={t('layout.sort.label')}
                  triggerClassName={guestStyles.iconControl}
                  items={PHONE_SORTS.map((choice) => ({
                    id: `${choice.key}-${choice.direction}`,
                    label: t(`layout.sort.${choice.key}.${choice.direction}`),
                    onSelect: () =>
                      setParam({ sort: sortParam(choice), page: null }),
                  }))}
                >
                  <ArrowUpDown aria-hidden="true" />
                </Menu>
              )}
            </div>
          </div>
          {matching.length === 0 ? (
            <EmptyState
              icon={<SearchX />}
              title={t('layout.empty.noMatchTitle')}
              description={t('layout.empty.noMatchBody')}
            />
          ) : (
            <>
              <DataTable
                caption={t('layout.list.caption')}
                columns={columns}
                rows={page.items}
                getRowKey={(item) => item.table.id}
                renderCard={renderCard}
                activeKey={chosenId}
                onRowClick={(item) => chooseTable(item.table.id)}
                sort={{ columnId: sort.key, direction: sort.direction }}
                sortLabel={(column) => t('guests.table.sortBy', { column })}
                onSort={(columnId) =>
                  setParam({
                    sort: sortParam({
                      key: columnId as TableSortKey,
                      direction:
                        sort.key === columnId && sort.direction === 'asc'
                          ? 'desc'
                          : 'asc',
                    }),
                    page: null,
                  })
                }
              />
              <div className={guestStyles.footer}>
                <div className={guestStyles.pageSize}>
                  <SelectField
                    label={t('guests.pagination.rowsPerPage')}
                    value={String(pageSize)}
                    onChange={(change) =>
                      setParam({
                        size:
                          change.target.value === String(DEFAULT_PAGE_SIZE)
                            ? null
                            : change.target.value,
                        page: null,
                      })
                    }
                  >
                    {PAGE_SIZES.map((size) => (
                      <option key={size} value={size}>
                        {number(size)}
                      </option>
                    ))}
                  </SelectField>
                </div>
                <p className={guestStyles.range} role="status">
                  {t('layout.pagination.range', {
                    from: number(page.from),
                    to: number(page.to),
                    total: number(page.total),
                  })}
                </p>
                <Pagination
                  label={t('layout.pagination.label')}
                  page={page.page}
                  pageCount={page.pageCount}
                  previousLabel={t('guests.pagination.previous')}
                  nextLabel={t('guests.pagination.next')}
                  pageLabel={(pageNumber) =>
                    t('guests.pagination.page', { page: number(pageNumber) })
                  }
                  formatNumber={number}
                  onPage={(pageNumber) =>
                    setParam({
                      page: pageNumber === 1 ? null : String(pageNumber),
                    })
                  }
                />
              </div>
            </>
          )}
        </div>
      )}
    </Card>
  )

  return (
    <>
      <PageHeader
        title={t('pages.eventLayout')}
        subtitle={t('layout.subtitle')}
        actions={actions}
      />
      {failed ? (
        <Card>
          <ErrorState
            description={describeError(t, failed.error)}
            onRetry={() => queries.forEach((query) => void query.refetch())}
          />
        </Card>
      ) : !ready ? (
        <Card>
          <LoadingState />
        </Card>
      ) : (
        <div className={guestStyles.stack}>
          <ReadOnlyNotice />
          <div className={styles.tabs}>
            <Tabs
              label={t('layout.tabs.label')}
              variant="segmented"
              value={view}
              onChange={(id) =>
                setParam({ view: id === 'arrangement' ? id : null })
              }
              tabs={[
                { id: 'tables', label: t('layout.tabs.tables') },
                { id: 'arrangement', label: t('layout.tabs.arrangement') },
              ]}
            />
          </div>
          <KpiGrid label={t('layout.kpis.label')}>
            {kpis.map(({ id, value, icon: Icon, tone }) => (
              <KpiCard
                key={id}
                label={t(`layout.kpis.${id}`)}
                value={number(value)}
                icon={<Icon />}
                tone={tone}
              />
            ))}
          </KpiGrid>
          <WarningCards
            label={t('dashboard.warnings.label')}
            warnings={notices}
            slots={dashboardCards}
          />
          {view === 'arrangement' ? (
            <ArrangementTab
              eventId={eventId}
              tables={tableList}
              chosenId={chosen?.table.id ?? null}
              onChooseTable={chooseTable}
              canEdit={canEdit}
              isPhone={isPhone}
              onAddTable={() => setPanel({ kind: 'add' })}
              side={side}
            />
          ) : (
            <div className={styles.withSide}>
              {tablesCard}
              {side}
            </div>
          )}
        </div>
      )}
      <TableDialog
        open={panel?.kind === 'add' || (panel?.kind === 'edit' && !!panelItem)}
        onClose={closePanel}
        eventId={eventId}
        tables={tableList}
        editing={panel?.kind === 'edit' ? panelItem : null}
      />
      <DeleteTableDialog
        open={panel?.kind === 'delete' && !!panelItem}
        onClose={closePanel}
        onDeleted={() =>
          setChosenId((current) =>
            current === panelItem?.table.id ? null : current,
          )
        }
        eventId={eventId}
        item={panel?.kind === 'delete' ? panelItem : null}
        parties={
          panelItem ? partiesAt(panelItem.table.id, guestList).length : 0
        }
      />
      <ManageGuestsDialog
        open={panel?.kind === 'guests'}
        onClose={closePanel}
        eventId={eventId}
        item={panel?.kind === 'guests' ? panelItem : null}
        tables={tableList}
        guests={guestList}
        canEdit={canEdit}
      />
    </>
  )
}
