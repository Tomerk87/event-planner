import {
  Ban,
  Building2,
  ChevronRight,
  CircleAlert,
  Clock,
  ExternalLink,
  Heart,
  History,
  Mail,
  Minus,
  RotateCw,
  UserPlus,
  Users,
  Check,
  Lock,
  Repeat,
} from 'lucide-react'
import {
  createContext,
  useContext,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate, useParams } from 'react-router'
import { isDomainError } from '../../domain/errors.ts'
import { venueCan } from '../../domain/venues.ts'
import { useFormatters } from '../../i18n/format.ts'
import type {
  ClientTeamEntry,
  VenueEventPeople,
  VenueMemberSummary,
} from '../../services/contracts/index.ts'
import { describeError } from '../../shared/errorMessage.ts'
import { Avatar } from '../../shared/ui/Avatar.tsx'
import { Badge } from '../../shared/ui/Badge.tsx'
import { Button, IconButton } from '../../shared/ui/Button.tsx'
import { ButtonLink } from '../../shared/ui/ButtonLink.tsx'
import { cx } from '../../shared/ui/cx.ts'
import { DataTable, type Column } from '../../shared/ui/DataTable.tsx'
import { Dialog } from '../../shared/ui/Dialog.tsx'
import { TextField } from '../../shared/ui/Field.tsx'
import { LtrText } from '../../shared/ui/LtrText.tsx'
import { Notice } from '../../shared/ui/Notice.tsx'
import { PageHeader } from '../../shared/ui/PageHeader.tsx'
import { ErrorState, LoadingState } from '../../shared/ui/States.tsx'
import { useToast } from '../../shared/ui/toastContext.ts'
import { VenueStatusBadge } from './VenueEventCard.tsx'
import { ClientRoleBadge, VenueRoleBadge } from './RoleBadges.tsx'
import styles from './VenueEventPeoplePage.module.css'
import {
  useInviteClient,
  useResendClientInvitation,
  useRevokeClientInvitation,
} from './venueMutations.ts'
import { useVenueEventPeople, useVenueWorkspace } from './venueQueries.ts'

type OpenDialog = 'invite' | 'different' | 'revoke' | null

/** A section with the round icon the mockup gives each one (#10). */
function Section({
  icon,
  title,
  subtitle,
  actions,
  children,
}: {
  icon: ReactNode
  title: string
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
          <h2 className={styles.sectionTitle}>{title}</h2>
          <p className={styles.muted}>{subtitle}</p>
        </div>
        {actions && <div className={styles.sectionActions}>{actions}</div>}
      </header>
      {children}
    </section>
  )
}

function Facts({
  items,
}: {
  items: { label: string; value: string; warn?: boolean }[]
}) {
  return (
    <dl className={styles.facts}>
      {items.map((item) => (
        <div key={item.label}>
          <dt>{item.label}</dt>
          <dd className={cx(item.warn && styles.warnText)}>{item.value}</dd>
        </div>
      ))}
    </dl>
  )
}

function InviteDialog({
  organizationId,
  eventId,
  replacing,
  onClose,
}: {
  organizationId: string
  eventId: string
  /** The address a different client replaces, if any. */
  replacing: string | null
  onClose: () => void
}) {
  const { t } = useTranslation()
  const { showToast } = useToast()
  const invite = useInviteClient(organizationId, eventId)
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    invite.mutate(email, {
      onSuccess: () => {
        showToast({
          tone: 'success',
          message: t('venueEventPeople.inviteDialog.sent', {
            email: email.trim(),
          }),
        })
        onClose()
      },
      onError: (failure) =>
        setError(
          isDomainError(failure, 'VALIDATION') &&
            failure.details['field'] === 'client'
            ? t('venueEventPeople.inviteDialog.joined')
            : isDomainError(failure, 'VALIDATION')
              ? t('auth.errors.email')
              : describeError(t, failure),
        ),
    })
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={t(
        replacing
          ? 'venueEventPeople.inviteDialog.titleDifferent'
          : 'venueEventPeople.inviteDialog.title',
      )}
    >
      <form className={styles.form} noValidate onSubmit={handleSubmit}>
        <p className={styles.muted}>
          {replacing
            ? t('venueEventPeople.inviteDialog.introDifferent', {
                email: replacing,
              })
            : t('venueEventPeople.inviteDialog.intro')}
        </p>
        <TextField
          label={t('venueEventPeople.inviteDialog.email')}
          type="email"
          required
          value={email}
          error={error ?? undefined}
          onChange={(change) => {
            setEmail(change.target.value)
            setError(null)
          }}
        />
        <p className={styles.muted}>
          {t('venueEventPeople.inviteDialog.demoNote')}
        </p>
        <div className={styles.dialogActions}>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" icon={<Mail />} loading={invite.isPending}>
            {t('venueEventPeople.inviteDialog.send')}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}

