import {
  ChevronRight,
  Download,
  Ellipsis,
  MessageCircle,
  Pencil,
  RefreshCw,
  Search,
  SearchX,
  Tags,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  DEFAULT_GUEST_SORT,
  filterGuests,
  GUEST_SORT_KEYS,
  guestFullName,
  hasActiveFilters,
  sortGuests,
  type GuestFilters,
  type GuestSort,
  type GuestSortKey,
} from '../../domain/guestList.ts'
import { listGroups } from '../../domain/guests.ts'
import { guestDisplayStatus } from '../../domain/guestStatus.ts'
import {
  RSVP_STATUSES,
  type Event,
  type Guest,
  type RsvpStatus,
} from '../../domain/models.ts'
import { DEFAULT_PAGE_SIZE, PAGE_SIZES, paginate } from '../../domain/paging.ts'
import { useFormatters } from '../../i18n/format.ts'
import type { TableWithOccupancy } from '../../services/contracts/index.ts'
import { describeError } from '../../shared/errorMessage.ts'
import { Avatar } from '../../shared/ui/Avatar.tsx'
import { Button, IconButton } from '../../shared/ui/Button.tsx'
import { Card } from '../../shared/ui/Card.tsx'
import { DataTable, type Column } from '../../shared/ui/DataTable.tsx'
import { SelectField, TextField } from '../../shared/ui/Field.tsx'
import { LtrText } from '../../shared/ui/LtrText.tsx'
import { Menu } from '../../shared/ui/Menu.tsx'
import { Pagination } from '../../shared/ui/Pagination.tsx'
import { EmptyState } from '../../shared/ui/States.tsx'
import { useToast } from '../../shared/ui/toastContext.ts'
import { PHONE_QUERY, useMediaQuery } from '../../shared/useMediaQuery.ts'
import { useQueryParams } from '../../shared/useQueryParams.ts'
import { SendMessageDialog } from '../messages/SendMessageDialog.tsx'
import { ColumnChooser } from './ColumnChooser.tsx'
import { useTableOptions } from './TableOptions.tsx'
import { DeleteGuestsDialog } from './DeleteGuestsDialog.tsx'
import { GroupDialog } from './GroupDialog.tsx'
import { resolveGuestColumns, type GuestColumnId } from './guestColumns.ts'
import { GuestDetailsDrawer } from './GuestDetailsDrawer.tsx'
import type { FileFormat } from './guestFiles.ts'
import { GuestFormDialog } from './GuestFormDialog.tsx'
import {
  tablesOf,
  useAssignTable,
  useGuestColumns,
  useSetGuestColumns,
} from './guestQueries.ts'
import styles from './Guests.module.css'
import { GuestStatusBadge } from './GuestStatusBadge.tsx'
import { RsvpDialog } from './RsvpDialog.tsx'

const NONE = '—'
const NO_TABLE = 'NONE'
// The address value for "guests in no group"; not a name a group would have.
const NO_GROUP = '~none'

type OpenPanel =
  | { kind: 'edit' | 'rsvp' | 'details' | 'send'; guestId: string }
  | { kind: 'delete'; guestIds: string[] }
  | { kind: 'group' }

function isRsvpStatus(value: string | null): value is RsvpStatus {
  return (RSVP_STATUSES as readonly string[]).includes(value ?? '')
}

function parseSort(value: string | null): GuestSort {
  const descending = value?.startsWith('-') ?? false
  const key = descending ? value?.slice(1) : value
  return (GUEST_SORT_KEYS as readonly string[]).includes(key ?? '')
    ? { key: key as GuestSortKey, direction: descending ? 'desc' : 'asc' }
    : DEFAULT_GUEST_SORT
}

interface GuestsTabProps {
  eventId: string
  event: Event
  guests: readonly Guest[]
  tables: readonly TableWithOccupancy[]
  canEdit: boolean
  onAdd: () => void
  onExport: (format: FileFormat, guests: readonly Guest[]) => void
}

