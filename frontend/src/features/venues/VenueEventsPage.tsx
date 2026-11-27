import { CalendarDays, LayoutGrid, List, Search, SearchX } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router'
import type { VenueEventSummary } from '../../services/contracts/index.ts'
import { describeError } from '../../shared/errorMessage.ts'
import { Button, IconButton } from '../../shared/ui/Button.tsx'
import { Card } from '../../shared/ui/Card.tsx'
import { cx } from '../../shared/ui/cx.ts'
import { SelectField, TextField } from '../../shared/ui/Field.tsx'
import { PageHeader } from '../../shared/ui/PageHeader.tsx'
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from '../../shared/ui/States.tsx'
import { Tabs } from '../../shared/ui/Tabs.tsx'
import { PHONE_QUERY, useMediaQuery } from '../../shared/useMediaQuery.ts'
import { useQueryParams } from '../../shared/useQueryParams.ts'
import type { EventsView } from '../events/EventCard.tsx'
import styles from '../events/EventsPage.module.css'
import { VenueEventCard } from './VenueEventCard.tsx'
import venueStyles from './VenueEventsPage.module.css'
import { useVenueEvents, useVenueSpaces } from './venueQueries.ts'

type Filter = 'all' | 'upcoming' | 'past'

const ALL_SPACES = 'all'

function isFilter(value: string | null): value is Filter {
  return value === 'all' || value === 'upcoming' || value === 'past'
}

function matchesFilter(summary: VenueEventSummary, filter: Filter): boolean {
  return filter === 'all' || summary.isPast === (filter === 'past')
}

/**
 * A venue's My Events (V2.2, mockup #2): its events in every space, with the
 * status of each client (D115). Like the personal My Events, the filter,
 * space, search and layout live in the address, so a reload keeps them.
 */
export function VenueEventsPage() {
  const { t, i18n } = useTranslation()
  const { organizationId = '' } = useParams()
  const events = useVenueEvents(organizationId)
  const spaces = useVenueSpaces(organizationId)
  const isPhone = useMediaQuery(PHONE_QUERY)
  const { params, update, replaceAll } = useQueryParams()
  const [searchOpen, setSearchOpen] = useState(false)

  const filterParam = params.get('show')
  const filter: Filter = isFilter(filterParam) ? filterParam : 'all'
  const query = params.get('q') ?? ''
  const spaceParam = params.get('space') ?? ALL_SPACES
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
  const searched = all.filter(
    ({ event, space, client }) =>
      (spaceParam === ALL_SPACES || space.id === spaceParam) &&
      [event.name, client?.name ?? ''].some((text) =>
        text.toLocaleLowerCase(i18n.language).includes(needle),
      ),
  )
  const shown = searched.filter((summary) => matchesFilter(summary, filter))
  const count = (candidate: Filter) =>
    searched.filter((summary) => matchesFilter(summary, candidate)).length
  const showSearch = !isPhone || searchOpen || query !== ''

  const search = (
    <TextField
      label={t('events.search.label')}
      hideLabel
      type="search"
      icon={<Search />}
      placeholder={t('events.search.placeholder')}
      value={query}
      onChange={(event) => setParam('q', event.target.value)}
    />
  )

  return (
    <>
      <PageHeader
        title={t('pages.events')}
        subtitle={t('venueEvents.subtitle')}
      />

      <div className={styles.toolbar}>
        <div className={styles.tabs}>
          <Tabs
            variant="segmented"
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
          <div className={venueStyles.space}>
            <SelectField
              label={t('venueEvents.spaceFilter')}
              hideLabel
              value={spaceParam}
              onChange={(event) =>
                setParam(
                  'space',
                  event.target.value === ALL_SPACES ? null : event.target.value,
                )
              }
            >
              <option value={ALL_SPACES}>{t('venueEvents.allSpaces')}</option>
              {(spaces.data ?? []).map((space) => (
                <option key={space.id} value={space.id}>
                  {space.name}
                </option>
              ))}
            </SelectField>
          </div>
          {isPhone ? (
            <IconButton
              label={t('events.search.toggle')}
              aria-expanded={showSearch}
              onClick={() => setSearchOpen((value) => !value)}
            >
              <Search />
            </IconButton>
          ) : (
            <div className={styles.search}>{search}</div>
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

      {isPhone && showSearch && <div className={styles.phoneRow}>{search}</div>}

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
            icon={<CalendarDays />}
            title={t('venueEvents.empty.title')}
            description={t('venueEvents.empty.body')}
          />
        </Card>
      ) : shown.length === 0 ? (
        <Card>
          <EmptyState
            icon={<SearchX />}
            title={t('venueEvents.noMatch.title')}
            description={t('venueEvents.noMatch.body')}
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
              <VenueEventCard summary={summary} view={view} />
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
