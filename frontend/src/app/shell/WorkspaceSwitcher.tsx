import { Building2, Check, ChevronsUpDown, User } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import type { VenueWorkspace } from '../../services/contracts/index.ts'
import { cx } from '../../shared/ui/cx.ts'
import shellStyles from './AppShell.module.css'
import styles from './WorkspaceSwitcher.module.css'

interface WorkspaceSwitcherProps {
  /** The venue shown now, or null for the personal workspace. */
  currentVenueId: string | null
  /** The venues the user belongs to, by name (D112). */
  workspaces: readonly VenueWorkspace[]
  onNavigate: () => void
}

interface Option {
  key: string
  to: string
  name: string
  hint: string
  venue: boolean
}

/**
 * Switches between the personal workspace and each venue the user belongs to
 * (V2.2, mockup #1). Shown only to venue members; anyone else never sees it.
 */
export function WorkspaceSwitcher({
  currentVenueId,
  workspaces,
  onNavigate,
}: WorkspaceSwitcherProps) {
  const { t } = useTranslation()
  const listId = useId()
  const containerRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)

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

  if (workspaces.length === 0) {
    return null
  }

  const options: Option[] = [
    {
      key: 'personal',
      to: '/events',
      name: t('workspace.personal'),
      hint: t('workspace.personalHint'),
      venue: false,
    },
    ...workspaces.map(({ organization, role }) => ({
      key: organization.id,
      to: `/venues/${organization.id}/events`,
      name: organization.name,
      hint: t(`venueRoles.${role}`),
      venue: true,
    })),
  ]
  const currentKey = currentVenueId ?? 'personal'
  const current = options.find((option) => option.key === currentKey)
  if (!current) {
    return null
  }
  const currentHint = current.venue
    ? t('workspace.venueHint', { role: current.hint })
    : current.hint
  const Icon = current.venue ? Building2 : User

  return (
    <div
      ref={containerRef}
      className={cx(shellStyles.selector, styles.root)}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          setOpen(false)
        }
      }}
    >
      <button
        type="button"
        className={shellStyles.selectorButton}
        aria-expanded={open}
        aria-controls={listId}
        aria-label={t('workspace.label', { name: current.name })}
        onClick={() => setOpen((value) => !value)}
      >
        <span className={styles.tile} aria-hidden="true">
          <Icon />
        </span>
        <span className={styles.text}>
          <span className={shellStyles.selectorName}>{current.name}</span>
          <span className={styles.hint}>{currentHint}</span>
        </span>
        <ChevronsUpDown
          className={shellStyles.selectorChevron}
          aria-hidden="true"
        />
      </button>
      <div id={listId} className={styles.panel} hidden={!open}>
        <p className={styles.heading}>{t('workspace.switch')}</p>
        <ul className={styles.list}>
          {options.map((option) => {
            const OptionIcon = option.venue ? Building2 : User
            const isCurrent = option.key === currentKey
            return (
              <li key={option.key}>
                <Link
                  to={option.to}
                  className={cx(styles.option, isCurrent && styles.current)}
                  aria-current={isCurrent ? 'true' : undefined}
                  onClick={() => {
                    setOpen(false)
                    onNavigate()
                  }}
                >
                  <span className={styles.optionTile} aria-hidden="true">
                    <OptionIcon />
                  </span>
                  <span className={styles.text}>
                    <span className={styles.optionName}>{option.name}</span>
                    <span className={styles.optionHint}>{option.hint}</span>
                  </span>
                  {isCurrent && (
                    <Check className={styles.check} aria-hidden="true" />
                  )}
                </Link>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
