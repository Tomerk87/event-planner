import {
  ArrowRight,
  Building2,
  CalendarCheck,
  CalendarDays,
  CalendarX,
  Check,
  CircleCheck,
  Clock,
  Link2Off,
  Mail,
  MapPin,
  Send,
  Shield,
  SlidersHorizontal,
  Sofa,
  TriangleAlert,
  UserPlus,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { useContext, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { useSession } from '../../app/session/sessionContext.ts'
import { LanguageSwitcher } from '../../app/shell/LanguageSwitcher.tsx'
import { isDomainError } from '../../domain/errors.ts'
import { useFormatters } from '../../i18n/format.ts'
import type { ClientInvitationView } from '../../services/contracts/index.ts'
import { ServicesContext } from '../../services/servicesContext.ts'
import { describeError } from '../../shared/errorMessage.ts'
import { Avatar } from '../../shared/ui/Avatar.tsx'
import { Badge } from '../../shared/ui/Badge.tsx'
import { Button } from '../../shared/ui/Button.tsx'
import { ButtonLink } from '../../shared/ui/ButtonLink.tsx'
import { EventCover } from '../../shared/ui/EventCover.tsx'
import { LtrText } from '../../shared/ui/LtrText.tsx'
import { Notice } from '../../shared/ui/Notice.tsx'
import { LoadingState } from '../../shared/ui/States.tsx'
import { useDocumentTitle } from '../../shared/useDocumentTitle.ts'
import styles from './AcceptClientInvitationPage.module.css'

/**
 * Keeps an inserted name or email in its own direction inside a sentence of
 * the other direction (an English address in Hebrew text).
 */
function isolate(value: string): string {
  return `\u2068${value}\u2069`
}
import { useAcceptClientInvitation } from './venueMutations.ts'
import { useClientInvitation } from './venueQueries.ts'

/** The page's own frame: logo, language and (signed in) the account. */
function Frame({
  title,
  account,
  children,
}: {
  title: string
  account: { name: string } | null
  children: ReactNode
}) {
  const { t } = useTranslation()
  useDocumentTitle(title)
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link to="/" className={styles.logo}>
          <CalendarCheck aria-hidden="true" />
          <span>{t('app.name')}</span>
        </Link>
        <div className={styles.headerEnd}>
          <div className={styles.language}>
            <LanguageSwitcher tone="light" />
          </div>
          {account && (
            <span className={styles.account}>
              <Avatar name={account.name} />
              <span className={styles.accountName}>{account.name}</span>
            </span>
          )}
        </div>
      </header>
      <main id="main-content" tabIndex={-1} className={styles.main}>
        {children}
      </main>
    </div>
  )
}

/** A centred card for the outcomes: accepted, used, expired, revoked. */
function OutcomeCard({
  icon: Icon,
  tone,
  title,
  body,
  children,
}: {
  icon: LucideIcon
  tone: 'success' | 'warning' | 'neutral'
  title: string
  body: string
  children?: ReactNode
}) {
  return (
    <section className={styles.outcome}>
      <span
        className={`${styles.outcomeIcon} ${styles[tone]}`}
        aria-hidden="true"
      >
        <Icon />
      </span>
      <h1 className={styles.outcomeTitle}>{title}</h1>
      <p className={styles.outcomeBody}>{body}</p>
      {children}
    </section>
  )
}

function VenueContact({ view }: { view: ClientInvitationView }) {
  const { t } = useTranslation()
  if (!view.invitedBy) {
    return null
  }
  return (
    <div className={styles.contact}>
      <Avatar name={view.invitedBy.name} />
      <div>
        <p className={styles.strong}>
          {t('acceptInvitation.contact', {
            name: view.invitedBy.name,
            venue: view.venueName,
          })}
        </p>
        <p className={styles.muted}>{t('acceptInvitation.contactRole')}</p>
        <a href={`mailto:${view.invitedBy.email}`}>
          <LtrText>{view.invitedBy.email}</LtrText>
        </a>
      </div>
    </div>
  )
}

function EventDetails({ view }: { view: ClientInvitationView }) {
  const { t } = useTranslation()
  const format = useFormatters()
  const { event } = view
  const startsAt = new Date(event.startsAt)
  const facts: { icon: ReactNode; label: string; value: string }[] = [
    {
      icon: <CalendarDays />,
      label: t('acceptInvitation.date'),
      value: format.date(startsAt, event.timeZone),
    },
    {
      icon: <Clock />,
      label: t('acceptInvitation.time'),
      value: format.time(startsAt, event.timeZone),
    },
    {
      icon: <Building2 />,
      label: t('acceptInvitation.space'),
      value: t('acceptInvitation.spaceValue', {
        space: view.space.name,
        venue: view.venueName,
      }),
    },
    {
      icon: <MapPin />,
      label: t('acceptInvitation.address'),
      value: view.space.address,
    },
  ]
  return (
    <section className={styles.card} aria-labelledby="invitation-event">
      <div className={styles.cover}>
        <EventCover eventId={event.id} image={event.coverImage} size="card" />
        <span className={styles.managed}>
          <Badge tone="info" icon={<Building2 />}>
            {t('acceptInvitation.managedBy', {
              venue: view.venueName,
            })}
          </Badge>
        </span>
      </div>
      <div className={styles.cardBody}>
        <p className={styles.invitedYou}>
          <Mail aria-hidden="true" />
          {t('acceptInvitation.invitedYou', { venue: isolate(view.venueName) })}
        </p>
        <h1 id="invitation-event" className={styles.eventName}>
          {event.name}
        </h1>
        <ul className={styles.facts}>
          {facts.map((fact) => (
            <li key={fact.label} className={styles.fact}>
              <span className={styles.factIcon} aria-hidden="true">
                {fact.icon}
              </span>
              <div>
                <p className={styles.factLabel}>{fact.label}</p>
                <p className={styles.factValue}>
                  <bdi>{fact.value}</bdi>
                </p>
              </div>
            </li>
          ))}
        </ul>
        <div className={styles.byline}>
          {view.invitedBy && (
            <span className={styles.bylineItem}>
              <Avatar name={view.invitedBy.name} />
              {t('acceptInvitation.invitedBy', {
                name: isolate(view.invitedBy.name),
                venue: isolate(view.venueName),
              })}
            </span>
          )}
          <span className={styles.bylineItem}>
            <Clock aria-hidden="true" />
            {t('acceptInvitation.expires', {
              date: format.date(new Date(view.expiresAt), event.timeZone),
            })}
          </span>
        </div>
      </div>
    </section>
  )
}

function WhatYouCanDo({ venue }: { venue: string }) {
  const { t } = useTranslation()
  const items: { icon: ReactNode; title: string; body: string }[] = [
    {
      icon: <Users />,
      title: t('acceptInvitation.canDo.guests'),
      body: t('acceptInvitation.canDo.guestsBody'),
    },
    {
      icon: <Send />,
      title: t('acceptInvitation.canDo.rsvp'),
      body: t('acceptInvitation.canDo.rsvpBody'),
    },
    {
      icon: <Sofa />,
      title: t('acceptInvitation.canDo.seating'),
      body: t('acceptInvitation.canDo.seatingBody'),
    },
    {
      icon: <UserPlus />,
      title: t('acceptInvitation.canDo.team'),
      body: t('acceptInvitation.canDo.teamBody'),
    },
  ]
  return (
    <section className={styles.card} aria-labelledby="invitation-can-do">
      <div className={styles.cardBody}>
        <h2 id="invitation-can-do" className={styles.cardTitle}>
          {t('acceptInvitation.canDo.title')}
        </h2>
        <p className={styles.muted}>{t('acceptInvitation.canDo.subtitle')}</p>
        <ul className={styles.canDo}>
          {items.map((item) => (
            <li key={item.title}>
              <span className={styles.factIcon} aria-hidden="true">
                {item.icon}
              </span>
              <div>
                <p className={styles.strong}>{item.title}</p>
                <p className={styles.muted}>{item.body}</p>
              </div>
            </li>
          ))}
        </ul>
        <p className={styles.maintained}>
          <Building2 aria-hidden="true" />
          {t('acceptInvitation.canDo.maintained', { venue })}
        </p>
      </div>
    </section>
  )
}

function AcceptPanel({
  view,
  token,
  onAccepted,
}: {
  view: ClientInvitationView
  token: string
  onAccepted: () => void
}) {
  const { t } = useTranslation()
  const format = useFormatters()
  const { services: demo } = useDemoAcceptance()
  const accept = useAcceptClientInvitation(token)
  const account = view.signedInAs
  const expires = format.date(new Date(view.expiresAt), view.event.timeZone)
  const venueMember =
    isDomainError(accept.error, 'FORBIDDEN') &&
    accept.error.details['reason'] === 'venueMember'
  const failure =
    accept.error && !venueMember ? describeError(t, accept.error) : null

  if (!account) {
    return (
      <section className={styles.panel} aria-labelledby="accept-title">
        <h2 id="accept-title" className={styles.cardTitle}>
          {t('acceptInvitation.accept.signInTitle')}
        </h2>
        <p className={styles.muted}>
          {t('acceptInvitation.accept.signInBody', {
            email: isolate(view.email),
          })}
        </p>
        <div className={styles.panelActions}>
          <ButtonLink to="/signup" variant="secondary">
            {t('acceptInvitation.accept.createAccount')}
          </ButtonLink>
          <ButtonLink to="/signin">
            {t('acceptInvitation.accept.signIn')}
          </ButtonLink>
        </div>
      </section>
    )
  }

  return (
    <section className={styles.panel} aria-labelledby="accept-title">
      <h2 id="accept-title" className={styles.cardTitle}>
        {t('acceptInvitation.accept.title')}
      </h2>
      {view.emailMatches && (
        <p className={styles.muted}>{t('acceptInvitation.accept.subtitle')}</p>
      )}
      <div className={styles.signedIn}>
        <Avatar name={account.name} />
        <div className={styles.signedInText}>
          <span className={styles.muted}>
            {t('acceptInvitation.accept.signedInAs')}
          </span>
          <span className={styles.strong}>{account.name}</span>
          <span className={styles.muted}>
            <LtrText>{account.email}</LtrText>
          </span>
        </div>
        {view.emailMatches ? (
          <Badge tone="success" icon={<Check />}>
            {t('acceptInvitation.accept.matches')}
          </Badge>
        ) : (
          <Badge tone="warning" icon={<TriangleAlert />}>
            {t('acceptInvitation.accept.different')}
          </Badge>
        )}
      </div>

      {failure && <Notice tone="danger" title={failure} announce />}
      {venueMember && (
        <Notice tone="warning" title={t('acceptInvitation.accept.otherTitle')}>
          {t('acceptInvitation.accept.venueMember', {
            venue: isolate(view.venueName),
          })}
        </Notice>
      )}

      {view.emailMatches ? (
        <>
          <Button
            size="lg"
            icon={<Check />}
            loading={accept.isPending && !accept.variables}
            disabled={venueMember}
            onClick={() => accept.mutate(false, { onSuccess: onAccepted })}
          >
            {t('acceptInvitation.accept.button')}
          </Button>
          <p className={styles.centered}>
            <Clock aria-hidden="true" className={styles.inlineIcon} />
            {t('acceptInvitation.accept.expiresNote', { date: expires })}
          </p>
        </>
      ) : (
        <>
          <Notice
            tone="warning"
            title={t('acceptInvitation.accept.otherTitle')}
          >
            {t('acceptInvitation.accept.otherBody', {
              invited: isolate(view.email),
              current: isolate(account.email),
            })}
          </Notice>
          <p className={styles.muted}>
            {t('acceptInvitation.accept.otherHelp', {
              invited: isolate(view.email),
              current: isolate(account.email),
              name: isolate(view.invitedBy?.name ?? view.venueName),
              venue: isolate(view.venueName),
            })}
          </p>
          <div className={styles.panelActions}>
            <ButtonLink to="/events" variant="secondary">
              {t('acceptInvitation.goToEvents')}
            </ButtonLink>
          </div>
        </>
      )}

      {demo && !view.emailMatches && (
        <div className={styles.demo}>
          <p className={styles.strong}>
            {t('acceptInvitation.accept.demoTitle')}
          </p>
          <p className={styles.muted}>
            {t('acceptInvitation.accept.demoBody', {
              email: isolate(view.email),
            })}
          </p>
          <Button
            icon={<Check />}
            loading={accept.isPending && accept.variables === true}
            onClick={() => accept.mutate(true, { onSuccess: onAccepted })}
          >
            {t('acceptInvitation.accept.demoAccept')}
          </Button>
        </div>
      )}
    </section>
  )
}

/** Whether this demo can accept for the invited client (it has one account). */
function useDemoAcceptance() {
  const services = useContext(ServicesContext)
  return {
    services: services?.venues?.acceptClientInvitationAsInvitee ? true : false,
  }
}

function Accepted({ view }: { view: ClientInvitationView }) {
  const { t } = useTranslation()
  const format = useFormatters()
  const { event } = view
  const startsAt = new Date(event.startsAt)
  const yours = view.isYours
  const steps: { icon: ReactNode; title: string; body: string }[] = [
    {
      icon: <Users />,
      title: t('acceptInvitation.accepted.guests'),
      body: t('acceptInvitation.accepted.guestsBody'),
    },
    {
      icon: <SlidersHorizontal />,
      title: t('acceptInvitation.accepted.rsvp'),
      body: t('acceptInvitation.accepted.rsvpBody'),
    },
    {
      icon: <Shield />,
      title: t('acceptInvitation.accepted.team'),
      body: t('acceptInvitation.accepted.teamBody'),
    },
  ]
  return (
    <OutcomeCard
      icon={CircleCheck}
      tone="success"
      title={t('acceptInvitation.accepted.title')}
      body={
        yours
          ? t('acceptInvitation.accepted.body', { name: event.name })
          : t('acceptInvitation.accepted.bodyDemo', {
              email: isolate(view.email),
              venue: isolate(view.venueName),
            })
      }
    >
      <div className={styles.eventRow}>
        <EventCover eventId={event.id} image={event.coverImage} size="thumb" />
        <div>
          <p className={styles.strong}>{event.name}</p>
          <p className={styles.muted}>
            {format.date(startsAt, event.timeZone)} ·{' '}
            {format.time(startsAt, event.timeZone)} · {view.space.name}
          </p>
          <Badge tone="info" icon={<Building2 />}>
            {t('acceptInvitation.managedBy', {
              venue: view.venueName,
            })}
          </Badge>
        </div>
      </div>
      <div className={styles.steps}>
        <h2 className={styles.stepsTitle}>
          {t('acceptInvitation.accepted.next')}
        </h2>
        <ul className={styles.stepList}>
          {steps.map((step) => (
            <li key={step.title}>
              <span className={styles.factIcon} aria-hidden="true">
                {step.icon}
              </span>
              <div className={styles.stepText}>
                <p className={styles.strong}>{step.title}</p>
                <p className={styles.muted}>{step.body}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
      <div className={styles.outcomeActions}>
        <ButtonLink to="/events" variant="secondary">
          {t('acceptInvitation.goToEvents')}
        </ButtonLink>
        {!yours && view.signedInAs && (
          <ButtonLink
            to={`/venues/${view.venueId}/events/${event.id}`}
            icon={<ArrowRight className={styles.directional} />}
            iconPosition="end"
          >
            {t('acceptInvitation.accepted.backToVenue', {
              venue: view.venueName,
            })}
          </ButtonLink>
        )}
      </div>
    </OutcomeCard>
  )
}

function Closed({ view }: { view: ClientInvitationView }) {
  const { t } = useTranslation()
  const format = useFormatters()
  const { state, event } = view
  const look =
    state === 'USED'
      ? { icon: CircleCheck, tone: 'neutral' as const, key: 'used' as const }
      : state === 'EXPIRED'
        ? { icon: CalendarX, tone: 'warning' as const, key: 'expired' as const }
        : { icon: Link2Off, tone: 'warning' as const, key: 'revoked' as const }
  return (
    <OutcomeCard
      icon={look.icon}
      tone={look.tone}
      title={t(`acceptInvitation.${look.key}.title`)}
      body={t(`acceptInvitation.${look.key}.body`, {
        name: event.name,
        venue: isolate(view.venueName),
        date: format.date(new Date(view.expiresAt), event.timeZone),
      })}
    >
      {state !== 'USED' && <VenueContact view={view} />}
      <div className={styles.outcomeActions}>
        <ButtonLink to="/events" variant="secondary">
          {t('acceptInvitation.goToEvents')}
        </ButtonLink>
        {state !== 'USED' && view.invitedBy && (
          <ButtonLink to={`mailto:${view.invitedBy.email}`} icon={<Mail />}>
            {t('acceptInvitation.emailVenue', {
              venue: view.venueName,
            })}
          </ButtonLink>
        )}
      </div>
    </OutcomeCard>
  )
}

/**
 * A client invitation link (V2.2, Phase 28, mockup #12). Shows the event and
 * who invited, then, by the link's state and the account: Accept (the right
 * email), why not (another email, or a venue member), sign in, or that the
 * link was used, expired or revoked.
 */
export function AcceptClientInvitationPage() {
  const { t } = useTranslation()
  const { token = '' } = useParams()
  const { session } = useSession()
  const services = useContext(ServicesContext)

  // Signed out, or with no venues here: the link can't be read yet.
  if (!session || !services?.venues) {
    return (
      <Frame title={t('acceptInvitation.accept.signInTitle')} account={null}>
        <div className={styles.single}>
          <section className={styles.panel} aria-labelledby="accept-title">
            <h1 id="accept-title" className={styles.cardTitle}>
              {session
                ? t('acceptInvitation.revoked.title')
                : t('acceptInvitation.accept.signInTitle')}
            </h1>
            <p className={styles.muted}>
              {session
                ? t('acceptInvitation.notFound')
                : t('acceptInvitation.accept.signInBody', {
                    email: '',
                  }).replace(/\s+\./, '.')}
            </p>
            {!session && (
              <div className={styles.panelActions}>
                <ButtonLink to="/signup" variant="secondary">
                  {t('acceptInvitation.accept.createAccount')}
                </ButtonLink>
                <ButtonLink to="/signin">
                  {t('acceptInvitation.accept.signIn')}
                </ButtonLink>
              </div>
            )}
          </section>
        </div>
      </Frame>
    )
  }
  return <SignedInInvitation token={token} />
}

function SignedInInvitation({ token }: { token: string }) {
  const { t } = useTranslation()
  const invitation = useClientInvitation(token)
  // Accepted here, just now: the outcome, even for the demo's stand-in.
  const [accepted, setAccepted] = useState(false)

  if (invitation.isPending) {
    return (
      <Frame title={t('acceptInvitation.accept.title')} account={null}>
        <h1 className="visually-hidden">{t('common.loading')}</h1>
        <LoadingState />
      </Frame>
    )
  }
  if (invitation.isError) {
    return (
      <Frame title={t('acceptInvitation.revoked.title')} account={null}>
        <div className={styles.single}>
          <OutcomeCard
            icon={Link2Off}
            tone="warning"
            title={t('acceptInvitation.revoked.title')}
            body={
              isDomainError(invitation.error, 'NOT_FOUND')
                ? t('acceptInvitation.notFound')
                : describeError(t, invitation.error)
            }
          >
            <div className={styles.outcomeActions}>
              <ButtonLink to="/events" variant="secondary">
                {t('acceptInvitation.goToEvents')}
              </ButtonLink>
            </div>
          </OutcomeCard>
        </div>
      </Frame>
    )
  }

  const view = invitation.data
  const title =
    accepted || view.state === 'OPEN'
      ? t('acceptInvitation.accept.title')
      : view.state === 'USED'
        ? t('acceptInvitation.accepted.title')
        : t(
            view.state === 'EXPIRED'
              ? 'acceptInvitation.expired.title'
              : 'acceptInvitation.revoked.title',
          )

  return (
    <Frame title={title} account={view.signedInAs}>
      {accepted && view.state === 'USED' ? (
        <div className={styles.single}>
          <Accepted view={view} />
        </div>
      ) : view.state === 'OPEN' ? (
        <div className={styles.grid}>
          <div className={styles.column}>
            <EventDetails view={view} />
            <WhatYouCanDo venue={view.venueName} />
          </div>
          <AcceptPanel
            view={view}
            token={token}
            onAccepted={() => setAccepted(true)}
          />
        </div>
      ) : view.state === 'USED' && view.isYours ? (
        <div className={styles.single}>
          <Accepted view={view} />
        </div>
      ) : (
        <div className={styles.single}>
          <Closed view={view} />
        </div>
      )}
    </Frame>
  )
}
