import {
  Building2,
  Clock,
  Crown,
  Eye,
  Heart,
  Lock,
  Mail,
  Pencil,
  Search,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react'
import { useState, type FormEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { isDomainError } from '../../domain/errors.ts'
import { useFormatters } from '../../i18n/format.ts'
import type {
  ClientInviteRole,
  ClientTeamEntry,
  ClientTeamView,
  EventVenueInfo,
} from '../../services/contracts/index.ts'
import { describeError } from '../../shared/errorMessage.ts'
import { Avatar } from '../../shared/ui/Avatar.tsx'
import { Badge } from '../../shared/ui/Badge.tsx'
import { Button, IconButton } from '../../shared/ui/Button.tsx'
import { KpiCard, KpiGrid } from '../../shared/ui/Card.tsx'
import { DataTable, type Column } from '../../shared/ui/DataTable.tsx'
import { Dialog } from '../../shared/ui/Dialog.tsx'
import { SelectField, TextField } from '../../shared/ui/Field.tsx'
import { LtrText } from '../../shared/ui/LtrText.tsx'
import { Notice } from '../../shared/ui/Notice.tsx'
import { PageHeader } from '../../shared/ui/PageHeader.tsx'
import { ErrorState, LoadingState } from '../../shared/ui/States.tsx'
import { useToast } from '../../shared/ui/toastContext.ts'
import { ClientRoleBadge, VenueRoleBadge } from './RoleBadges.tsx'
import styles from './VenueEventPeoplePage.module.css'
import {
  useChangeClientTeamRole,
  useInviteToClientTeam,
  useRemoveFromClientTeam,
} from './venueMutations.ts'
import { useClientTeam } from './venueQueries.ts'

const INVITE_ROLES: readonly ClientInviteRole[] = [
  'CLIENT_EDITOR',
  'CLIENT_VIEWER',
]

type Member = ClientTeamView['members'][number]

type OpenDialog =
  | { kind: 'invite' }
  | { kind: 'role'; member: Member }
  | { kind: 'remove'; member: Member }

function Section({
  icon,
  title,
  side,
  subtitle,
  actions,
  children,
}: {
  icon: ReactNode
  title: string
  side: string
  subtitle: string
  actions?: ReactNode
  children: ReactNode
}) {
  return (
    <section className={styles.section} aria-label={title}>
      <header className={styles.sectionHeader}>
        <span className={styles.sectionIcon} aria-hidden="true">
          {icon}
        </span>
        <div className={styles.sectionText}>
          <h2 className={styles.sectionTitle}>
            {title} <span className={styles.side}>· {side}</span>
          </h2>
          <p className={styles.muted}>{subtitle}</p>
        </div>
        {actions && <div className={styles.sectionActions}>{actions}</div>}
      </header>
      {children}
    </section>
  )
}

function RoleSelect({
  value,
  onChange,
}: {
  value: ClientInviteRole
  onChange: (role: ClientInviteRole) => void
}) {
  const { t } = useTranslation()
  return (
    <SelectField
      label={t('clientTeam.role')}
      value={value}
      onChange={(change) =>
        onChange(
          change.target.value === 'CLIENT_VIEWER'
            ? 'CLIENT_VIEWER'
            : 'CLIENT_EDITOR',
        )
      }
    >
      {INVITE_ROLES.map((role) => (
        <option key={role} value={role}>
          {t(`clientRoles.${role}`)}
        </option>
      ))}
    </SelectField>
  )
}

function InviteDialog({
  eventId,
  onClose,
}: {
  eventId: string
  onClose: () => void
}) {
  const { t } = useTranslation()
  const { showToast } = useToast()
  const invite = useInviteToClientTeam(eventId)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<ClientInviteRole>('CLIENT_EDITOR')
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    invite.mutate(
      { email, role },
      {
        onSuccess: () => {
          showToast({
            tone: 'success',
            message: t('clientTeam.invite.sent', { email: email.trim() }),
          })
          onClose()
        },
        onError: (failure) =>
          setError(
            isDomainError(failure, 'VALIDATION')
              ? t('auth.errors.email')
              : isDomainError(failure, 'ALREADY_MEMBER')
                ? t('clientTeam.invite.alreadyMember')
                : isDomainError(failure, 'ALREADY_INVITED')
                  ? t('clientTeam.invite.alreadyInvited')
                  : isDomainError(failure, 'FORBIDDEN')
                    ? t('clientTeam.invite.venueMember')
                    : describeError(t, failure),
          ),
      },
    )
  }

  return (
    <Dialog open onClose={onClose} title={t('clientTeam.invite.title')}>
      <form className={styles.form} noValidate onSubmit={handleSubmit}>
        <TextField
          label={t('clientTeam.invite.email')}
          type="email"
          required
          value={email}
          error={error ?? undefined}
          onChange={(change) => {
            setEmail(change.target.value)
            setError(null)
          }}
        />
        <RoleSelect value={role} onChange={setRole} />
        <p className={styles.muted}>{t('clientTeam.invite.note')}</p>
        <div className={styles.dialogActions}>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" icon={<Mail />} loading={invite.isPending}>
            {t('clientTeam.invite.send')}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}

function RoleDialog({
  eventId,
  member,
  onClose,
}: {
  eventId: string
  member: Member
  onClose: () => void
}) {
  const { t } = useTranslation()
  const change = useChangeClientTeamRole(eventId)
  const [role, setRole] = useState<ClientInviteRole>(
    member.role === 'CLIENT_VIEWER' ? 'CLIENT_VIEWER' : 'CLIENT_EDITOR',
  )
  const [error, setError] = useState<string | null>(null)
  return (
    <Dialog
      open
      onClose={onClose}
      title={t('clientTeam.changeRole.title', {
        name: member.name ?? member.email,
      })}
    >
      <div className={styles.form}>
        <RoleSelect value={role} onChange={setRole} />
        {error && <Notice tone="danger" title={error} announce />}
        <div className={styles.dialogActions}>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            icon={<Pencil />}
            loading={change.isPending}
            onClick={() =>
              change.mutate(
                { email: member.email, role },
                {
                  onSuccess: onClose,
                  onError: (failure) => setError(describeError(t, failure)),
                },
              )
            }
          >
            {t('clientTeam.changeRole.save')}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}

function RemoveDialog({
  eventId,
  member,
  onClose,
}: {
  eventId: string
  member: Member
  onClose: () => void
}) {
  const { t } = useTranslation()
  const remove = useRemoveFromClientTeam(eventId)
  const [error, setError] = useState<string | null>(null)
  const name = member.name ?? member.email
  return (
    <Dialog
      open
      onClose={onClose}
      title={t('clientTeam.remove.title', { name })}
    >
      <div className={styles.form}>
        <p>{t('clientTeam.remove.body', { name })}</p>
        {error && <Notice tone="danger" title={error} announce />}
        <div className={styles.dialogActions}>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="danger"
            icon={<Trash2 />}
            loading={remove.isPending}
            onClick={() =>
              remove.mutate(member.email, {
                onSuccess: onClose,
                onError: (failure) => setError(describeError(t, failure)),
              })
            }
          >
            {t('clientTeam.remove.confirm')}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}

/**
 * The client side's Permissions page (V2.2, Phase 29b, mockup #15): the
 * lead's team, where the lead invites Editors and Viewers, and the venue's
 * team, read-only. It must be clear which side each person is on.
 */
export function ClientTeamPage({
  eventId,
  venue,
  canManage,
}: {
  eventId: string
  venue: EventVenueInfo
  /** The client lead, while the event hasn't started (MANAGE_PERMISSIONS). */
  canManage: boolean
}) {
  const { t } = useTranslation()
  const format = useFormatters()
  const team = useClientTeam(eventId)
  const [dialog, setDialog] = useState<OpenDialog | null>(null)
  const [query, setQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState('ALL')

  const header = (
    <>
      <PageHeader
        title={t('pages.permissions')}
        subtitle={t('clientTeam.subtitle')}
        actions={
          canManage && (
            <Button
              icon={<UserPlus />}
              onClick={() => setDialog({ kind: 'invite' })}
            >
              {t('clientTeam.invite.button')}
            </Button>
          )
        }
      />
      <p className={styles.managedLine}>
        <Badge tone="info" icon={<Building2 />}>
          {t('events.card.managedBy', { venue: venue.name })}
        </Badge>
      </p>
    </>
  )

  if (team.isPending) {
    return (
      <>
        {header}
        <LoadingState />
      </>
    )
  }
  if (team.isError) {
    return (
      <>
        {header}
        <ErrorState
          description={describeError(t, team.error)}
          onRetry={() => void team.refetch()}
        />
      </>
    )
  }

  const { members, venueTeam } = team.data
  const count = (role: ClientTeamEntry['role']) =>
    members.filter((member) => member.role === role).length
  const needle = query.trim().toLowerCase()
  const shown = members.filter(
    (member) =>
      (roleFilter === 'ALL' || member.role === roleFilter) &&
      (needle === '' ||
        (member.name ?? '').toLowerCase().includes(needle) ||
        member.email.includes(needle)),
  )

  const nameCell = (member: Member) =>
    member.pending ? (
      <span className={styles.rowPerson}>
        <Avatar name={member.email} />
        <span className={styles.muted}>{t('clientTeam.noAccount')}</span>
        <Badge tone="neutral" icon={<Clock />}>
          {t('clientTeam.pending')}
        </Badge>
      </span>
    ) : (
      <span className={styles.rowPerson}>
        <Avatar name={member.name ?? member.email} />
        <span className={styles.personName}>{member.name}</span>
      </span>
    )
  const sinceCell = (member: Member) => {
    const date = format.date(new Date(member.since))
    return member.pending ? t('clientTeam.invited', { date }) : date
  }
  const actionsCell = (member: Member) =>
    member.isYou ? (
      <Badge tone="neutral">{t('clientTeam.you')}</Badge>
    ) : canManage && member.role !== 'CLIENT_LEAD' ? (
      <span className={styles.personActions}>
        <Button
          variant="secondary"
          size="sm"
          icon={<Pencil />}
          aria-label={t('clientTeam.changeRole.named', {
            name: member.name ?? member.email,
          })}
          onClick={() => setDialog({ kind: 'role', member })}
        >
          {t('clientTeam.changeRole.button')}
        </Button>
        <IconButton
          label={t('clientTeam.remove.named', {
            name: member.name ?? member.email,
          })}
          variant="danger"
          onClick={() => setDialog({ kind: 'remove', member })}
        >
          <Trash2 />
        </IconButton>
      </span>
    ) : null
  const columns: Column<Member>[] = [
    { id: 'name', header: t('clientTeam.name'), cell: nameCell },
    {
      id: 'email',
      header: t('clientTeam.email'),
      cell: (member) => <LtrText>{member.email}</LtrText>,
    },
    {
      id: 'role',
      header: t('clientTeam.role'),
      align: 'center',
      cell: (member) => <ClientRoleBadge role={member.role} />,
    },
    {
      id: 'since',
      header: t('clientTeam.since'),
      align: 'center',
      cell: sinceCell,
    },
    {
      id: 'actions',
      header: t('clientTeam.actions'),
      hideHeader: true,
      align: 'end',
      cell: actionsCell,
    },
  ]
  type VenuePerson = ClientTeamView['venueTeam'][number]
  const venueColumns: Column<VenuePerson>[] = [
    {
      id: 'name',
      header: t('clientTeam.name'),
      cell: (person) => (
        <span className={styles.rowPerson}>
          <Avatar name={person.name} />
          <span className={styles.personName}>{person.name}</span>
        </span>
      ),
    },
    {
      id: 'email',
      header: t('clientTeam.email'),
      cell: (person) => <LtrText>{person.email}</LtrText>,
    },
    {
      id: 'role',
      header: t('clientTeam.role'),
      align: 'center',
      cell: (person) => <VenueRoleBadge role={person.role} />,
    },
  ]

  return (
    <>
      {header}
      <div className={styles.stack}>
        <Notice title={t('clientTeam.about.title')}>
          {t('clientTeam.about.body', { venue: venue.name })}
        </Notice>
        <KpiGrid label={t('clientTeam.kpis')} trio>
          <KpiCard
            label={t('clientRoles.CLIENT_LEAD')}
            value={format.number(count('CLIENT_LEAD'))}
            icon={<Crown />}
            tone="warning"
          />
          <KpiCard
            label={t('clientTeam.editors')}
            value={format.number(count('CLIENT_EDITOR'))}
            icon={<Pencil />}
            tone="info"
          />
          <KpiCard
            label={t('clientTeam.viewers')}
            value={format.number(count('CLIENT_VIEWER'))}
            icon={<Eye />}
            tone="neutral"
          />
        </KpiGrid>

        <Section
          icon={<Heart />}
          title={t('clientTeam.yours.title')}
          side={t('clientTeam.yours.side')}
          subtitle={t(
            canManage
              ? 'clientTeam.yours.subtitle'
              : 'clientTeam.yours.subtitleView',
          )}
        >
          <div className={styles.filters}>
            <div className={styles.search}>
              <TextField
                label={t('clientTeam.search')}
                hideLabel
                type="search"
                icon={<Search />}
                placeholder={t('clientTeam.search')}
                value={query}
                onChange={(change) => setQuery(change.target.value)}
              />
            </div>
            <SelectField
              label={t('clientTeam.roleFilter')}
              hideLabel
              value={roleFilter}
              onChange={(change) => setRoleFilter(change.target.value)}
            >
              <option value="ALL">{t('clientTeam.allRoles')}</option>
              {(['CLIENT_LEAD', ...INVITE_ROLES] as const).map((role) => (
                <option key={role} value={role}>
                  {t(`clientRoles.${role}`)}
                </option>
              ))}
            </SelectField>
          </div>
          {shown.length === 0 ? (
            <p className={styles.muted}>{t('clientTeam.noMatch')}</p>
          ) : (
            <DataTable
              caption={t('clientTeam.yours.title')}
              columns={columns}
              rows={shown}
              getRowKey={(member) =>
                `${member.pending ? 'p' : 'm'}-${member.email}`
              }
              renderCard={(member) => (
                <div className={styles.rowCard}>
                  <div className={styles.rowCardTop}>
                    {nameCell(member)}
                    <ClientRoleBadge role={member.role} />
                  </div>
                  <p className={styles.muted}>
                    <LtrText>{member.email}</LtrText>
                  </p>
                  <p className={styles.muted}>{sinceCell(member)}</p>
                  {actionsCell(member)}
                </div>
              )}
            />
          )}
        </Section>

        <Section
          icon={<Building2 />}
          title={t('clientTeam.venue.title', { venue: venue.name })}
          side={t('clientTeam.venue.side')}
          subtitle={t('clientTeam.venue.subtitle', { venue: venue.name })}
          actions={
            <Badge tone="neutral" icon={<Lock />}>
              {t('venueEventPeople.clientTeam.viewOnly')}
            </Badge>
          }
        >
          <DataTable
            caption={t('clientTeam.venue.title', { venue: venue.name })}
            columns={venueColumns}
            rows={venueTeam}
            getRowKey={(person) => person.email}
            renderCard={(person) => (
              <div className={styles.rowCard}>
                <div className={styles.rowCardTop}>
                  <span className={styles.personName}>{person.name}</span>
                  <VenueRoleBadge role={person.role} />
                </div>
                <p className={styles.muted}>
                  <LtrText>{person.email}</LtrText>
                </p>
              </div>
            )}
          />
          <p className={styles.note}>
            <Users aria-hidden="true" />
            {t('clientTeam.venue.privacy')}
          </p>
        </Section>
      </div>

      {dialog?.kind === 'invite' && (
        <InviteDialog eventId={eventId} onClose={() => setDialog(null)} />
      )}
      {dialog?.kind === 'role' && (
        <RoleDialog
          eventId={eventId}
          member={dialog.member}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === 'remove' && (
        <RemoveDialog
          eventId={eventId}
          member={dialog.member}
          onClose={() => setDialog(null)}
        />
      )}
    </>
  )
}
