import {
  Clock,
  Crown,
  Mail,
  Pencil,
  RotateCw,
  Search,
  Shield,
  Trash2,
  UserPlus,
} from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router'
import { isDomainError } from '../../domain/errors.ts'
import {
  VENUE_MEMBER_ROLES,
  venueCan,
  type VenueMemberInvitation,
  type VenueMemberRole,
} from '../../domain/venues.ts'
import { useFormatters } from '../../i18n/format.ts'
import type { VenueMemberSummary } from '../../services/contracts/index.ts'
import { describeError } from '../../shared/errorMessage.ts'
import { Avatar } from '../../shared/ui/Avatar.tsx'
import { Badge } from '../../shared/ui/Badge.tsx'
import { Button, IconButton } from '../../shared/ui/Button.tsx'
import { Card, KpiCard, KpiGrid } from '../../shared/ui/Card.tsx'
import { DataTable, type Column } from '../../shared/ui/DataTable.tsx'
import { Dialog } from '../../shared/ui/Dialog.tsx'
import { SelectField, TextField } from '../../shared/ui/Field.tsx'
import { Notice } from '../../shared/ui/Notice.tsx'
import { PageHeader } from '../../shared/ui/PageHeader.tsx'
import { ErrorState, LoadingState } from '../../shared/ui/States.tsx'
import { useToast } from '../../shared/ui/toastContext.ts'
import { PHONE_QUERY, useMediaQuery } from '../../shared/useMediaQuery.ts'
import styles from './VenueTeamPage.module.css'
import {
  useCancelMemberInvitation,
  useChangeMemberRole,
  useInviteMember,
  useRemoveMember,
  useResendMemberInvitation,
} from './venueMutations.ts'
import { useVenueTeam, useVenueWorkspace } from './venueQueries.ts'

type Row =
  | { kind: 'member'; member: VenueMemberSummary }
  | { kind: 'invitation'; invitation: VenueMemberInvitation }

type OpenDialog =
  | { kind: 'invite' }
  | { kind: 'role'; member: VenueMemberSummary }
  | { kind: 'remove'; member: VenueMemberSummary }
  | { kind: 'cancel'; invitation: VenueMemberInvitation }

const ALL_ROLES = 'all'

function RoleBadge({ role }: { role: VenueMemberRole }) {
  const { t } = useTranslation()
  return role === 'VENUE_OWNER' ? (
    <Badge tone="warning" icon={<Crown />}>
      {t('venueRoles.VENUE_OWNER')}
    </Badge>
  ) : (
    <Badge tone="info" icon={<Shield />}>
      {t('venueRoles.VENUE_MANAGER')}
    </Badge>
  )
}

function InviteDialog({
  organizationId,
  onClose,
}: {
  organizationId: string
  onClose: () => void
}) {
  const { t } = useTranslation()
  const { showToast } = useToast()
  const invite = useInviteMember(organizationId)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<VenueMemberRole>('VENUE_MANAGER')
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    invite.mutate(
      { email, role },
      {
        onSuccess: () => {
          showToast({
            tone: 'success',
            message: t('venueTeam.inviteDialog.sent', { email: email.trim() }),
          })
          onClose()
        },
        onError: (failure) =>
          setError(
            isDomainError(failure, 'VALIDATION')
              ? t('auth.errors.email')
              : isDomainError(failure, 'ALREADY_MEMBER')
                ? t('venueTeam.inviteDialog.alreadyMember')
                : isDomainError(failure, 'ALREADY_INVITED')
                  ? t('venueTeam.inviteDialog.alreadyInvited')
                  : describeError(t, failure),
          ),
      },
    )
  }

  return (
    <Dialog open onClose={onClose} title={t('venueTeam.inviteDialog.title')}>
      <form className={styles.form} noValidate onSubmit={handleSubmit}>
        <TextField
          label={t('venueTeam.inviteDialog.email')}
          type="email"
          required
          value={email}
          error={error ?? undefined}
          onChange={(change) => {
            setEmail(change.target.value)
            setError(null)
          }}
        />
        <SelectField
          label={t('venueTeam.inviteDialog.role')}
          value={role}
          onChange={(change) => setRole(change.target.value as VenueMemberRole)}
        >
          {VENUE_MEMBER_ROLES.map((option) => (
            <option key={option} value={option}>
              {t(`venueRoles.${option}`)}
            </option>
          ))}
        </SelectField>
        <p className={styles.note}>{t('venueTeam.inviteDialog.demoNote')}</p>
        <div className={styles.actions}>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" icon={<Mail />} loading={invite.isPending}>
            {t('venueTeam.inviteDialog.send')}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}