function RevokeDialog({
  organizationId,
  eventId,
  email,
  onClose,
}: {
  organizationId: string
  eventId: string
  email: string
  onClose: () => void
}) {
  const { t } = useTranslation()
  const { showToast } = useToast()
  const revoke = useRevokeClientInvitation(organizationId, eventId)
  const [error, setError] = useState<string | null>(null)
  return (
    <Dialog
      open
      onClose={onClose}
      title={t('venueEventPeople.revokeDialog.title')}
    >
      <div className={styles.form}>
        <p>{t('venueEventPeople.revokeDialog.body', { email })}</p>
        {error && <Notice tone="danger" title={error} announce />}
        <div className={styles.dialogActions}>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="danger"
            icon={<Ban />}
            loading={revoke.isPending}
            onClick={() =>
              revoke.mutate(undefined, {
                onSuccess: () => {
                  showToast({
                    tone: 'success',
                    message: t('venueEventPeople.revokeDialog.done'),
                  })
                  onClose()
                },
                onError: (failure) => setError(describeError(t, failure)),
              })
            }
          >
            {t('venueEventPeople.revokeDialog.confirm')}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}

function ClientCard({
  people,
  canManage,
  onOpen,
}: {
  people: VenueEventPeople
  canManage: boolean
  onOpen: (dialog: OpenDialog) => void
}) {
  const { t } = useTranslation()
  const format = useFormatters()
  const { organizationId, eventId } = useContext(PeopleIds)
  const { showToast } = useToast()
  const resend = useResendClientInvitation(organizationId, eventId)
  const { summary, client, venue } = people
  const { status, event } = summary
  const zone = event.timeZone
  const date = (iso: string) => format.date(new Date(iso), zone)
  const lead = people.clientTeam.find((entry) => entry.role === 'CLIENT_LEAD')
  const joined = client?.acceptedAt != null
  const expired = status === 'INVITATION_EXPIRED'
  const pending = client !== null && !joined && status !== 'PAST'
  const firstName = (client?.name ?? '').split(' ')[0] ?? ''

  function doResend() {
    resend.mutate(undefined, {
      onSuccess: () =>
        showToast({
          tone: 'success',
          message: t('venueEventPeople.resent', { email: client?.email }),
        }),
      onError: (failure) =>
        showToast({ tone: 'danger', message: describeError(t, failure) }),
    })
  }

  const resendButton = (primary: boolean) => (
    <Button
      variant={primary ? 'primary' : 'secondary'}
      icon={<RotateCw />}
      loading={resend.isPending}
      onClick={doResend}
    >
      {t('venueEventPeople.client.resend')}
    </Button>
  )

  return (
    <Section
      icon={<Heart />}
      title={t('venueEventPeople.client.title')}
      subtitle={t('venueEventPeople.client.subtitle')}
      actions={
        <>
          <VenueStatusBadge status={status} />
          {expired && canManage && resendButton(true)}
        </>
      }
    >
      {client === null && status !== 'PAST' && (
        <>
          <div className={styles.empty}>
            <span className={styles.emptyIcon} aria-hidden="true">
              <UserPlus />
            </span>
            <h3 className={styles.emptyTitle}>
              {t('venueEventPeople.client.noneTitle')}
            </h3>
            <p className={styles.muted}>
              {t('venueEventPeople.client.noneBody')}
            </p>
            {canManage && (
              <Button icon={<Mail />} onClick={() => onOpen('invite')}>
                {t('venueEventPeople.client.invite')}
              </Button>
            )}
          </div>
          <div className={styles.canDo}>
            <h3 className={styles.canDoTitle}>
              {t('venueEventPeople.client.canDo')}
            </h3>
            <ul className={styles.canDoList}>
              <li>
                <Check aria-hidden="true" />
                {t('venueEventPeople.client.can1')}
              </li>
              <li>
                <Check aria-hidden="true" />
                {t('venueEventPeople.client.can2')}
              </li>
              <li className={styles.cannot}>
                <Minus aria-hidden="true" />
                {t('venueEventPeople.client.cannot', { venue: venue.name })}
              </li>
            </ul>
          </div>
        </>
      )}

      {client === null && status === 'PAST' && (
        <p className={styles.muted}>
          {t('venueEventPeople.client.pastNoClient')}
        </p>
      )}

      {client !== null && (
        <>
          <div className={styles.person}>
            <Avatar name={joined ? client.name : client.email} />
            <div className={styles.personText}>
              <span className={styles.personName}>
                {joined ? client.name : <LtrText>{client.email}</LtrText>}
                {joined && <ClientRoleBadge role="CLIENT_LEAD" />}
              </span>
              <span className={styles.muted}>
                {joined ? (
                  <LtrText>{client.email}</LtrText>
                ) : expired || status === 'PAST' ? (
                  t('venueEventPeople.client.didNotAccept')
                ) : (
                  t('venueEventPeople.client.notAccepted')
                )}
              </span>
            </div>
            <div className={styles.personActions}>
              {joined && (
                <ButtonLink
                  to={`mailto:${client.email}`}
                  variant="secondary"
                  icon={<Mail />}
                >
                  {t('venueEventPeople.client.email', { name: firstName })}
                </ButtonLink>
              )}
              {pending && canManage && (
                <>
                  {!expired && resendButton(false)}
                  <Button
                    variant="secondary"
                    icon={<Repeat />}
                    onClick={() => onOpen('different')}
                  >
                    {t('venueEventPeople.client.different')}
                  </Button>
                  <IconButton
                    label={t('venueEventPeople.client.revoke')}
                    variant="danger"
                    onClick={() => onOpen('revoke')}
                  >
                    <Ban />
                  </IconButton>
                </>
              )}
            </div>
          </div>

          {joined ? (
            <Facts
              items={[
                {
                  label: t('venueEventPeople.client.joinedOn'),
                  value: date(client.acceptedAt ?? client.sentAt),
                },
                {
                  label: t('venueEventPeople.client.invitedBy'),
                  value:
                    client.sentByName ?? t('venueEventPeople.client.unknown'),
                },
                {
                  label: t('venueEventPeople.client.clientTeam'),
                  value: t('venueEventPeople.client.people', {
                    count: people.clientTeam.length,
                  }),
                },
                {
                  label: t('venueEventPeople.client.guests'),
                  value: t('venueEventPeople.client.guestsCount', {
                    count: people.guestCount,
                  }),
                },
              ]}
            />
          ) : (
            <Facts
              items={[
                {
                  label: t('venueEventPeople.client.sentOn'),
                  value: date(client.sentAt),
                },
                {
                  label: t('venueEventPeople.client.sentBy'),
                  value:
                    client.sentByName ?? t('venueEventPeople.client.unknown'),
                },
                {
                  label: t(
                    expired
                      ? 'venueEventPeople.client.expiredOn'
                      : 'venueEventPeople.client.expiresOn',
                  ),
                  value: date(client.expiresAt),
                  warn: expired,
                },
                {
                  label: t('venueEventPeople.client.timesSent'),
                  value: format.number(client.timesSent),
                },
              ]}
            />
          )}

          {status === 'PAST' ? (
            <div className={styles.pastNotice}>
              <History aria-hidden="true" />
              <div>
                <p className={styles.pastTitle}>
                  {t('venueEventPeople.client.pastTitle')}
                </p>
                <p>
                  {t('venueEventPeople.client.pastBody', {
                    name: lead?.name ?? client.name,
                  })}
                </p>
              </div>
            </div>
          ) : expired ? (
            <Notice
              tone="warning"
              title={t('venueEventPeople.client.expiredTitle')}
            >
              {t('venueEventPeople.client.expiredBody')}
            </Notice>
          ) : (
            <p className={styles.note}>
              <CircleAlert aria-hidden="true" />
              {joined
                ? t('venueEventPeople.client.joinedNote', {
                    name: firstName,
                    venue: venue.name,
                  })
                : t('venueEventPeople.client.sentNote')}
            </p>
          )}

          {pending && people.demoLinkToken && (
            <div className={styles.demoLink}>
              <span>{t('venueEventPeople.client.demoLink')}</span>
              <ButtonLink
                to={`/client-invitations/${people.demoLinkToken}`}
                variant="soft"
                icon={<ExternalLink />}
              >
                {t('venueEventPeople.client.openLink')}
              </ButtonLink>
            </div>
          )}
        </>
      )}
    </Section>
  )
}

function ClientTeamSection({ people }: { people: VenueEventPeople }) {
  const { t } = useTranslation()
  const format = useFormatters()
  const zone = people.summary.event.timeZone
  const lead = people.clientTeam.find((entry) => entry.role === 'CLIENT_LEAD')
  const nameCell = (entry: ClientTeamEntry) =>
    entry.pending ? (
      <span className={styles.rowPerson}>
        <Avatar name={entry.email} />
        <span className={styles.muted}>
          {t('venueEventPeople.clientTeam.noAccount')}
        </span>
        <Badge tone="neutral" icon={<Clock />}>
          {t('venueEventPeople.clientTeam.pending')}
        </Badge>
      </span>
    ) : (
      <span className={styles.rowPerson}>
        <Avatar name={entry.name ?? entry.email} />
        <span className={styles.personName}>{entry.name}</span>
      </span>
    )
  const sinceCell = (entry: ClientTeamEntry) => {
    const date = format.date(new Date(entry.since), zone)
    return entry.pending
      ? t('venueEventPeople.clientTeam.invited', { date })
      : date
  }
  const columns: Column<ClientTeamEntry>[] = [
    {
      id: 'name',
      header: t('venueEventPeople.clientTeam.name'),
      cell: nameCell,
    },
    {
      id: 'email',
      header: t('venueEventPeople.clientTeam.email'),
      cell: (entry) => <LtrText>{entry.email}</LtrText>,
    },
    {
      id: 'role',
      header: t('venueEventPeople.clientTeam.role'),
      align: 'center',
      cell: (entry) => <ClientRoleBadge role={entry.role} />,
    },
    {
      id: 'since',
      header: t('venueEventPeople.clientTeam.since'),
      align: 'end',
      cell: sinceCell,
    },
  ]
  return (
    <Section
      icon={<Users />}
      title={t('venueEventPeople.clientTeam.title')}
      subtitle={
        lead
          ? t('venueEventPeople.clientTeam.subtitleJoined', {
              name: (lead.name ?? '').split(' ')[0],
            })
          : t('venueEventPeople.clientTeam.subtitle')
      }
      actions={
        <Badge tone="neutral" icon={<Lock />}>
          {t('venueEventPeople.clientTeam.viewOnly')}
        </Badge>
      }
    >
      {people.clientTeam.length === 0 ? (
        <div className={styles.teamEmpty}>
          <span className={styles.emptyIcon} aria-hidden="true">
            <Users />
          </span>
          <p className={styles.muted}>
            {t('venueEventPeople.clientTeam.empty')}
          </p>
        </div>
      ) : (
        <DataTable
          caption={t('venueEventPeople.clientTeam.caption')}
          columns={columns}
          rows={people.clientTeam}
          getRowKey={(entry) => `${entry.pending ? 'p' : 'm'}-${entry.email}`}
          renderCard={(entry) => (
            <div className={styles.rowCard}>
              <div className={styles.rowCardTop}>
                {nameCell(entry)}
                <ClientRoleBadge role={entry.role} />
              </div>
              <p className={styles.muted}>
                <LtrText>{entry.email}</LtrText>
              </p>
              <p className={styles.muted}>{sinceCell(entry)}</p>
            </div>
          )}
        />
      )}
    </Section>
  )
}

function VenueTeamSection({ people }: { people: VenueEventPeople }) {
  const { t } = useTranslation()
  const { organizationId } = useContext(PeopleIds)
  const nameCell = (member: VenueMemberSummary) => (
    <span className={styles.rowPerson}>
      <Avatar name={member.name} />
      <span className={styles.personName}>{member.name}</span>
      {member.isYou && (
        <Badge tone="neutral">{t('venueEventPeople.venueTeam.you')}</Badge>
      )}
    </span>
  )
  const columns: Column<VenueMemberSummary>[] = [
    {
      id: 'name',
      header: t('venueEventPeople.clientTeam.name'),
      cell: nameCell,
    },
    {
      id: 'email',
      header: t('venueEventPeople.clientTeam.email'),
      cell: (member) => <LtrText>{member.email}</LtrText>,
    },
    {
      id: 'role',
      header: t('venueEventPeople.clientTeam.role'),
      align: 'center',
      cell: (member) => <VenueRoleBadge role={member.role} />,
    },
  ]
  return (
    <Section
      icon={<Building2 />}
      title={t('venueEventPeople.venueTeam.title')}
      subtitle={t('venueEventPeople.venueTeam.subtitle', {
        venue: people.venue.name,
      })}
      actions={
        <ButtonLink
          to={`/venues/${organizationId}/team`}
          variant="secondary"
          icon={<ChevronRight className={styles.directional} />}
          iconPosition="end"
        >
          {t('venueEventPeople.venueTeam.open')}
        </ButtonLink>
      }
    >
      <DataTable
        caption={t('venueEventPeople.venueTeam.caption')}
        columns={columns}
        rows={people.venueTeam}
        getRowKey={(member) => member.userId}
        renderCard={(member) => (
          <div className={styles.rowCard}>
            <div className={styles.rowCardTop}>
              {nameCell(member)}
              <VenueRoleBadge role={member.role} />
            </div>
            <p className={styles.muted}>
              <LtrText>{member.email}</LtrText>
            </p>
          </div>
        )}
      />
    </Section>
  )
}

/** The venue and event the sections below belong to. */
const PeopleIds = createContext({ organizationId: '', eventId: '' })

/**
 * Who works on a venue event, as the venue sees it (mockups #10, #15): the
 * client card in each status, the client's team (view only) and the venue's
 * own team. The event's Permissions page shows it to the venue (Phase 29).
 */
export function VenueEventPermissions({
  organizationId,
  eventId,
}: {
  organizationId: string
  eventId: string
}) {
  const { t } = useTranslation()
  const workspace = useVenueWorkspace(organizationId)
  const people = useVenueEventPeople(organizationId, eventId)
  const [dialog, setDialog] = useState<OpenDialog>(null)
  const header = (
    <PageHeader
      title={t('venueEventPeople.title')}
      subtitle={t('venueEventPeople.subtitle')}
    />
  )

  if (people.isPending || workspace.isPending) {
    return (
      <>
        {header}
        <LoadingState />
      </>
    )
  }
  if (people.isError || !workspace.data) {
    return (
      <>
        {header}
        <ErrorState
          description={describeError(t, people.error)}
          onRetry={() => void people.refetch()}
        />
      </>
    )
  }
  const data = people.data
  const canManage = venueCan(workspace.data.role, 'MANAGE_EVENTS')

  return (
    <PeopleIds.Provider value={{ organizationId, eventId }}>
      {header}
      <div className={styles.stack}>
        <Notice title={t('venueEventPeople.twoSides.title')}>
          {t('venueEventPeople.twoSides.body', { venue: data.venue.name })}
        </Notice>
        <ClientCard people={data} canManage={canManage} onOpen={setDialog} />
        <ClientTeamSection people={data} />
        <VenueTeamSection people={data} />
      </div>

      {(dialog === 'invite' || dialog === 'different') && (
        <InviteDialog
          organizationId={organizationId}
          eventId={eventId}
          replacing={
            dialog === 'different' ? (data.client?.email ?? null) : null
          }
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === 'revoke' && data.client && (
        <RevokeDialog
          organizationId={organizationId}
          eventId={eventId}
          email={data.client.email}
          onClose={() => setDialog(null)}
        />
      )}
    </PeopleIds.Provider>
  )
}

/**
 * The address of the client card before Phase 29 (links from Phase 28):
 * the card now lives on the event's Permissions page.
 */
export function VenueEventPeoplePage() {
  const { eventId = '' } = useParams()
  return <Navigate to={`/events/${eventId}/permissions`} replace />
}
