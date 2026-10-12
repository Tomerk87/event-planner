import {
  ArrowLeft,
  CircleCheck,
  CircleHelp,
  CircleX,
  Clock,
  Download,
  Globe,
  Mail,
  Pencil,
  Plus,
  Search,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { AppShell } from '../../app/shell/AppShell.tsx'
import { getEventNavItems } from '../../app/shell/eventNav.ts'
import type { EventAccess } from '../../domain/access.ts'
import { EVENT_ROLES, type EventRole } from '../../domain/roles.ts'
import { LocaleScope } from '../../i18n/LocaleScope.tsx'
import {
  EditGate,
  ReadOnlyBadge,
  ReadOnlyNotice,
} from '../../shared/access/EventAccess.tsx'
import { EventAccessContext } from '../../shared/access/eventAccessContext.ts'
import { Badge } from '../../shared/ui/Badge.tsx'
import { Button, IconButton } from '../../shared/ui/Button.tsx'
import { Card, KpiCard, KpiGrid } from '../../shared/ui/Card.tsx'
import { DataTable, type Column } from '../../shared/ui/DataTable.tsx'
import { Dialog, Drawer } from '../../shared/ui/Dialog.tsx'
import { SelectField, TextArea, TextField } from '../../shared/ui/Field.tsx'
import { LtrText } from '../../shared/ui/LtrText.tsx'
import { Notice } from '../../shared/ui/Notice.tsx'
import { PageHeader } from '../../shared/ui/PageHeader.tsx'
import { RoleIcon } from '../../shared/ui/RoleIcon.tsx'
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from '../../shared/ui/States.tsx'
import { Tabs } from '../../shared/ui/Tabs.tsx'
import { useToast } from '../../shared/ui/toastContext.ts'
import {
  sampleContact,
  sampleEvents,
  sampleGuests,
  sampleUserName,
  statusTones,
  type SampleGuest,
  type SampleStatus,
} from './sampleData.ts'
import styles from './ShowcasePage.module.css'

const statusIcons: Record<SampleStatus, ReactNode> = {
  approved: <CircleCheck />,
  declined: <CircleX />,
  notSure: <CircleHelp />,
  awaiting: <Clock />,
}

function GuestFacingSample() {
  const { t } = useTranslation()
  return <strong>{t('showcase.rsvpLanguage.sample')}</strong>
}

export function ShowcasePage() {
  const { t } = useTranslation()
  const { showToast } = useToast()
  const [role, setRole] = useState<EventRole>('OWNER')
  const [isPastEvent, setIsPastEvent] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [message, setMessage] = useState(() =>
    t('showcase.fields.welcomeMessageValue'),
  )
  const access = useMemo<EventAccess>(
    () => ({ role, isPastEvent }),
    [role, isPastEvent],
  )
  const [currentEvent] = sampleEvents

  const statusLabel = (status: SampleStatus) => t(`showcase.badges.${status}`)

  const columns: Column<SampleGuest>[] = [
    { id: 'name', header: t('showcase.table.name'), cell: (g) => g.name },
    {
      id: 'phone',
      header: t('showcase.table.phone'),
      cell: (g) => <LtrText>{g.phone}</LtrText>,
    },
    {
      id: 'allowed',
      header: t('showcase.table.allowed'),
      cell: (g) => g.allowed,
      align: 'end',
    },
    {
      id: 'status',
      header: t('showcase.table.status'),
      cell: (g) => (
        <Badge tone={statusTones[g.status]} icon={statusIcons[g.status]}>
          {statusLabel(g.status)}
        </Badge>
      ),
    },
    {
      id: 'table',
      header: t('showcase.table.tableNumber'),
      cell: (g) => g.table ?? '—',
      align: 'end',
    },
  ]

  return (
    <EventAccessContext.Provider value={access}>
      <AppShell
        navLabel={t('nav.event')}
        navItems={getEventNavItems(t, currentEvent?.id ?? '', role)}
        footerLink={{
          to: '/',
          label: t('nav.backToMyEvents'),
          icon: ArrowLeft,
          directional: true,
        }}
        event={currentEvent}
        events={sampleEvents}
        user={{ name: sampleUserName, role }}
      >
        <PageHeader
          title={t('showcase.title')}
          subtitle={t('showcase.subtitle')}
          actions={<ReadOnlyBadge />}
        />

        <div className={styles.sections}>
          <Card
            title={t('showcase.preview.title')}
            subtitle={t('showcase.preview.subtitle')}
          >
            <div className={styles.grid}>
              <SelectField
                label={t('showcase.preview.role')}
                value={role}
                onChange={(event) => setRole(event.target.value as EventRole)}
              >
                {EVENT_ROLES.map((option) => (
                  <option key={option} value={option}>
                    {t(`roles.${option}`)}
                  </option>
                ))}
              </SelectField>
              <SelectField
                label={t('showcase.preview.eventState')}
                value={isPastEvent ? 'past' : 'active'}
                onChange={(event) =>
                  setIsPastEvent(event.target.value === 'past')
                }
              >
                <option value="active">{t('showcase.preview.active')}</option>
                <option value="past">{t('showcase.preview.past')}</option>
              </SelectField>
            </div>
          </Card>

          <Card
            title={t('showcase.buttons.title')}
            subtitle={t('showcase.buttons.subtitle')}
          >
            <div className={styles.row}>
              <Button icon={<Plus />}>{t('showcase.buttons.addGuest')}</Button>
              <Button variant="secondary" icon={<Download />}>
                {t('showcase.buttons.export')}
              </Button>
              <Button variant="ghost">{t('showcase.buttons.cancel')}</Button>
              <Button variant="danger" icon={<Trash2 />}>
                {t('showcase.buttons.delete')}
              </Button>
              <Button loading>{t('showcase.buttons.saving')}</Button>
              <Button disabled>{t('showcase.buttons.disabled')}</Button>
              <Button size="sm" variant="secondary">
                {t('showcase.buttons.small')}
              </Button>
              <IconButton label={t('showcase.buttons.edit')}>
                <Pencil />
              </IconButton>
              <IconButton label={t('showcase.buttons.remove')} variant="danger">
                <Trash2 />
              </IconButton>
            </div>
          </Card>

          <Card
            title={t('showcase.fields.title')}
            subtitle={t('showcase.fields.subtitle')}
          >
            <div className={styles.grid}>
              <TextField
                label={t('showcase.fields.eventName')}
                defaultValue={t('showcase.fields.eventNameValue')}
                required
              />
              <TextField
                label={t('showcase.fields.maxAttendees')}
                type="number"
                defaultValue={20}
                required
                hint={t('showcase.fields.maxAttendeesHint')}
                error={t('showcase.fields.maxAttendeesError')}
              />
              <SelectField
                label={t('showcase.fields.rsvpLanguage')}
                hint={t('showcase.fields.rsvpLanguageHint')}
                icon={<Globe />}
                defaultValue="en"
                required
              >
                <option value="en">{t('language.en')}</option>
                <option value="he">{t('language.he')}</option>
              </SelectField>
              <TextField
                label={t('showcase.fields.search')}
                hideLabel
                type="search"
                icon={<Search />}
                placeholder={t('showcase.fields.searchPlaceholder')}
              />
            </div>
            <div style={{ marginBlockStart: 'var(--space-4)' }}>
              <TextArea
                label={t('showcase.fields.welcomeMessage')}
                value={message}
                maxLength={500}
                onChange={(event) => setMessage(event.target.value)}
              />
            </div>
          </Card>

          <Card
            title={t('showcase.badges.title')}
            subtitle={t('showcase.badges.subtitle')}
          >
            <div className={styles.row}>
              {(Object.keys(statusTones) as SampleStatus[]).map((status) => (
                <Badge
                  key={status}
                  tone={statusTones[status]}
                  icon={statusIcons[status]}
                >
                  {statusLabel(status)}
                </Badge>
              ))}
              <Badge tone="success">{t('showcase.badges.upcoming')}</Badge>
              <Badge>{t('showcase.badges.past')}</Badge>
              <Badge tone="danger">{t('showcase.badges.overCapacity')}</Badge>
              <Badge tone="warning">{t('showcase.badges.almostFull')}</Badge>
              {EVENT_ROLES.map((option) => (
                <Badge
                  key={option}
                  tone={option === 'VIEWER' ? 'neutral' : 'info'}
                  icon={<RoleIcon role={option} />}
                >
                  {t(`roles.${option}`)}
                </Badge>
              ))}
            </div>
          </Card>

          <KpiGrid label={t('showcase.kpis.title')}>
            <KpiCard
              label={t('showcase.kpis.totalGuests')}
              value={164}
              icon={<Users />}
            />
            <KpiCard
              label={t('showcase.kpis.invitationsSent')}
              value={127}
              icon={<Mail />}
              tone="neutral"
            />
            <KpiCard
              label={t('showcase.kpis.awaitingResponse')}
              value={21}
              icon={<Clock />}
              tone="warning"
            />
            <KpiCard
              label={t('showcase.kpis.confirmedAttendees')}
              value={214}
              icon={<CircleCheck />}
              tone="success"
            />
          </KpiGrid>

          <Card
            title={t('showcase.notices.title')}
            subtitle={t('showcase.notices.subtitle')}
          >
            <div className={styles.stack}>
              <Notice title={t('showcase.notices.infoTitle')}>
                {t('showcase.notices.infoBody')}
              </Notice>
              <Notice tone="success" title={t('showcase.notices.successTitle')}>
                {t('showcase.notices.successBody')}
              </Notice>
              <Notice tone="warning" title={t('showcase.notices.warningTitle')}>
                {t('showcase.notices.warningBody')}
              </Notice>
              <Notice
                tone="danger"
                title={t('showcase.notices.dangerTitle')}
                action={
                  <Button size="sm" variant="secondary">
                    {t('showcase.notices.action')}
                  </Button>
                }
              >
                {t('showcase.notices.dangerBody')}
              </Notice>
            </div>
          </Card>

          <Card
            title={t('showcase.tabs.title')}
            subtitle={t('showcase.tabs.subtitle')}
          >
            <div className={styles.stack}>
              <Tabs
                label={t('showcase.tabs.underlineLabel')}
                tabs={[
                  {
                    id: 'guests',
                    label: t('showcase.tabs.guests'),
                    count: 164,
                    panel: (
                      <p className={styles.muted}>
                        {t('showcase.tabs.guestsPanel')}
                      </p>
                    ),
                  },
                  {
                    id: 'unknown',
                    label: t('showcase.tabs.unknownGuests'),
                    count: 8,
                    panel: (
                      <p className={styles.muted}>
                        {t('showcase.tabs.unknownGuestsPanel')}
                      </p>
                    ),
                  },
                ]}
              />
              <Tabs
                label={t('showcase.tabs.segmentedLabel')}
                variant="segmented"
                tabs={[
                  {
                    id: 'tables',
                    label: t('showcase.tabs.tables'),
                    panel: (
                      <p className={styles.muted}>
                        {t('showcase.tabs.tablesPanel')}
                      </p>
                    ),
                  },
                  {
                    id: 'arrangement',
                    label: t('showcase.tabs.arrangement'),
                    badge: t('common.soon'),
                    disabled: true,
                  },
                ]}
              />
            </div>
          </Card>

          <Card
            title={t('showcase.table.title')}
            subtitle={t('showcase.table.subtitle')}
          >
            <DataTable
              caption={t('showcase.table.caption')}
              columns={columns}
              rows={sampleGuests}
              getRowKey={(guest) => guest.id}
              renderCard={(guest) => (
                <>
                  <div className={styles.cardHead}>
                    <div>
                      <p className={styles.cardName}>{guest.name}</p>
                      <p className={styles.muted}>
                        <LtrText>{guest.phone}</LtrText>
                      </p>
                    </div>
                    <Badge
                      tone={statusTones[guest.status]}
                      icon={statusIcons[guest.status]}
                    >
                      {statusLabel(guest.status)}
                    </Badge>
                  </div>
                  <div className={styles.cardMeta}>
                    <span>
                      {t('showcase.table.allowedValue', {
                        count: guest.allowed,
                      })}
                    </span>
                    <span>
                      {guest.table === null
                        ? t('showcase.table.noTable')
                        : t('showcase.table.tableValue', {
                            number: guest.table,
                          })}
                    </span>
                  </div>
                </>
              )}
            />
          </Card>

          <Card
            title={t('showcase.overlays.title')}
            subtitle={t('showcase.overlays.subtitle')}
          >
            <div className={styles.row}>
              <Button variant="secondary" onClick={() => setDialogOpen(true)}>
                {t('showcase.overlays.openDialog')}
              </Button>
              <Button variant="secondary" onClick={() => setDrawerOpen(true)}>
                {t('showcase.overlays.openDrawer')}
              </Button>
              <Button
                variant="secondary"
                onClick={() =>
                  showToast({
                    tone: 'success',
                    message: t('showcase.overlays.toastSuccess'),
                  })
                }
              >
                {t('showcase.overlays.showToast')}
              </Button>
              <Button
                variant="secondary"
                onClick={() =>
                  showToast({
                    tone: 'danger',
                    message: t('showcase.overlays.toastError'),
                  })
                }
              >
                {t('showcase.overlays.showErrorToast')}
              </Button>
            </div>
          </Card>

          <Card
            title={t('showcase.states.title')}
            subtitle={t('showcase.states.subtitle')}
          >
            <div className={styles.grid}>
              <EmptyState
                icon={<UserPlus />}
                title={t('showcase.states.emptyTitle')}
                description={t('showcase.states.emptyBody')}
                action={
                  <Button icon={<Plus />}>
                    {t('showcase.states.emptyAction')}
                  </Button>
                }
              />
              <LoadingState />
              <ErrorState onRetry={() => undefined} />
            </div>
          </Card>

          <Card
            title={t('showcase.access.title')}
            subtitle={t('showcase.access.subtitle')}
          >
            <div className={styles.stack}>
              <ReadOnlyNotice />
              <div className={styles.row}>
                <EditGate
                  fallback={
                    <p className={styles.muted}>
                      {t('showcase.access.restricted')}
                    </p>
                  }
                >
                  <Button icon={<Plus />}>
                    {t('showcase.access.editableAction')}
                  </Button>
                </EditGate>
                <Button variant="secondary" icon={<Download />}>
                  {t('showcase.buttons.export')}
                </Button>
              </div>
            </div>
          </Card>

          <Card
            title={t('showcase.direction.title')}
            subtitle={t('showcase.direction.subtitle')}
          >
            <dl className={styles.definition}>
              <dt>{t('showcase.direction.phone')}</dt>
              <dd>
                <LtrText>{sampleContact.phone}</LtrText>
              </dd>
              <dt>{t('showcase.direction.email')}</dt>
              <dd>
                <LtrText>{sampleContact.email}</LtrText>
              </dd>
              <dt>{t('showcase.direction.link')}</dt>
              <dd>
                <LtrText>{sampleContact.url}</LtrText>
              </dd>
            </dl>
          </Card>

          <Card
            title={t('showcase.rsvpLanguage.title')}
            subtitle={t('showcase.rsvpLanguage.subtitle')}
          >
            <div className={styles.grid}>
              <div>
                <p className={styles.scopeLabel}>
                  {t('showcase.rsvpLanguage.english')}
                </p>
                <LocaleScope language="en">
                  <GuestFacingSample />
                </LocaleScope>
              </div>
              <div>
                <p className={styles.scopeLabel}>
                  {t('showcase.rsvpLanguage.hebrew')}
                </p>
                <LocaleScope language="he">
                  <GuestFacingSample />
                </LocaleScope>
              </div>
            </div>
          </Card>
        </div>

        <Dialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          title={t('showcase.overlays.dialogTitle')}
          footer={
            <>
              <Button variant="ghost" onClick={() => setDialogOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button variant="danger" onClick={() => setDialogOpen(false)}>
                {t('showcase.overlays.confirm')}
              </Button>
            </>
          }
        >
          {t('showcase.overlays.dialogBody')}
        </Dialog>
        <Drawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          title={t('showcase.overlays.drawerTitle')}
        >
          {t('showcase.overlays.drawerBody')}
        </Drawer>
      </AppShell>
    </EventAccessContext.Provider>
  )
}