export function GuestsTab({
  eventId,
  event,
  guests,
  tables,
  canEdit,
  onAdd,
  onExport,
}: GuestsTabProps) {
  const { t, i18n } = useTranslation()
  const format = useFormatters()
  const { showToast } = useToast()
  const isPhone = useMediaQuery(PHONE_QUERY)
  // Search, filters, sorting and paging live in the address, so a reload keeps them.
  const { params, update: setParam } = useQueryParams()
  const [panel, setPanel] = useState<OpenPanel | null>(null)
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set())
  const storedColumns = useGuestColumns()
  const setColumns = useSetGuestColumns()
  const assignTable = useAssignTable(eventId)
  const tableOptions = useTableOptions()

  const eventTables = tablesOf(tables)
  const tableById = new Map(tables.map((item) => [item.table.id, item]))
  const tableParam = params.get('table')
  const rsvpParam = params.get('rsvp')
  const invitationParam = params.get('inv')
  const groupParam = params.get('group')
  const groups = listGroups(guests)
  const filters: GuestFilters = {
    query: params.get('q') ?? '',
    rsvp: isRsvpStatus(rsvpParam) ? rsvpParam : 'ALL',
    invitation:
      invitationParam === 'SENT' || invitationParam === 'NOT_SENT'
        ? invitationParam
        : 'ALL',
    table:
      tableParam === NO_TABLE
        ? 'NONE'
        : tableParam !== null && tableById.has(tableParam)
          ? tableParam
          : 'ALL',
    group:
      groupParam === NO_GROUP
        ? ''
        : groupParam !== null && groups.includes(groupParam)
          ? groupParam
          : null,
  }
  // The choice applies at once; storing it follows in the background.
  const [chosenColumns, setChosenColumns] = useState<GuestColumnId[] | null>(
    null,
  )
  const columns = chosenColumns ?? resolveGuestColumns(storedColumns.data)
  const requestedSort = parseSort(params.get('sort'))
  // Sorting by a column that is hidden would be invisible, so it falls back.
  const sort = columns.includes(requestedSort.key)
    ? requestedSort
    : DEFAULT_GUEST_SORT
  const sizeParam = Number(params.get('size'))
  const pageSize = (PAGE_SIZES as readonly number[]).includes(sizeParam)
    ? sizeParam
    : DEFAULT_PAGE_SIZE

  /** Changing what is listed returns to the first page. */
  const setFilter = (name: string, value: string | null) =>
    setParam({ [name]: value, page: null })

  const matching = sortGuests(
    filterGuests(guests, filters, i18n.language),
    sort,
    eventTables,
    i18n.language,
  )
  const page = paginate(matching, Number(params.get('page') ?? 1), pageSize)
  const guestById = new Map(guests.map((guest) => [guest.id, guest]))
  // Guests deleted elsewhere drop out of the selection.
  const selectedGuests = [...selected].flatMap((id) => guestById.get(id) ?? [])
  const panelGuest =
    panel && panel.kind !== 'delete' && panel.kind !== 'group'
      ? (guestById.get(panel.guestId) ?? null)
      : null
  const closePanel = () => setPanel(null)

  const tableNumber = (guest: Guest) =>
    guest.tableId === null
      ? null
      : (tableById.get(guest.tableId)?.table.number ?? null)
  const tableLabel = (guest: Guest) => {
    const number = tableNumber(guest)
    return number === null
      ? null
      : t('guests.filters.tableOption', { number: format.number(number) })
  }

  function changeTable(guest: Guest, value: string) {
    assignTable.mutate(
      { guestId: guest.id, tableId: value === NO_TABLE ? null : value },
      {
        onError: (error) =>
          showToast({ tone: 'danger', message: describeError(t, error) }),
      },
    )
  }

  function tableControl(guest: Guest) {
    if (guest.rsvpStatus !== 'APPROVED') {
      return <span className={styles.muted}>{NONE}</span>
    }
    if (!canEdit) {
      return tableLabel(guest) ?? t('guests.table.noTable')
    }
    return (
      <div className={styles.tableSelect}>
        <SelectField
          label={t('guests.table.tableFor', { name: guestFullName(guest) })}
          hideLabel
          value={guest.tableId ?? NO_TABLE}
          disabled={assignTable.isPending}
          onChange={(change) => changeTable(guest, change.target.value)}
        >
          <option value={NO_TABLE}>{NONE}</option>
          {tableOptions(tables, guest.tableId)}
        </SelectField>
      </div>
    )
  }

  function rowActions(guest: Guest) {
    const name = guestFullName(guest)
    return (
      <div className={styles.rowActions}>
        {canEdit && (
          <>
            <IconButton
              label={t('guests.row.whatsapp', { name })}
              className={styles.whatsapp}
              onClick={() => setPanel({ kind: 'send', guestId: guest.id })}
            >
              <MessageCircle />
            </IconButton>
            <Menu
              label={t('guests.row.more', { name })}
              triggerClassName={styles.iconControl}
              items={[
                {
                  id: 'edit',
                  label: t('guests.row.editGuest'),
                  icon: <Pencil />,
                  onSelect: () => setPanel({ kind: 'edit', guestId: guest.id }),
                },
                {
                  id: 'rsvp',
                  label: t('guests.row.changeRsvp'),
                  icon: <RefreshCw />,
                  onSelect: () => setPanel({ kind: 'rsvp', guestId: guest.id }),
                },
                {
                  id: 'delete',
                  label: t('guests.row.delete'),
                  icon: <Trash2 />,
                  tone: 'danger',
                  onSelect: () =>
                    setPanel({ kind: 'delete', guestIds: [guest.id] }),
                },
              ]}
            >
              <Ellipsis aria-hidden="true" />
            </Menu>
          </>
        )}
        {isPhone && (
          <IconButton
            label={t('guests.row.details', { name })}
            onClick={() => setPanel({ kind: 'details', guestId: guest.id })}
          >
            <ChevronRight className={styles.directional} />
          </IconButton>
        )}
      </div>
    )
  }

  const cells: Record<GuestColumnId, Column<Guest>> = {
    name: {
      id: 'name',
      header: t('guests.columns.name'),
      sortable: true,
      wrap: true,
      cell: (guest) => (
        <span className={styles.nameCell}>
          <Avatar name={guestFullName(guest)} />
          <button
            type="button"
            className={styles.nameButton}
            title={t('guests.row.details', { name: guestFullName(guest) })}
            onClick={() => setPanel({ kind: 'details', guestId: guest.id })}
          >
            {guestFullName(guest)}
          </button>
        </span>
      ),
    },
    invitationName: {
      id: 'invitationName',
      header: t('guests.columns.invitationName'),
      sortable: true,
      wrap: true,
      cell: (guest) => guest.invitationName ?? NONE,
    },
    phone: {
      id: 'phone',
      header: t('guests.columns.phone'),
      sortable: true,
      cell: (guest) => <LtrText>{guest.phone}</LtrText>,
    },
    group: {
      id: 'group',
      header: t('guests.columns.group'),
      sortable: true,
      wrap: true,
      cell: (guest) => guest.group ?? NONE,
    },
    allowed: {
      id: 'allowed',
      header: t('guests.columns.allowed'),
      sortable: true,
      align: 'center',
      cell: (guest) => format.number(guest.allowedAttendees),
    },
    confirmed: {
      id: 'confirmed',
      header: t('guests.columns.confirmed'),
      sortable: true,
      align: 'center',
      cell: (guest) =>
        guest.confirmedAttendees === null
          ? NONE
          : format.number(guest.confirmedAttendees),
    },
    status: {
      id: 'status',
      header: t('guests.columns.status'),
      sortable: true,
      cell: (guest) => <GuestStatusBadge status={guestDisplayStatus(guest)} />,
    },
    sent: {
      id: 'sent',
      header: t('guests.columns.sent'),
      sortable: true,
      align: 'center',
      cell: (guest) => format.number(guest.invitationSentCount),
    },
    table: {
      id: 'table',
      header: t('guests.columns.table'),
      sortable: true,
      align: 'center',
      cell: tableControl,
    },
  }
  const tableColumns: Column<Guest>[] = [
    ...columns.map((column) => cells[column]),
    {
      id: 'actions',
      header: t('guests.columns.actions'),
      hideHeader: true,
      pinned: true,
      cell: rowActions,
    },
  ]

  function renderCard(guest: Guest) {
    const name = guestFullName(guest)
    const number = tableNumber(guest)
    return (
      <div className={styles.guestCard}>
        <div className={styles.cardTop}>
          <Avatar name={name} />
          <div className={styles.cardIdentity}>
            <p className={styles.cardName}>{name}</p>
            <p className={styles.muted}>{guest.invitationName ?? NONE}</p>
            <p className={styles.muted}>
              <LtrText>{guest.phone}</LtrText>
            </p>
          </div>
          <GuestStatusBadge status={guestDisplayStatus(guest)} />
        </div>
        <ul className={styles.cardFacts}>
          <li>
            {t('guests.card.allowed', {
              count: format.number(guest.allowedAttendees),
            })}
          </li>
          <li>
            {t('guests.card.confirmed', {
              count:
                guest.confirmedAttendees === null
                  ? NONE
                  : format.number(guest.confirmedAttendees),
            })}
          </li>
          <li>
            {t('guests.card.sent', {
              count: format.number(guest.invitationSentCount),
            })}
          </li>
          <li>
            {number === null
              ? t('guests.table.noTable')
              : t('guests.filters.tableOption', {
                  number: format.number(number),
                })}
          </li>
        </ul>
        {canEdit && guest.rsvpStatus === 'APPROVED' && tableControl(guest)}
        {rowActions(guest)}
      </div>
    )
  }

  const filtered = hasActiveFilters(filters)
  const exportItems = (list: readonly Guest[]) => [
    {
      id: 'csv',
      label: t('guests.actions.exportCsv'),
      onSelect: () => onExport('csv', list),
    },
    {
      id: 'xlsx',
      label: t('guests.actions.exportXlsx'),
      onSelect: () => onExport('xlsx', list),
    },
  ]

  // Kept in place whether or not the list is empty: deleting the last
  // guest must still finish, and close, its dialog.
  const dialogs = (
    <>
      <GuestFormDialog
        open={panel?.kind === 'edit' && panelGuest !== null}
        onClose={closePanel}
        eventId={eventId}
        defaultAllowedAttendees={event.defaultAllowedAttendees}
        country={event.country}
        groups={groups}
        tables={tables}
        guest={panel?.kind === 'edit' ? panelGuest : null}
      />
      <RsvpDialog
        open={panel?.kind === 'rsvp' && panelGuest !== null}
        onClose={closePanel}
        eventId={eventId}
        maxPerGuest={event.defaultAllowedAttendees}
        guest={panel?.kind === 'rsvp' ? panelGuest : null}
        tableNumber={panelGuest ? tableNumber(panelGuest) : null}
      />
      <GuestDetailsDrawer
        open={panel?.kind === 'details' && panelGuest !== null}
        onClose={closePanel}
        guest={panel?.kind === 'details' ? panelGuest : null}
        tableLabel={panelGuest ? tableLabel(panelGuest) : null}
        canEdit={canEdit}
        onEdit={() =>
          panelGuest && setPanel({ kind: 'edit', guestId: panelGuest.id })
        }
        onChangeRsvp={() =>
          panelGuest && setPanel({ kind: 'rsvp', guestId: panelGuest.id })
        }
      />
      <SendMessageDialog
        eventId={eventId}
        guest={
          panel?.kind === 'send' && panelGuest
            ? { id: panelGuest.id, name: guestFullName(panelGuest) }
            : null
        }
        onClose={closePanel}
      />
      <GroupDialog
        open={panel?.kind === 'group'}
        onClose={closePanel}
        onSaved={() => setSelected(new Set())}
        eventId={eventId}
        guests={selectedGuests}
        groups={groups}
      />
      <DeleteGuestsDialog
        open={panel?.kind === 'delete'}
        onClose={closePanel}
        onDeleted={() => setSelected(new Set())}
        eventId={eventId}
        guests={
          panel?.kind === 'delete'
            ? panel.guestIds.flatMap((id) => guestById.get(id) ?? [])
            : []
        }
      />
    </>
  )

  const empty = (
    <Card>
      <EmptyState
        icon={<Users />}
        title={t('guests.empty.title')}
        description={t(
          canEdit ? 'guests.empty.body' : 'guests.empty.bodyReadOnly',
        )}
        action={
          canEdit && (
            <Button icon={<UserPlus />} onClick={onAdd}>
              {t('guests.actions.add')}
            </Button>
          )
        }
      />
    </Card>
  )

  return (
    <div className={styles.stack}>
      {guests.length === 0 ? (
        empty
      ) : (
        <>
          <div className={styles.toolbar}>
            <div className={styles.search}>
              <TextField
                label={t('guests.search.label')}
                hideLabel
                type="search"
                icon={<Search />}
                placeholder={t('guests.search.placeholder')}
                value={filters.query}
                onChange={(change) => setFilter('q', change.target.value)}
              />
            </div>
            <div className={styles.filters}>
              <SelectField
                label={t('guests.filters.rsvp')}
                hideLabel
                value={filters.rsvp}
                onChange={(change) =>
                  setFilter(
                    'rsvp',
                    change.target.value === 'ALL' ? null : change.target.value,
                  )
                }
              >
                <option value="ALL">{t('guests.filters.rsvpAll')}</option>
                {RSVP_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {t(`guests.rsvp.${status}`)}
                  </option>
                ))}
              </SelectField>
              <SelectField
                label={t('guests.filters.invitation')}
                hideLabel
                value={filters.invitation}
                onChange={(change) =>
                  setFilter(
                    'inv',
                    change.target.value === 'ALL' ? null : change.target.value,
                  )
                }
              >
                <option value="ALL">{t('guests.filters.invitationAll')}</option>
                <option value="SENT">{t('guests.filters.sent')}</option>
                <option value="NOT_SENT">{t('guests.filters.notSent')}</option>
              </SelectField>
              <SelectField
                label={t('guests.filters.table')}
                hideLabel
                value={filters.table === 'NONE' ? NO_TABLE : filters.table}
                onChange={(change) =>
                  setFilter(
                    'table',
                    change.target.value === 'ALL' ? null : change.target.value,
                  )
                }
              >
                <option value="ALL">{t('guests.filters.tableAll')}</option>
                <option value={NO_TABLE}>{t('guests.table.noTable')}</option>
                {[...eventTables]
                  .sort((a, b) => a.number - b.number)
                  .map((table) => (
                    <option key={table.id} value={table.id}>
                      {t('guests.filters.tableOption', {
                        number: format.number(table.number),
                      })}
                    </option>
                  ))}
              </SelectField>
              {groups.length > 0 && (
                <SelectField
                  label={t('guests.filters.group')}
                  hideLabel
                  value={
                    filters.group === '' ? NO_GROUP : (filters.group ?? 'ALL')
                  }
                  onChange={(change) =>
                    setParam({
                      group:
                        change.target.value === 'ALL'
                          ? null
                          : change.target.value,
                      page: null,
                    })
                  }
                >
                  <option value="ALL">{t('guests.filters.groupAll')}</option>
                  <option value={NO_GROUP}>
                    {t('guests.filters.groupNone')}
                  </option>
                  {groups.map((group) => (
                    <option key={group} value={group}>
                      {group}
                    </option>
                  ))}
                </SelectField>
              )}
              {!isPhone && (
                <ColumnChooser
                  visible={columns}
                  onChange={(next) => {
                    setChosenColumns(next)
                    setColumns.mutate(next)
                  }}
                />
              )}
              {filtered && (
                <Button
                  variant="ghost"
                  icon={<X />}
                  onClick={() =>
                    setParam({
                      q: null,
                      rsvp: null,
                      inv: null,
                      table: null,
                      group: null,
                      page: null,
                    })
                  }
                >
                  {t('guests.filters.clear')}
                </Button>
              )}
            </div>
          </div>

          {!isPhone && selectedGuests.length > 0 && (
            <div
              className={styles.bulkBar}
              role="region"
              aria-label={t('guests.bulk.label')}
            >
              <p className={styles.bulkCount} role="status">
                {t('guests.bulk.selected', {
                  count: format.number(selectedGuests.length),
                })}
              </p>
              <Menu
                label={t('guests.bulk.export')}
                align="start"
                triggerClassName={styles.bulkButton}
                items={exportItems(selectedGuests)}
              >
                <Download aria-hidden="true" />
                <span aria-hidden="true">{t('guests.bulk.export')}</span>
              </Menu>
              {canEdit && (
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<Tags />}
                  onClick={() => setPanel({ kind: 'group' })}
                >
                  {t('guests.bulk.group.action')}
                </Button>
              )}
              {canEdit && (
                <Button
                  variant="danger"
                  size="sm"
                  icon={<Trash2 />}
                  onClick={() =>
                    setPanel({
                      kind: 'delete',
                      guestIds: selectedGuests.map((guest) => guest.id),
                    })
                  }
                >
                  {t('guests.bulk.delete')}
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelected(new Set())}
              >
                {t('guests.bulk.clear')}
              </Button>
            </div>
          )}

          {matching.length === 0 ? (
            <Card>
              <EmptyState
                icon={<SearchX />}
                title={t('guests.empty.noMatchTitle')}
                description={t('guests.empty.noMatchBody')}
              />
            </Card>
          ) : (
            <>
              <DataTable
                caption={t('guests.table.caption')}
                columns={tableColumns}
                rows={page.items}
                getRowKey={(guest) => guest.id}
                renderCard={renderCard}
                sort={{ columnId: sort.key, direction: sort.direction }}
                sortLabel={(column) => t('guests.table.sortBy', { column })}
                onSort={(columnId) =>
                  setParam({
                    sort:
                      sort.key === columnId && sort.direction === 'asc'
                        ? `-${columnId}`
                        : columnId === DEFAULT_GUEST_SORT.key &&
                            sort.key === columnId
                          ? null
                          : columnId,
                    page: null,
                  })
                }
                selection={{
                  selected,
                  allLabel: t('guests.table.selectAll'),
                  rowLabel: (guest) =>
                    t('guests.table.selectRow', { name: guestFullName(guest) }),
                  onToggle: (id, isSelected) =>
                    setSelected((current) => {
                      const next = new Set(current)
                      if (isSelected) {
                        next.add(id)
                      } else {
                        next.delete(id)
                      }
                      return next
                    }),
                  onToggleAll: (isSelected) =>
                    setSelected((current) => {
                      const next = new Set(current)
                      for (const guest of page.items) {
                        if (isSelected) {
                          next.add(guest.id)
                        } else {
                          next.delete(guest.id)
                        }
                      }
                      return next
                    }),
                }}
              />
              <div className={styles.footer}>
                <div className={styles.pageSize}>
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
                        {format.number(size)}
                      </option>
                    ))}
                  </SelectField>
                </div>
                <p className={styles.range} role="status">
                  {t('guests.pagination.range', {
                    from: format.number(page.from),
                    to: format.number(page.to),
                    total: format.number(page.total),
                  })}
                </p>
                <Pagination
                  label={t('guests.pagination.label')}
                  page={page.page}
                  pageCount={page.pageCount}
                  previousLabel={t('guests.pagination.previous')}
                  nextLabel={t('guests.pagination.next')}
                  pageLabel={(number) =>
                    t('guests.pagination.page', { page: format.number(number) })
                  }
                  formatNumber={format.number}
                  onPage={(number) =>
                    setParam({ page: number === 1 ? null : String(number) })
                  }
                />
              </div>
            </>
          )}
        </>
      )}
      {dialogs}
    </div>
  )
}