function RoleDialog({
  organizationId,
  member,
  onClose,
}: {
  organizationId: string
  member: VenueMemberSummary
  onClose: () => void
}) {
  const { t } = useTranslation()
  const { showToast } = useToast()
  const change = useChangeMemberRole(organizationId)
  const [role, setRole] = useState<VenueMemberRole>(member.role)

  return (
    <Dialog open onClose={onClose} title={t('venueTeam.roleDialog.title')}>
      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault()
          change.mutate(
            { userId: member.userId, role },
            {
              onSuccess: () => {
                showToast({
                  tone: 'success',
                  message: t('venueTeam.roleDialog.saved'),
                })
                onClose()
              },
              onError: (failure) =>
                showToast({
                  tone: 'danger',
                  message: describeError(t, failure),
                }),
            },
          )
        }}
      >
        <SelectField
          label={t('venueTeam.roleDialog.role', { name: member.name })}
          value={role}
          onChange={(event) => setRole(event.target.value as VenueMemberRole)}
        >
          {VENUE_MEMBER_ROLES.map((option) => (
            <option key={option} value={option}>
              {t(`venueRoles.${option}`)}
            </option>
          ))}
        </SelectField>
        <div className={styles.actions}>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" loading={change.isPending}>
            {t('venueTeam.roleDialog.save')}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}

