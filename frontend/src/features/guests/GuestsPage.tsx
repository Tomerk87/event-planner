import {
  CheckCheck,
  CircleHelp,
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
import { canEditEvent } from '../../domain/access.ts'
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
import { PageHeader } from '../../shared/ui/PageHeader.tsx'
import { ErrorState, LoadingState } from '../../shared/ui/States.tsx'
import { Tabs } from '../../shared/ui/Tabs.tsx'
import { useQueryParams } from '../../shared/useQueryParams.ts'
import type { FileFormat } from './guestFiles.ts'
import { GuestFormDialog } from './GuestFormDialog.tsx'
import {
  tablesOf,
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
  const canEdit = access !== null && canEditEvent(access)
  // The layout has already loaded the event, so this read comes from the cache.
  const info = useEventAccessInfo(eventId)
  const guests = useGuests(eventId)
  const tables = useTables(eventId)
  const unknown = useUnknownGuests(eventId)
  const rejected = useRejectedUnknownGuests(eventId)
  const [dialog, setDialog] = useState<'add' | 'import' | null>(null)
  const exportGuests = useGuestExport(
    info.data?.event.name ?? '',
    tablesOf(tables.data),
  )
  const tab = params.get('tab') === 'unknown' ? 'unknown' : 'guests'
  const queries = [guests, tables, unknown, rejected]
  const failed = queries.find((query) => query.isError)
  const event = info.data?.event
  const ready =
    event !== undefined &&
    guests.data !== undefined &&
    tables.data !== undefined &&
    unknown.data !== undefined &&
    rejected.data !== undefined
  const list = guests.data ?? []
  const onExport = (fileFormat: FileFormat, selection: readonly Guest[]) =>
    void exportGuests(fileFormat, selection)

  const actions = (
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

  return (
    <>
      <PageHeader
        title={t('pages.guests')}
        subtitle={t('guests.subtitle')}
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
          <ReadOnlyNotice />
          <KpiGrid label={t('guests.kpis.label')} dense>
            {kpis.map(({ id, value, icon: Icon, tone }) => (
              <KpiCard
                key={id}
                label={t(`guests.kpis.${id}`)}
                value={number(value)}
                hint={
                  id === 'approved' ? t('guests.kpis.approvedHint') : undefined
                }
                icon={<Icon />}
                tone={tone}
              />
            ))}
          </KpiGrid>
          <Tabs
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
                count: unknown.data.length,
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
              onAdd={() => setDialog('add')}
              onExport={onExport}
            />
          ) : (
            <UnknownGuestsTab
              eventId={eventId}
              event={event}
              guests={list}
              pending={unknown.data}
              rejected={rejected.data}
              canEdit={canEdit}
            />
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
