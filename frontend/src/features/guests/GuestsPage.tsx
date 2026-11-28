import { listGroups } from '../../domain/guests.ts'
import {
  Armchair,
  CheckCheck,
  CircleHelp,
  Clock,
  EyeOff,
  Download,
  Mail,
  Plus,
  Send,
  Upload,
  Users,
  X,
} from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router'
import { canPerform } from '../../domain/access.ts'
import { isVenueSide } from '../../domain/roles.ts'
import { computeDashboardMetrics } from '../../domain/metrics.ts'
import type { Guest } from '../../domain/models.ts'
import { useFormatters } from '../../i18n/format.ts'
import { useEventAccessInfo } from '../../services/queries.ts'
import { ReadOnlyNotice } from '../../shared/access/EventAccess.tsx'
import { useEventAccess } from '../../shared/access/eventAccessContext.ts'
import { describeError } from '../../shared/errorMessage.ts'
import { Button } from '../../shared/ui/Button.tsx'
import { Card, KpiCard, KpiGrid } from '../../shared/ui/Card.tsx'
import { Menu } from '../../shared/ui/Menu.tsx'
import { Notice } from '../../shared/ui/Notice.tsx'
import { useSeatingExport } from '../event-layout/useSeatingExport.ts'
import { PageHeader } from '../../shared/ui/PageHeader.tsx'
import { ErrorState, LoadingState } from '../../shared/ui/States.tsx'
import { Tabs } from '../../shared/ui/Tabs.tsx'
import { useQueryParams } from '../../shared/useQueryParams.ts'
import type { FileFormat } from './guestFiles.ts'
import { GuestFormDialog } from './GuestFormDialog.tsx'
import {
  useGuests,
  useRejectedUnknownGuests,
  useTables,
  useUnknownGuests,
} from './guestQueries.ts'
import styles from './Guests.module.css'
import { GuestsTab } from './GuestsTab.tsx'
import { ImportDialog } from './ImportDialog.tsx'
import { UnknownGuestsTab } from './UnknownGuestsTab.tsx'
import { useGuestExport } from './useGuestExport.ts'