function ConfirmDialog({
  title,
  body,
  confirm,
  pending,
  onConfirm,
  onClose,
}: {
  title: string
  body: string
  confirm: string
  pending: boolean
  onConfirm: () => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  return (
    <Dialog
      open
      onClose={onClose}
      title={title}
      footer={
        <div className={styles.actions}>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button variant="danger" loading={pending} onClick={onConfirm}>
            {confirm}
          </Button>
        </div>
      }
    >
      <p>{body}</p>
    </Dialog>
  )
}

/** A venue's team (V2.2, mockup #7): the Owner manages it, a Manager reads it. */
export function VenueTeamPage() {
  const { t, i18n } = useTranslation()
  const format = useFormatters()
  const { organizationId = '' } = useParams()
  const workspace = useVenueWorkspace(organizationId)
  const team = useVenueTeam(organizationId)
  const remove = useRemoveMember(organizationId)
  const resend = useResendMemberInvitation(organizationId)
  const cancel = useCancelMemberInvitation(organizationId)
  const { showToast } = useToast()
  const isPhone = useMediaQuery(PHONE_QUERY)
  const [dialog, setDialog] = useState<OpenDialog | null>(null)
  const [query, setQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>(ALL_ROLES)

  const canManage = venueCan(workspace.data?.role ?? null, 'MANAGE_TEAM')
  const venueName = workspace.data?.organization.name ?? ''
  const members = team.data?.members ?? []
  const invitations = team.data?.invitations ?? []
  const needle = query.trim().toLocaleLowerCase(i18n.language)
  const matches = (role: VenueMemberRole, ...texts: string[]) =>
    (roleFilter === ALL_ROLES || roleFilter === role) &&
    texts.some((text) => text.toLocaleLowerCase(i18n.language).includes(needle))
  const rows: Row[] = [
    ...members
      .filter((member) => matches(member.role, member.name, member.email))
      .map((member): Row => ({ kind: 'member', member })),
    ...invitations
      .filter((invitation) => matches(invitation.role, invitation.email))
      .map((invitation): Row => ({ kind: 'invitation', invitation })),
  ]
  const total = members.length + invitations.length
  const fail = (error: unknown) =>
    showToast({ tone: 'danger', message: describeError(t, error) })
  const closeDialog = () => setDialog(null)

  function actions(row: Row) {
    if (row.kind === 'member' && row.member.isYou) {
      return <Badge tone="neutral">{t('venueTeam.members.you')}</Badge>
    }
    if (!canManage) {
      return null
    }
    if (row.kind === 'member') {
      const { member } = row
      return (
        <span className={styles.rowActions}>
          <Button
            variant="secondary"
            size="sm"
            icon={<Pencil />}
            aria-label={t('venueTeam.members.changeRoleNamed', {
              name: member.name,
            })}
            onClick={() => setDialog({ kind: 'role', member })}
          >
            {t('venueTeam.members.changeRole')}
          </Button>
          <IconButton
            variant="danger"
            label={t('venueTeam.members.remove', { name: member.name })}
            onClick={() => setDialog({ kind: 'remove', member })}
          >
            <Trash2 />
          </IconButton>
        </span>
      )
    }
    const { invitation } = row
    return (
      <span className={styles.rowActions}>
        <Button
          variant="secondary"
          size="sm"
          icon={<RotateCw />}
          aria-label={t('venueTeam.members.resendNamed', {
            email: invitation.email,
          })}
          onClick={() =>
            resend.mutate(invitation.email, {
              onSuccess: () =>
                showToast({
                  tone: 'success',
                  message: t('venueTeam.resent', { email: invitation.email }),
                }),
              onError: fail,
            })
          }
        >
          {t('venueTeam.members.resend')}
        </Button>
        <IconButton
          variant="danger"
          label={t('venueTeam.members.cancel', { email: invitation.email })}
          onClick={() => setDialog({ kind: 'cancel', invitation })}
        >
          <Trash2 />
        </IconButton>
      </span>
    )
  }

  const nameOf = (row: Row) =>
    row.kind === 'member' ? (
      <span className={styles.person}>
        <Avatar name={row.member.name} />
        <span className={styles.personName}>{row.member.name}</span>
      </span>
    ) : (
      <span className={styles.person}>
        <Avatar name={row.invitation.email} />
        <span className={styles.muted}>{t('venueTeam.members.noAccount')}</span>
        <Badge tone="neutral" icon={<Clock />}>
          {t('venueTeam.members.pending')}
        </Badge>
      </span>
    )
  const sinceOf = (row: Row) =>
    row.kind === 'member'
      ? row.member.since
        ? format.date(new Date(row.member.since))
        : '—'
      : t('venueTeam.members.invited', {
          date: format.date(new Date(row.invitation.sentAt)),
        })
  const roleOf = (row: Row) =>
    row.kind === 'member' ? row.member.role : row.invitation.role
  const emailOf = (row: Row) =>
    row.kind === 'member' ? row.member.email : row.invitation.email

  const columns: Column<Row>[] = [
    { id: 'name', header: t('venueTeam.members.columns.name'), cell: nameOf },
    {
      id: 'email',
      header: t('venueTeam.members.columns.email'),
      cell: (row) => <span dir="ltr">{emailOf(row)}</span>,
    },
    {
      id: 'role',
      header: t('venueTeam.members.columns.role'),
      align: 'center',
      cell: (row) => <RoleBadge role={roleOf(row)} />,
    },
    {
      id: 'since',
      header: t('venueTeam.members.columns.since'),
      align: 'center',
      cell: sinceOf,
    },
    {
      id: 'actions',
      header: t('venueTeam.members.columns.actions'),
      hideHeader: true,
      pinned: true,
      cell: actions,
    },
  ]

  const inviteButton = canManage && (
    <Button
      icon={<UserPlus />}
      fullWidth={isPhone}
      onClick={() => setDialog({ kind: 'invite' })}
    >
      {t('venueTeam.invite')}
    </Button>
  )

  return (
    <>
      <PageHeader
        title={t('venueNav.team')}
        subtitle={t('venueTeam.subtitle', { name: venueName })}
        actions={isPhone ? undefined : inviteButton || undefined}
      />
      {isPhone && inviteButton && (
        <div className={styles.section}>{inviteButton}</div>
      )}
      <div className={styles.section}>
        <Notice title={t('venueTeam.rolesNotice.title')}>
          {t('venueTeam.rolesNotice.body')}
        </Notice>
      </div>
      {!canManage && (
        <div className={styles.section}>
          <Notice tone="info" title={t('venueTeam.readOnly')} />
        </div>
      )}

      {team.isPending ? (
        <Card>
          <LoadingState />
        </Card>
      ) : team.isError ? (
        <Card>
          <ErrorState
            description={describeError(t, team.error)}
            onRetry={() => void team.refetch()}
          />
        </Card>
      ) : (
        <>
          <div className={styles.section}>
            <KpiGrid label={t('venueNav.team')} trio>
              <KpiCard
                label={t('venueTeam.kpi.owners')}
                value={format.number(
                  members.filter((m) => m.role === 'VENUE_OWNER').length,
                )}
                hint={t('venueTeam.kpi.people')}
                icon={<Crown />}
                tone="warning"
              />
              <KpiCard
                label={t('venueTeam.kpi.managers')}
                value={format.number(
                  members.filter((m) => m.role === 'VENUE_MANAGER').length,
                )}
                hint={t('venueTeam.kpi.people')}
                icon={<Shield />}
              />
              <KpiCard
                label={t('venueTeam.kpi.pending')}
                value={format.number(invitations.length)}
                hint={t('venueTeam.kpi.notAccepted')}
                icon={<Mail />}
                tone="neutral"
              />
            </KpiGrid>
          </div>
          <Card
            title={t('venueTeam.members.title')}
            subtitle={t('venueTeam.members.subtitle')}
          >
            <div className={styles.filters}>
              <div className={styles.search}>
                <TextField
                  label={t('venueTeam.members.search.label')}
                  hideLabel
                  type="search"
                  icon={<Search />}
                  placeholder={t('venueTeam.members.search.placeholder')}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </div>
              <div className={styles.roleFilter}>
                <SelectField
                  label={t('venueTeam.members.roleFilter')}
                  hideLabel
                  value={roleFilter}
                  onChange={(event) => setRoleFilter(event.target.value)}
                >
                  <option value={ALL_ROLES}>
                    {t('venueTeam.members.allRoles')}
                  </option>
                  {VENUE_MEMBER_ROLES.map((role) => (
                    <option key={role} value={role}>
                      {t(`venueRoles.${role}`)}
                    </option>
                  ))}
                </SelectField>
              </div>
            </div>
            {rows.length === 0 ? (
              <p className={styles.muted}>{t('venueTeam.members.noMatch')}</p>
            ) : (
              <DataTable
                caption={t('venueTeam.members.caption')}
                columns={columns}
                rows={rows}
                getRowKey={(row) =>
                  row.kind === 'member'
                    ? row.member.userId
                    : `invite-${row.invitation.email}`
                }
                renderCard={(row) => (
                  <div className={styles.memberCard}>
                    <div className={styles.memberCardTop}>
                      {nameOf(row)}
                      <RoleBadge role={roleOf(row)} />
                    </div>
                    <p className={styles.muted} dir="ltr">
                      {emailOf(row)}
                    </p>
                    <p className={styles.muted}>{sinceOf(row)}</p>
                    {actions(row)}
                  </div>
                )}
              />
            )}
            <p className={styles.showing}>
              {t('venueTeam.members.showing', {
                shown: format.number(rows.length),
                total: format.number(total),
              })}
            </p>
          </Card>
        </>
      )}

      {dialog?.kind === 'invite' && (
        <InviteDialog organizationId={organizationId} onClose={closeDialog} />
      )}
      {dialog?.kind === 'role' && (
        <RoleDialog
          organizationId={organizationId}
          member={dialog.member}
          onClose={closeDialog}
        />
      )}
      {dialog?.kind === 'remove' && (
        <ConfirmDialog
          title={t('venueTeam.removeDialog.title')}
          body={t('venueTeam.removeDialog.body', { name: dialog.member.name })}
          confirm={t('venueTeam.removeDialog.confirm')}
          pending={remove.isPending}
          onClose={closeDialog}
          onConfirm={() =>
            remove.mutate(dialog.member.userId, {
              onSuccess: () => {
                showToast({
                  tone: 'success',
                  message: t('venueTeam.removeDialog.done'),
                })
                closeDialog()
              },
              onError: fail,
            })
          }
        />
      )}
      {dialog?.kind === 'cancel' && (
        <ConfirmDialog
          title={t('venueTeam.cancelDialog.title')}
          body={t('venueTeam.cancelDialog.body', {
            email: dialog.invitation.email,
          })}
          confirm={t('venueTeam.cancelDialog.confirm')}
          pending={cancel.isPending}
          onClose={closeDialog}
          onConfirm={() =>
            cancel.mutate(dialog.invitation.email, {
              onSuccess: () => {
                showToast({
                  tone: 'success',
                  message: t('venueTeam.cancelDialog.done'),
                })
                closeDialog()
              },
              onError: fail,
            })
          }
        />
      )}
    </>
  )
}
