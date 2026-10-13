import { ChevronDown } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { EventCover } from '../../shared/ui/EventCover.tsx'
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
  const containerRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const others = events.filter((event) => event.id !== current.id)

  useEffect(() => {
    if (!open) {
      return
    }
    function closeIfOutside(event: Event) {
      if (
        event.target instanceof Node &&
        !containerRef.current?.contains(event.target)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('pointerdown', closeIfOutside)
    document.addEventListener('focusin', closeIfOutside)
    return () => {
      document.removeEventListener('pointerdown', closeIfOutside)
      document.removeEventListener('focusin', closeIfOutside)
    }
  }, [open])

  return (
    <div
      ref={containerRef}
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
        <EventCover eventId={current.id} size="thumb" />
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
