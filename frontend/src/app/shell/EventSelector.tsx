import { CalendarDays, ChevronDown } from 'lucide-react'
import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import type { ShellEvent } from './AppShell.tsx'
import styles from './AppShell.module.css'

interface EventSelectorProps {
  current: ShellEvent
  events: ShellEvent[]
  onNavigate: () => void
}

export function EventSelector({
  current,
  events,
  onNavigate,
}: EventSelectorProps) {
  const { t } = useTranslation()
  const listId = useId()
  const [open, setOpen] = useState(false)
  const others = events.filter((event) => event.id !== current.id)

  return (
    <div
      className={styles.selector}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          setOpen(false)
        }
      }}
    >
      <button
        type="button"
        className={styles.selectorButton}
        aria-expanded={open}
        aria-controls={listId}
        aria-label={t('eventSelector.label', { name: current.name })}
        disabled={others.length === 0}
        onClick={() => setOpen((value) => !value)}
      >
        <span className={styles.selectorThumb} aria-hidden="true">
          <CalendarDays />
        </span>
        <span className={styles.selectorName}>{current.name}</span>
        {others.length > 0 && (
          <ChevronDown className={styles.selectorChevron} aria-hidden="true" />
        )}
      </button>
      <ul
        id={listId}
        className={styles.selectorList}
        aria-label={t('eventSelector.list')}
        hidden={!open}
      >
        {others.map((event) => (
          <li key={event.id}>
            <Link
              to={`/events/${event.id}/dashboard`}
              className={styles.selectorOption}
              onClick={() => {
                setOpen(false)
                onNavigate()
              }}
            >
              {event.name}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
