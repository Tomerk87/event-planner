import {
  CalendarPlus,
  LayoutGrid,
  List,
  Plus,
  Search,
  SearchX,
} from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { EventSummary } from '../../services/contracts/index.ts'
import { useEvents } from '../../services/queries.ts'
import { describeError } from '../../shared/errorMessage.ts'
import { Button, IconButton } from '../../shared/ui/Button.tsx'
import { Card } from '../../shared/ui/Card.tsx'
import { cx } from '../../shared/ui/cx.ts'
import { TextField } from '../../shared/ui/Field.tsx'
import { PageHeader } from '../../shared/ui/PageHeader.tsx'
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from '../../shared/ui/States.tsx'
import { Tabs } from '../../shared/ui/Tabs.tsx'
import { PHONE_QUERY, useMediaQuery } from '../../shared/useMediaQuery.ts'
import { useQueryParams } from '../../shared/useQueryParams.ts'
import { DeleteEventDialog } from './DeleteEventDialog.tsx'
import { EventCard, type EventsView } from './EventCard.tsx'
import { EventDialog } from './EventDialog.tsx'
import styles from './EventsPage.module.css'

type Filter = 'all' | 'upcoming' | 'past'

type OpenDialog =
  { kind: 'create' } | { kind: 'duplicate' | 'delete'; summary: EventSummary }

function isFilter(value: string | null): value is Filter {
  return value === 'all' || value === 'upcoming' || value === 'past'
}

function matchesFilter(summary: EventSummary, filter: Filter): boolean {
  return filter === 'all' || summary.isPast === (filter === 'past')
}

export function EventsPage() {
  const { t, i18n } = useTranslation()
  const events = useEvents()
  const isPhone = useMediaQuery(PHONE_QUERY)
  // The filter, search and layout live in the address, so a reload keeps them.
  const { params, update, replaceAll } = useQueryParams()
  const [dialog, setDialog] = useState<OpenDialog | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)

  const filterParam = params.get('show')
  const filter: Filter = isFilter(filterParam) ? filterParam : 'all'
  const query = params.get('q') ?? ''
  const viewParam = params.get('view')
  const view: EventsView =
    viewParam === 'grid' || viewParam === 'list'
      ? viewParam
      : isPhone
        ? 'list'
        : 'grid'

  const setParam = (name: string, value: string | null) =>
    update({ [name]: value })

  const all = events.data ?? []
  const needle = query.trim().toLocaleLowerCase(i18n.language)
  const searched = all.filter(({ event }) =>
    event.name.toLocaleLowerCase(i18n.language).includes(needle),
  )
  // Upcoming events soonest first, then past events most recent first.
  const shown = searched
    .filter((summary) => matchesFilter(summary, filter))
    .sort((a, b) =>
      a.isPast === b.isPast
        ? (a.isPast ? -1 : 1) * a.event.startsAt.localeCompare(b.event.startsAt)
        : a.isPast
          ? 1
          : -1,
    )
  const count = (candidate: Filter) =>
    searched.filter((summary) => matchesFilter(summary, candidate)).length

  const createButton = (
    <Button
      icon={<Plus />}
      fullWidth={isPhone}
      onClick={() => setDialog({ kind: 'create' })}
    >
      {t('events.create.action')}
    </Button>
  )
  const showSearch = !isPhone || searchOpen || query !== ''
  const closeDialog = () => setDialog(null)

  return (
    <>
      <PageHeader
        title={t('pages.events')}
        subtitle={t('events.subtitle')}
        actions={isPhone ? undefined : createButton}
      />

      <div className={styles.toolbar}>
        <div className={styles.tabs}>
          <Tabs
            label={t('events.filter.label')}
            value={filter}
            onChange={(id) => setParam('show', id === 'all' ? null : id)}
            tabs={[
              { id: 'all', label: t('events.filter.all'), count: count('all') },
              {
                id: 'upcoming',
                label: t('events.filter.upcoming'),
                count: count('upcoming'),
              },
              {
                id: 'past',
                label: t('events.filter.past'),
                count: count('past'),
              },
            ]}
          />
        </div>
        <div className={styles.tools}>
          {isPhone && (
            <IconButton
              label={t('events.search.toggle')}
              aria-expanded={showSearch}
              onClick={() => setSearchOpen((value) => !value)}
            >
              <Search />
            </IconButton>
          )}
          {!isPhone && (
            <div className={styles.search}>
              <TextField
                label={t('events.search.label')}
                hideLabel
                type="search"
                icon={<Search />}
                placeholder={t('events.search.placeholder')}
                value={query}
                onChange={(event) => setParam('q', event.target.value)}
              />
            </div>
          )}
          <div
            className={styles.viewToggle}
            role="group"
            aria-label={t('events.view.label')}
          >
            {(['grid', 'list'] as const).map((option) => (
              <button
                key={option}
                type="button"
                className={cx(
                  styles.viewButton,
                  view === option && styles.viewButtonActive,
                )}
                aria-label={t(`events.view.${option}`)}
                title={t(`events.view.${option}`)}
                aria-pressed={view === option}
                onClick={() => setParam('view', option)}
              >
                {option === 'grid' ? (
                  <LayoutGrid aria-hidden="true" />
                ) : (
                  <List aria-hidden="true" />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {isPhone && showSearch && (
        <div className={styles.phoneRow}>
          <TextField
            label={t('events.search.label')}
            hideLabel
            type="search"
            icon={<Search />}
            placeholder={t('events.search.placeholder')}
            value={query}
            onChange={(event) => setParam('q', event.target.value)}
          />
        </div>
      )}
      {isPhone && <div className={styles.phoneRow}>{createButton}</div>}

      {events.isPending ? (
        <Card>
          <LoadingState />
        </Card>
      ) : events.isError ? (
        <Card>
          <ErrorState
            description={describeError(t, events.error)}
            onRetry={() => void events.refetch()}
          />
        </Card>
      ) : all.length === 0 ? (
        <Card>
          <EmptyState
            icon={<CalendarPlus />}
            title={t('events.empty.title')}
            description={t('events.empty.body')}
            action={
              <Button
                icon={<Plus />}
                onClick={() => setDialog({ kind: 'create' })}
              >
                {t('events.empty.action')}
              </Button>
            }
          />
        </Card>
      ) : shown.length === 0 ? (
        <Card>
          <EmptyState
            icon={<SearchX />}
            title={t('events.noMatch.title')}
            description={t('events.noMatch.body')}
            action={
              <Button variant="secondary" onClick={() => replaceAll({})}>
                {t('events.noMatch.action')}
              </Button>
            }
          />
        </Card>
      ) : (
        <ul
          className={cx(styles.events, styles[view])}
          aria-label={t('events.listLabel')}
        >
          {shown.map((summary) => (
            <li key={summary.event.id}>
              <EventCard
                summary={summary}
                view={view}
                onDuplicate={() => setDialog({ kind: 'duplicate', summary })}
                onDelete={() => setDialog({ kind: 'delete', summary })}
              />
            </li>
          ))}
        </ul>
      )}

      <EventDialog open={dialog?.kind === 'create'} onClose={closeDialog} />
      <EventDialog
        open={dialog?.kind === 'duplicate'}
        onClose={closeDialog}
        source={dialog?.kind === 'duplicate' ? dialog.summary.event : null}
      />
      <DeleteEventDialog
        open={dialog?.kind === 'delete'}
        onClose={closeDialog}
        event={dialog?.kind === 'delete' ? dialog.summary.event : null}
      />
    </>
  )
}
