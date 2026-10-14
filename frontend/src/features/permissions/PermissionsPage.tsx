import {
  Clock,
  Lock,
  Pencil,
  Plus,
  Search,
  SearchX,
  Trash2,
} from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router'
import {
  canManagePermissions,
  canOpenPermissions,
  manageableRoles,
} from '../../domain/access.ts'
import {
  countMembersByRole,
  filterAccessRows,
  toAccessRows,
  type AccessRow,
} from '../../domain/memberList.ts'
import { EVENT_ROLES, type EventRole } from '../../domain/roles.ts'
import { useFormatters } from '../../i18n/format.ts'
import { useDemoRole } from '../../services/queries.ts'
import { useEventAccess } from '../../shared/access/eventAccessContext.ts'
import { describeError } from '../../shared/errorMessage.ts'
import { Avatar } from '../../shared/ui/Avatar.tsx'
import { Badge, type Tone } from '../../shared/ui/Badge.tsx'
import { Button, IconButton } from '../../shared/ui/Button.tsx'
import { Card, KpiCard, KpiGrid } from '../../shared/ui/Card.tsx'
import { DataTable, type Column } from '../../shared/ui/DataTable.tsx'
import { SelectField, TextField } from '../../shared/ui/Field.tsx'
import { LtrText } from '../../shared/ui/LtrText.tsx'
import { Notice } from '../../shared/ui/Notice.tsx'
import { PageHeader } from '../../shared/ui/PageHeader.tsx'
import { RoleIcon } from '../../shared/ui/RoleIcon.tsx'
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from '../../shared/ui/States.tsx'
import { useQueryParams } from '../../shared/useQueryParams.ts'
import guestStyles from '../guests/Guests.module.css'
import { ChangeRoleDialog } from './ChangeRoleDialog.tsx'
import { InviteDialog } from './InviteDialog.tsx'
import { useAccessList } from './permissionQueries.ts'
import styles from './Permissions.module.css'
import { RemoveAccessDialog } from './RemoveAccessDialog.tsx'

type OpenPanel = { kind: 'invite' } | { kind: 'change' | 'remove'; key: string }

const ROLE_TONES: Record<EventRole, Tone> = {
  OWNER: 'warning',
  ADMIN: 'info',
  VIEWER: 'neutral',
}

function isRole(value: string | null): value is EventRole {
  return (EVENT_ROLES as readonly string[]).includes(value ?? '')
}

