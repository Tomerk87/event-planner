import { Search } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  filterGuests,
  guestFullName,
  NO_GUEST_FILTERS,
} from '../../domain/guestList.ts'
import type { Guest } from '../../domain/models.ts'
import {
  partiesAt,
  seatingCandidates,
  tableStatus,
} from '../../domain/seating.ts'
import type { SeatedTable } from '../../domain/tableList.ts'
import { useFormatters } from '../../i18n/format.ts'
import { describeError } from '../../shared/errorMessage.ts'
import { Badge } from '../../shared/ui/Badge.tsx'
import { Button } from '../../shared/ui/Button.tsx'
import { Dialog } from '../../shared/ui/Dialog.tsx'
import { TextField } from '../../shared/ui/Field.tsx'
import { Notice } from '../../shared/ui/Notice.tsx'
import { useAssignTable } from '../guests/guestQueries.ts'
import styles from './EventLayout.module.css'
import { AttendeeCount, TableStatusBadge } from './TableBits.tsx'

/** The longest list of guests to add that is shown; a search narrows it. */
const SHOWN_CANDIDATES = 50

interface ManageGuestsDialogProps {
  open: boolean
  onClose: () => void
  eventId: string
  item: SeatedTable | null
  tables: readonly SeatedTable[]
  guests: readonly Guest[]
  canEdit: boolean
}

function ManageGuests({
  eventId,
  item,
  tables,
  guests,
  canEdit,
}: Omit<ManageGuestsDialogProps, 'open' | 'onClose' | 'item'> & {
  item: SeatedTable
}) {
  const { t, i18n } = useTranslation()
  const format = useFormatters()
  const assign = useAssignTable(eventId)
  const [query, setQuery] = useState('')
  const [failure, setFailure] = useState<string | null>(null)
  const { table, assigned, available } = item
  const parties = partiesAt(table.id, guests)
  const candidates = filterGuests(
    seatingCandidates(table.id, guests),
    { ...NO_GUEST_FILTERS, query },
    i18n.language,
  )
  const shown = candidates.slice(0, SHOWN_CANDIDATES)
  const numberOf = new Map(tables.map((other) => [other.table.id, other]))
  const attendees = (guest: Guest) => (
    <AttendeeCount count={guest.confirmedAttendees ?? 0} />
  )

  function move(guest: Guest, tableId: string | null) {
    setFailure(null)
    assign.mutate(
      { guestId: guest.id, tableId },
      { onError: (error) => setFailure(describeError(t, error)) },
    )
  }

  return (
    <div className={styles.manage}>
      {failure && <Notice tone="danger" title={failure} announce />}
      <dl className={styles.facts}>
        <div>
          <dt>{t('layout.columns.capacity')}</dt>
          <dd>{format.number(table.capacity)}</dd>
        </div>
        <div>
          <dt>{t('layout.columns.assigned')}</dt>
          <dd>{format.number(assigned)}</dd>
        </div>
        <div>
          <dt>{t('layout.columns.available')}</dt>
          <dd className={available < 0 ? styles.negative : undefined}>
            {format.number(available)}
          </dd>
        </div>
        <div>
          <dt>{t('layout.columns.status')}</dt>
          <dd>
            <TableStatusBadge status={tableStatus(table.capacity, assigned)} />
          </dd>
        </div>
      </dl>

      <section className={styles.manageSection}>
        <h3 className={styles.sectionTitle}>
          {t('layout.manage.seated', { count: format.number(parties.length) })}
        </h3>
        {parties.length === 0 ? (
          <p className={styles.muted}>{t('layout.manage.noneSeated')}</p>
        ) : (
          <ul
            className={styles.parties}
            aria-label={t('layout.manage.seatedLabel')}
          >
            {parties.map((guest) => (
              <li key={guest.id} className={styles.party}>
                <span className={styles.partyName}>{guestFullName(guest)}</span>
                <span className={styles.muted}>{attendees(guest)}</span>
                {canEdit && (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={assign.isPending}
                    aria-label={t('layout.manage.removeNamed', {
                      name: guestFullName(guest),
                    })}
                    onClick={() => move(guest, null)}
                  >
                    {t('layout.manage.remove')}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {canEdit && (
        <section className={styles.manageSection}>
          <h3 className={styles.sectionTitle}>{t('layout.manage.add')}</h3>
          <p className={styles.muted}>{t('layout.manage.addHint')}</p>
          <TextField
            label={t('layout.manage.search')}
            hideLabel
            type="search"
            icon={<Search />}
            placeholder={t('layout.manage.searchPlaceholder')}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          {candidates.length === 0 ? (
            <p className={styles.muted}>
              {t(
                query.trim() === ''
                  ? 'layout.manage.noCandidates'
                  : 'layout.manage.noMatch',
              )}
            </p>
          ) : (
            <ul
              className={styles.parties}
              aria-label={t('layout.manage.addLabel')}
            >
              {shown.map((guest) => {
                const from =
                  guest.tableId === null ? null : numberOf.get(guest.tableId)
                const fits = (guest.confirmedAttendees ?? 0) <= available
                const name = guestFullName(guest)
                return (
                  <li key={guest.id} className={styles.party}>
                    <span className={styles.partyName}>{name}</span>
                    <span className={styles.muted}>{attendees(guest)}</span>
                    <Badge tone={from ? 'info' : 'neutral'}>
                      {from
                        ? t('layout.tableNumber', {
                            number: format.number(from.table.number),
                          })
                        : t('layout.manage.noTable')}
                    </Badge>
                    {fits ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={assign.isPending}
                        aria-label={t(
                          from
                            ? 'layout.manage.moveNamed'
                            : 'layout.manage.addNamed',
                          { name },
                        )}
                        onClick={() => move(guest, table.id)}
                      >
                        {t(
                          from
                            ? 'layout.manage.moveHere'
                            : 'layout.manage.addHere',
                        )}
                      </Button>
                    ) : (
                      <span className={styles.noFit}>
                        {t('layout.manage.noFit')}
                      </span>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
          {candidates.length > shown.length && (
            <p className={styles.muted}>
              {t('layout.manage.more', {
                shown: format.number(shown.length),
                total: format.number(candidates.length),
              })}
            </p>
          )}
        </section>
      )}
    </div>
  )
}

/** A table's parties, and for an editor the guests who could join it. */
export function ManageGuestsDialog({
  open,
  onClose,
  item,
  ...rest
}: ManageGuestsDialogProps) {
  const { t } = useTranslation()
  const format = useFormatters()

  return (
    <Dialog
      open={open && item !== null}
      onClose={onClose}
      title={t('layout.manage.title', {
        number: format.number(item?.table.number ?? 0),
      })}
      wide
      scrollableContent={!rest.canEdit}
      footer={<Button onClick={onClose}>{t('layout.manage.done')}</Button>}
    >
      {item && <ManageGuests item={item} {...rest} />}
    </Dialog>
  )
}
