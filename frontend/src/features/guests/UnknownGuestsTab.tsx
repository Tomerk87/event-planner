import { CircleHelp, GitMerge, RotateCcw, UserPlus, X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { EVENT_LIMITS } from '../../domain/events.ts'
import { guestFullName, matchesGuestQuery } from '../../domain/guestList.ts'
import type { Event, Guest, UnknownRsvp } from '../../domain/models.ts'
import { useFormatters } from '../../i18n/format.ts'
import { describeError } from '../../shared/errorMessage.ts'
import { Button } from '../../shared/ui/Button.tsx'
import { Card } from '../../shared/ui/Card.tsx'
import { DataTable, type Column } from '../../shared/ui/DataTable.tsx'
import { Dialog } from '../../shared/ui/Dialog.tsx'
import { TextField } from '../../shared/ui/Field.tsx'
import { LtrText } from '../../shared/ui/LtrText.tsx'
import { Notice } from '../../shared/ui/Notice.tsx'
import { EmptyState } from '../../shared/ui/States.tsx'
import { Tabs } from '../../shared/ui/Tabs.tsx'
import { useToast } from '../../shared/ui/toastContext.ts'
import { useQueryParams } from '../../shared/useQueryParams.ts'
import { toInteger } from '../events/eventForm.ts'
import {
  useConvertUnknown,
  useMergeUnknown,
  useRejectUnknown,
  useRestoreUnknown,
} from './guestQueries.ts'
import styles from './Guests.module.css'
import { ResponseBadge } from './GuestStatusBadge.tsx'

const NONE = '—'
const MATCH_CHOICES = 8

type Action = { kind: 'convert' | 'merge'; unknown: UnknownRsvp }

/** "Dana Cohen Levi" becomes first name "Dana", last name "Cohen Levi". */
function splitName(name: string): { firstName: string; lastName: string } {
  const [firstName = '', ...rest] = name.trim().split(/\s+/)
  return { firstName, lastName: rest.join(' ') }
}

function ConvertForm({
  eventId,
  event,
  unknown,
  onClose,
}: {
  eventId: string
  event: Event
  unknown: UnknownRsvp
  onClose: () => void
}) {
  const { t } = useTranslation()
  const { showToast } = useToast()
  const convert = useConvertUnknown(eventId)
  const limits = EVENT_LIMITS.allowedAttendees
  const initial = splitName(unknown.name)
  const [firstName, setFirstName] = useState(initial.firstName)
  const [lastName, setLastName] = useState(initial.lastName)
  const [allowed, setAllowed] = useState(
    String(
      Math.max(event.defaultAllowedAttendees, unknown.confirmedAttendees ?? 0),
    ),
  )
  const [error, setError] = useState<'firstName' | 'allowed' | null>(null)
  const [failure, setFailure] = useState<string | null>(null)

  function handleSubmit(submit: FormEvent) {
    submit.preventDefault()
    setFailure(null)
    const allowedAttendees = toInteger(allowed)
    if (firstName.trim() === '') {
      return setError('firstName')
    }
    if (
      !Number.isInteger(allowedAttendees) ||
      allowedAttendees < limits.min ||
      allowedAttendees > limits.max
    ) {
      return setError('allowed')
    }
    setError(null)
    convert.mutate(
      {
        unknownId: unknown.id,
        input: { firstName, lastName, allowedAttendees },
      },
      {
        onSuccess: () => {
          showToast({ tone: 'success', message: t('guests.unknown.converted') })
          onClose()
        },
        onError: (problem) => setFailure(describeError(t, problem)),
      },
    )
  }

  return (
    <form className={styles.form} noValidate onSubmit={handleSubmit}>
      {failure && <Notice tone="danger" title={failure} announce />}
      <p>
        {t('guests.unknown.convertIntro')} <LtrText>{unknown.phone}</LtrText>
      </p>
      <div className={styles.formRow}>
        <TextField
          label={t('guests.form.firstName')}
          required
          maxLength={60}
          value={firstName}
          error={
            error === 'firstName'
              ? t('guests.form.errors.firstName')
              : undefined
          }
          onChange={(change) => {
            setFirstName(change.target.value)
            setError((current) => (current === 'firstName' ? null : current))
          }}
        />
        <TextField
          label={t('guests.form.lastName')}
          maxLength={60}
          value={lastName}
          onChange={(change) => setLastName(change.target.value)}
        />
      </div>
      <TextField
        label={t('guests.form.allowed')}
        type="number"
        inputMode="numeric"
        required
        min={limits.min}
        max={limits.max}
        value={allowed}
        hint={t('guests.form.allowedHint', limits)}
        error={
          error === 'allowed'
            ? t('guests.form.errors.allowed', limits)
            : undefined
        }
        onChange={(change) => {
          setAllowed(change.target.value)
          setError((current) => (current === 'allowed' ? null : current))
        }}
      />
      <div className={styles.formActions}>
        <Button variant="ghost" onClick={onClose}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" loading={convert.isPending}>
          {t('guests.unknown.convert')}
        </Button>
      </div>
    </form>
  )
}

function MergeForm({
  eventId,
  unknown,
  guests,
  onClose,
}: {
  eventId: string
  unknown: UnknownRsvp
  guests: readonly Guest[]
  onClose: () => void
}) {
  const { t, i18n } = useTranslation()
  const { showToast } = useToast()
  const merge = useMergeUnknown(eventId)
  const [query, setQuery] = useState(unknown.name)
  const [guestId, setGuestId] = useState<string | null>(null)
  const [failure, setFailure] = useState<string | null>(null)
  const matches = guests.filter((guest) =>
    matchesGuestQuery(guest, query, i18n.language),
  )
  const chosen = guests.find((guest) => guest.id === guestId) ?? null

  function handleSubmit(submit: FormEvent) {
    submit.preventDefault()
    if (!chosen) {
      return
    }
    setFailure(null)
    merge.mutate(
      { unknownId: unknown.id, guestId: chosen.id },
      {
        onSuccess: () => {
          showToast({ tone: 'success', message: t('guests.unknown.merged') })
          onClose()
        },
        onError: (problem) => setFailure(describeError(t, problem)),
      },
    )
  }

  return (
    <form className={styles.form} noValidate onSubmit={handleSubmit}>
      {failure && <Notice tone="danger" title={failure} announce />}
      <p>{t('guests.unknown.mergeIntro', { name: unknown.name })}</p>
      <TextField
        label={t('guests.unknown.findGuest')}
        type="search"
        value={query}
        onChange={(change) => {
          setQuery(change.target.value)
          setGuestId(null)
        }}
      />
      {matches.length === 0 ? (
        <p className={styles.muted}>{t('guests.unknown.noGuestFound')}</p>
      ) : (
        <fieldset className={styles.choices}>
          <legend className={styles.legend}>
            {t('guests.unknown.chooseGuest')}
          </legend>
          {matches.slice(0, MATCH_CHOICES).map((guest) => (
            <label key={guest.id} className={styles.choice}>
              <input
                type="radio"
                name="merge-guest"
                checked={guestId === guest.id}
                onChange={() => setGuestId(guest.id)}
              />
              <span>
                {guestFullName(guest)}{' '}
                <span className={styles.muted}>
                  <LtrText>{guest.phone}</LtrText>
                </span>
              </span>
            </label>
          ))}
          {matches.length > MATCH_CHOICES && (
            <p className={styles.muted}>{t('guests.unknown.refineSearch')}</p>
          )}
        </fieldset>
      )}
      <div className={styles.formActions}>
        <Button variant="ghost" onClick={onClose}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" disabled={!chosen} loading={merge.isPending}>
          {t('guests.unknown.merge')}
        </Button>
      </div>
    </form>
  )
}

interface UnknownGuestsTabProps {
  eventId: string
  event: Event
  guests: readonly Guest[]
  pending: readonly UnknownRsvp[]
  rejected: readonly UnknownRsvp[]
  canEdit: boolean
}

/**
 * RSVP responses whose phone matched no guest. They stay out of the guest
 * figures until an organizer adds them as a guest or matches them to one.
 */
export function UnknownGuestsTab({
  eventId,
  event,
  guests,
  pending,
  rejected,
  canEdit,
}: UnknownGuestsTabProps) {
  const { t } = useTranslation()
  const format = useFormatters()
  const { showToast } = useToast()
  const { params, update } = useQueryParams()
  const [action, setAction] = useState<Action | null>(null)
  const reject = useRejectUnknown(eventId)
  const restore = useRestoreUnknown(eventId)
  const showRejected = params.get('view') === 'rejected'
  const rows = showRejected ? rejected : pending
  const closeAction = () => setAction(null)

  const moment = (value: string) =>
    t('dashboard.activity.onDate', {
      date: format.date(new Date(value)),
      time: format.time(new Date(value)),
    })
  const notify = (message: string) => ({
    onSuccess: () => showToast({ tone: 'success', message }),
    onError: (error: unknown) =>
      showToast({ tone: 'danger', message: describeError(t, error) }),
  })

  function actions(unknown: UnknownRsvp) {
    if (!canEdit) {
      return null
    }
    if (showRejected) {
      return (
        <Button
          variant="secondary"
          size="sm"
          icon={<RotateCcw />}
          disabled={restore.isPending}
          onClick={() =>
            restore.mutate(unknown.id, notify(t('guests.unknown.restored')))
          }
        >
          {t('guests.unknown.restore')}
        </Button>
      )
    }
    return (
      <div className={styles.unknownActions}>
        <Button
          size="sm"
          icon={<UserPlus />}
          onClick={() => setAction({ kind: 'convert', unknown })}
        >
          {t('guests.unknown.convert')}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          icon={<GitMerge />}
          onClick={() => setAction({ kind: 'merge', unknown })}
        >
          {t('guests.unknown.merge')}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          icon={<X />}
          disabled={reject.isPending}
          onClick={() =>
            reject.mutate(unknown.id, notify(t('guests.unknown.rejected')))
          }
        >
          {t('guests.unknown.reject')}
        </Button>
      </div>
    )
  }

  const attendees = (unknown: UnknownRsvp) =>
    unknown.confirmedAttendees === null
      ? NONE
      : format.number(unknown.confirmedAttendees)

  const columns: Column<UnknownRsvp>[] = [
    {
      id: 'name',
      header: t('guests.unknown.columns.name'),
      cell: (unknown) => <span className={styles.strong}>{unknown.name}</span>,
    },
    {
      id: 'phone',
      header: t('guests.columns.phone'),
      cell: (unknown) => <LtrText>{unknown.phone}</LtrText>,
    },
    {
      id: 'response',
      header: t('guests.unknown.columns.response'),
      cell: (unknown) => <ResponseBadge status={unknown.rsvpStatus} />,
    },
    {
      id: 'attendees',
      header: t('guests.unknown.columns.attendees'),
      align: 'center',
      cell: attendees,
    },
    {
      id: 'submitted',
      header: t('guests.unknown.columns.submitted'),
      cell: (unknown) => moment(unknown.submittedAt),
    },
    ...(showRejected
      ? [
          {
            id: 'rejectedAt',
            header: t('guests.unknown.columns.rejectedAt'),
            cell: (unknown: UnknownRsvp) =>
              unknown.rejectedAt ? moment(unknown.rejectedAt) : NONE,
          },
        ]
      : []),
    ...(canEdit
      ? [
          {
            id: 'actions',
            header: t('guests.columns.actions'),
            hideHeader: true,
            align: 'end' as const,
            pinned: true,
            cell: actions,
          },
        ]
      : []),
  ]

  return (
    <div className={styles.stack}>
      <Notice title={t('guests.unknown.noticeTitle')}>
        {t('guests.unknown.noticeBody')}
      </Notice>
      <Tabs
        label={t('guests.unknown.views')}
        variant="segmented"
        value={showRejected ? 'rejected' : 'pending'}
        onChange={(id) =>
          update({ view: id === 'rejected' ? 'rejected' : null })
        }
        tabs={[
          {
            id: 'pending',
            label: t('guests.unknown.pending'),
            count: pending.length,
          },
          {
            id: 'rejected',
            label: t('guests.unknown.rejectedView'),
            count: rejected.length,
          },
        ]}
      />
      {rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={<CircleHelp />}
            title={t(
              showRejected
                ? 'guests.unknown.emptyRejected'
                : 'guests.unknown.emptyPending',
            )}
          />
        </Card>
      ) : (
        <DataTable
          caption={t(
            showRejected
              ? 'guests.unknown.rejectedView'
              : 'guests.unknown.pending',
          )}
          columns={columns}
          rows={[...rows]}
          getRowKey={(unknown) => unknown.id}
          renderCard={(unknown) => (
            <div className={styles.guestCard}>
              <div className={styles.cardTop}>
                <div className={styles.cardIdentity}>
                  <p className={styles.cardName}>{unknown.name}</p>
                  <p className={styles.muted}>
                    <LtrText>{unknown.phone}</LtrText>
                  </p>
                </div>
                <ResponseBadge status={unknown.rsvpStatus} />
              </div>
              <ul className={styles.cardFacts}>
                <li>
                  {t('guests.unknown.cardAttendees', {
                    count: attendees(unknown),
                  })}
                </li>
                <li>{moment(unknown.submittedAt)}</li>
              </ul>
              {actions(unknown)}
            </div>
          )}
        />
      )}

      <Dialog
        open={action?.kind === 'convert'}
        onClose={closeAction}
        title={t('guests.unknown.convertTitle')}
      >
        {action?.kind === 'convert' && (
          <ConvertForm
            eventId={eventId}
            event={event}
            unknown={action.unknown}
            onClose={closeAction}
          />
        )}
      </Dialog>
      <Dialog
        open={action?.kind === 'merge'}
        onClose={closeAction}
        title={t('guests.unknown.mergeTitle')}
      >
        {action?.kind === 'merge' && (
          <MergeForm
            eventId={eventId}
            unknown={action.unknown}
            guests={guests}
            onClose={closeAction}
          />
        )}
      </Dialog>
    </div>
  )
}