export function GuestsPage() {
  const { t } = useTranslation()
  const format = useFormatters()
  const { eventId = '' } = useParams()
  const { params, replaceAll } = useQueryParams()
  const access = useEventAccess()
  const canEdit = access !== null && canPerform(access, 'EDIT_GUESTS')
  const canSeat = access !== null && canPerform(access, 'ASSIGN_SEATING')
  const canSend = access !== null && canPerform(access, 'SEND_MESSAGE')
  const canExport = access !== null && canPerform(access, 'EXPORT_GUESTS')
  // The venue sees the client's list read-only, without phones (#17, D111).
  const venueSide = isVenueSide(access?.role ?? null)
  // The layout has already loaded the event, so this read comes from the cache.
  const info = useEventAccessInfo(eventId)
  const guests = useGuests(eventId)
  const tables = useTables(eventId)
  const unknown = useUnknownGuests(eventId, access !== null && !venueSide)
  const rejected = useRejectedUnknownGuests(
    eventId,
    access !== null && !venueSide,
  )
  const [dialog, setDialog] = useState<'add' | 'import' | null>(null)
  const exportGuests = useGuestExport(eventId, info.data?.event.name ?? '')
  const exportSeating = useSeatingExport(eventId, info.data?.event.name ?? '')
  const tab = params.get('tab') === 'unknown' ? 'unknown' : 'guests'
  const queries = venueSide
    ? [guests, tables]
    : [guests, tables, unknown, rejected]
  const failed = queries.find((query) => query.isError)
  const event = info.data?.event
  const ready =
    event !== undefined &&
    guests.data !== undefined &&
    tables.data !== undefined &&
    (venueSide || (unknown.data !== undefined && rejected.data !== undefined))
  const list = guests.data ?? []
  const onExport = (fileFormat: FileFormat, selection: readonly Guest[]) =>
    void exportGuests(fileFormat, selection)

  const actions = venueSide ? (
    <Menu
      label={t('venueGuests.seatingExport')}
      triggerClassName={styles.exportButton}
      items={[
        {
          id: 'csv',
          label: t('guests.actions.exportCsv'),
          onSelect: () => void exportSeating('csv'),
        },
        {
          id: 'xlsx',
          label: t('guests.actions.exportXlsx'),
          onSelect: () => void exportSeating('xlsx'),
        },
      ]}
    >
      <Download aria-hidden="true" />
      <span aria-hidden="true">{t('venueGuests.seatingExport')}</span>
    </Menu>
  ) : (
    <>
      {canEdit && (
        <Button
          variant="secondary"
          icon={<Upload />}
          disabled={!ready}
          onClick={() => setDialog('import')}
        >
          {t('guests.actions.import')}
        </Button>
      )}
      {canExport && (
        <Menu
          label={t('guests.actions.export')}
          triggerClassName={styles.exportButton}
          items={[
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
          ]}
        >
          <Download aria-hidden="true" />
          <span aria-hidden="true">{t('guests.actions.export')}</span>
        </Menu>
      )}
      {canEdit && (
        <Button
          icon={<Plus />}
          disabled={!ready}
          onClick={() => setDialog('add')}
        >
          {t('guests.actions.add')}
        </Button>
      )}
    </>
  )

  const metrics = computeDashboardMetrics(list, [])
  const number = format.number
  const kpis = [
    { id: 'total', value: metrics.totalGuests, icon: Users, tone: 'info' },
    { id: 'sent', value: metrics.invitationsSent, icon: Mail, tone: 'info' },
    {
      id: 'notSent',
      value: metrics.invitationsNotSent,
      icon: Send,
      tone: 'neutral',
    },
    {
      // People, not invitations: the attendees the approved guests confirmed.
      id: 'approved',
      value: metrics.confirmedAttendees,
      icon: CheckCheck,
      tone: 'success',
    },
    {
      id: 'notSure',
      value: metrics.rsvpNotSure,
      icon: CircleHelp,
      tone: 'warning',
    },
    { id: 'declined', value: metrics.rsvpDeclined, icon: X, tone: 'danger' },
  ] as const

  const venue = info.data?.venue ?? null
  const venueKpis = [
    {
      id: 'total',
      value: metrics.totalGuests,
      icon: Users,
      tone: 'info',
      unit: 'invitations',
    },
    {
      id: 'approved',
      value: metrics.confirmedAttendees,
      icon: CheckCheck,
      tone: 'success',
      unit: 'attendees',
    },
    {
      id: 'awaiting',
      value: metrics.awaitingResponse,
      icon: Clock,
      tone: 'info',
      unit: 'guests',
    },
    {
      id: 'notSure',
      value: metrics.rsvpNotSure,
      icon: CircleHelp,
      tone: 'warning',
      unit: 'guests',
    },
    {
      id: 'declined',
      value: metrics.rsvpDeclined,
      icon: X,
      tone: 'danger',
      unit: 'guests',
    },
    {
      id: 'withoutTable',
      value: metrics.unassignedConfirmedAttendees,
      icon: Armchair,
      tone: 'warning',
      unit: 'attendees',
    },
  ] as const

  return (
    <>
      <PageHeader
        title={t('pages.guests')}
        subtitle={t(venueSide ? 'venueGuests.subtitle' : 'guests.subtitle')}
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
        <div className={styles.stack}>
          {venueSide ? (
            <>
              <Notice title={t('venueGuests.noteTitle')}>
                <p>
                  {venue?.clientName
                    ? t('venueGuests.noteBody', { client: venue.clientName })
                    : t('venueGuests.noteBodyNoClient')}
                </p>
                <p className={styles.venueNoteMeta}>
                  <EyeOff aria-hidden="true" />
                  {t('venueGuests.phonesHidden', { venue: venue?.name ?? '' })}
                </p>
              </Notice>
              <KpiGrid label={t('venueGuests.kpis.label')} dense>
                {venueKpis.map(({ id, value, icon: Icon, tone, unit }) => (
                  <KpiCard
                    key={id}
                    label={t(`venueGuests.kpis.${id}`)}
                    value={number(value)}
                    hint={t(`venueGuests.kpis.${unit}`)}
                    icon={<Icon />}
                    tone={tone}
                  />
                ))}
              </KpiGrid>
              <GuestsTab
                eventId={eventId}
                event={event}
                guests={list}
                tables={tables.data}
                canEdit={false}
                canSeat={false}
                canSend={false}
                canExport={false}
                venueView
                onAdd={() => undefined}
                onExport={() => undefined}
              />
            </>
          ) : (
            <>
              <ReadOnlyNotice />
              <KpiGrid label={t('guests.kpis.label')} dense>
                {kpis.map(({ id, value, icon: Icon, tone }) => (
                  <KpiCard
                    key={id}
                    label={t(`guests.kpis.${id}`)}
                    value={number(value)}
                    hint={
                      id === 'approved'
                        ? t('guests.kpis.approvedHint')
                        : undefined
                    }
                    icon={<Icon />}
                    tone={tone}
                  />
                ))}
              </KpiGrid>
              <Tabs
                variant="segmented"
                label={t('guests.tabs.label')}
                value={tab}
                onChange={(id) =>
                  // Each tab has its own search and paging, so they start afresh.
                  replaceAll(id === 'unknown' ? { tab: 'unknown' } : {})
                }
                tabs={[
                  {
                    id: 'guests',
                    label: t('guests.tabs.guests'),
                    count: list.length,
                  },
                  {
                    id: 'unknown',
                    label: t('guests.tabs.unknown'),
                    count: unknown.data?.length ?? 0,
                  },
                ]}
              />
              {tab === 'guests' ? (
                <GuestsTab
                  eventId={eventId}
                  event={event}
                  guests={list}
                  tables={tables.data}
                  canEdit={canEdit}
                  canSeat={canSeat}
                  canSend={canSend}
                  canExport={canExport}
                  onAdd={() => setDialog('add')}
                  onExport={onExport}
                />
              ) : (
                <UnknownGuestsTab
                  eventId={eventId}
                  event={event}
                  guests={list}
                  pending={unknown.data ?? []}
                  rejected={rejected.data ?? []}
                  canEdit={canEdit}
                />
              )}
            </>
          )}
        </div>
      )}
      {event && (
        <>
          <GuestFormDialog
            open={dialog === 'add'}
            onClose={() => setDialog(null)}
            eventId={eventId}
            defaultAllowedAttendees={event.defaultAllowedAttendees}
            country={event.country}
            groups={listGroups(list)}
            tables={tables.data ?? []}
          />
          <ImportDialog
            open={dialog === 'import'}
            onClose={() => setDialog(null)}
            eventId={eventId}
            event={event}
            guests={list}
          />
        </>
      )}
    </>
  )
}