export function PermissionsPage() {
  const { t } = useTranslation()
  const format = useFormatters()
  const { eventId = '' } = useParams()
  // Search and the role filter live in the address.
  const { params, update: setParam } = useQueryParams()
  const access = useEventAccess()
  const mayOpen = access !== null && canOpenPermissions(access.role)
  const canManage = access !== null && canManagePermissions(access)
  const roles = access ? manageableRoles(access) : []
  const list = useAccessList(eventId, mayOpen)
  const demoRole = useDemoRole()
  const [panel, setPanel] = useState<OpenPanel | null>(null)

  const header = (actions?: React.ReactNode) => (
    <PageHeader
      title={t('pages.permissions')}
      subtitle={t('permissions.subtitle')}
      actions={actions}
    />
  )

  if (!mayOpen) {
    return (
      <>
        {header()}
        <Card>
          <EmptyState
            icon={<Lock />}
            title={t('permissions.noAccess.title')}
            description={t('permissions.noAccess.body')}
          />
        </Card>
      </>
    )
  }

  const rows = list.data
    ? toAccessRows(list.data.members, list.data.invitations)
    : []
  const counts = countMembersByRole(rows)
  const roleParam = params.get('role')
  const filters = {
    query: params.get('q') ?? '',
    role: isRole(roleParam) ? roleParam : ('ALL' as const),
  }
  const matching = filterAccessRows(rows, filters)
  const panelRow =
    panel && panel.kind !== 'invite'
      ? (rows.find((row) => row.key === panel.key) ?? null)
      : null
  const closePanel = () => setPanel(null)
  const displayName = (row: AccessRow) => row.name ?? row.email
  /** Nobody changes their own permission, and an Admin leaves Owners alone. */
  const mayChange = (row: AccessRow) =>
    !row.isCurrentUser && roles.includes(row.role)

  const roleBadge = (row: AccessRow) => (
    <Badge tone={ROLE_TONES[row.role]} icon={<RoleIcon role={row.role} />}>
      {t(`roles.${row.role}`)}
    </Badge>
  )
  const pendingBadge = (row: AccessRow) =>
    row.kind === 'invitation' && (
      <Badge tone="neutral" icon={<Clock />}>
        {t('permissions.pending')}
      </Badge>
    )

  function rowActions(row: AccessRow, compact: boolean) {
    if (row.isCurrentUser) {
      return (
        <div className={guestStyles.rowActions}>
          <span className={styles.you}>{t('permissions.you')}</span>
        </div>
      )
    }
    if (!mayChange(row)) {
      return null
    }
    const name = displayName(row)
    const removeLabel = t(`permissions.row.remove.${row.kind}`, { name })
    return (
      <div className={guestStyles.rowActions}>
        {compact ? (
          <IconButton
            label={t('permissions.row.change', { name })}
            variant="secondary"
            onClick={() => setPanel({ kind: 'change', key: row.key })}
          >
            <Pencil />
          </IconButton>
        ) : (
          <Button
            variant="secondary"
            size="sm"
            icon={<Pencil />}
            aria-label={t('permissions.row.change', { name })}
            onClick={() => setPanel({ kind: 'change', key: row.key })}
          >
            {t('permissions.row.changeShort')}
          </Button>
        )}
        <IconButton
          label={removeLabel}
          variant="secondary"
          className={styles.remove}
          onClick={() => setPanel({ kind: 'remove', key: row.key })}
        >
          <Trash2 />
        </IconButton>
      </div>
    )
  }

  const columns: Column<AccessRow>[] = [
    {
      id: 'name',
      header: t('permissions.columns.name'),
      cell: (row) => (
        <span className={guestStyles.nameCell}>
          <Avatar name={displayName(row)} />
          <span className={styles.name}>
            {row.name ?? (
              <span className={styles.muted}>
                {t('permissions.noAccountYet')}
              </span>
            )}
          </span>
          {pendingBadge(row)}
        </span>
      ),
    },
    {
      id: 'email',
      header: t('permissions.columns.email'),
      wrap: true,
      cell: (row) => <LtrText>{row.email}</LtrText>,
    },
    {
      id: 'role',
      header: t('permissions.columns.role'),
      cell: roleBadge,
    },
    {
      id: 'actions',
      header: t('permissions.columns.actions'),
      hideHeader: true,
      pinned: true,
      cell: (row) => rowActions(row, false),
    },
  ]

  function renderCard(row: AccessRow) {
    return (
      <div className={styles.memberCard}>
        <Avatar name={displayName(row)} />
        <p className={styles.name}>
          {row.name ?? t('permissions.noAccountYet')}
        </p>
        <div className={styles.cardActions}>{rowActions(row, true)}</div>
        <p className={styles.email}>
          <LtrText>{row.email}</LtrText>
        </p>
        <div className={styles.badges}>
          {roleBadge(row)}
          {pendingBadge(row)}
        </div>
      </div>
    )
  }

  return (
    <>
      {header(
        canManage && (
          <Button
            icon={<Plus />}
            disabled={!list.data}
            onClick={() => setPanel({ kind: 'invite' })}
          >
            {t('permissions.actions.invite')}
          </Button>
        ),
      )}
      <div className={guestStyles.stack}>
        {!canManage && (
          <Notice tone="warning" title={t('permissions.pastEvent.title')}>
            {t('permissions.pastEvent.body')}
          </Notice>
        )}
        {demoRole.data && (
          <Notice
            title={t('permissions.simulation.title', {
              role: t(`demo.simulate.${demoRole.data}`),
            })}
          >
            {t('permissions.simulation.body')}
          </Notice>
        )}
        <Notice title={t('permissions.about.title')}>
          {t('permissions.about.body')}
        </Notice>
        {list.isPending ? (
          <Card>
            <LoadingState />
          </Card>
        ) : list.isError ? (
          <Card>
            <ErrorState
              description={describeError(t, list.error)}
              onRetry={() => void list.refetch()}
            />
          </Card>
        ) : (
          <>
            <KpiGrid label={t('permissions.kpis.label')} trio>
              {EVENT_ROLES.map((role) => (
                <KpiCard
                  key={role}
                  label={t(`permissions.kpis.${role}`)}
                  value={format.number(counts[role])}
                  icon={<RoleIcon role={role} />}
                  tone={ROLE_TONES[role]}
                />
              ))}
            </KpiGrid>
            <Card title={t('permissions.list.title')}>
              <div className={guestStyles.stack}>
                <div className={guestStyles.toolbar}>
                  <div className={guestStyles.search}>
                    <TextField
                      label={t('permissions.search.label')}
                      hideLabel
                      type="search"
                      icon={<Search />}
                      placeholder={t('permissions.search.placeholder')}
                      value={filters.query}
                      onChange={(change) =>
                        setParam({ q: change.target.value })
                      }
                    />
                  </div>
                  <div className={guestStyles.filters}>
                    <SelectField
                      label={t('permissions.filters.role')}
                      hideLabel
                      value={filters.role}
                      onChange={(change) =>
                        setParam({
                          role:
                            change.target.value === 'ALL'
                              ? null
                              : change.target.value,
                        })
                      }
                    >
                      <option value="ALL">
                        {t('permissions.filters.all')}
                      </option>
                      {EVENT_ROLES.map((role) => (
                        <option key={role} value={role}>
                          {t(`roles.${role}`)}
                        </option>
                      ))}
                    </SelectField>
                  </div>
                </div>
                {matching.length === 0 ? (
                  <EmptyState
                    icon={<SearchX />}
                    title={t('permissions.empty.title')}
                    description={t('permissions.empty.body')}
                  />
                ) : (
                  <DataTable
                    caption={t('permissions.list.caption')}
                    columns={columns}
                    rows={matching}
                    getRowKey={(row) => row.key}
                    renderCard={renderCard}
                  />
                )}
              </div>
            </Card>
          </>
        )}
      </div>
      <InviteDialog
        open={panel?.kind === 'invite'}
        onClose={closePanel}
        eventId={eventId}
        roles={roles}
      />
      <ChangeRoleDialog
        open={panel?.kind === 'change' && panelRow !== null}
        onClose={closePanel}
        eventId={eventId}
        row={panel?.kind === 'change' ? panelRow : null}
        roles={roles}
      />
      <RemoveAccessDialog
        open={panel?.kind === 'remove' && panelRow !== null}
        onClose={closePanel}
        eventId={eventId}
        row={panel?.kind === 'remove' ? panelRow : null}
      />
    </>
  )
}
