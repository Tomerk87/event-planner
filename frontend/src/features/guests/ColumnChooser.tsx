import { SlidersHorizontal } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '../../shared/ui/Button.tsx'
import { Checkbox } from '../../shared/ui/Checkbox.tsx'
import { Popover } from '../../shared/ui/Popover.tsx'
import {
  GUEST_COLUMNS,
  isRequiredColumn,
  REQUIRED_GUEST_COLUMNS,
  type GuestColumnId,
} from './guestColumns.ts'
import styles from './Guests.module.css'

interface ColumnChooserProps {
  visible: readonly GuestColumnId[]
  onChange: (columns: GuestColumnId[]) => void
}

/** Chooses which columns the guests table shows. Name and Phone always are. */
export function ColumnChooser({ visible, onChange }: ColumnChooserProps) {
  const { t } = useTranslation()
  const shown = new Set(visible)

  function toggle(column: GuestColumnId, checked: boolean) {
    onChange(
      GUEST_COLUMNS.filter((candidate) =>
        candidate === column ? checked : shown.has(candidate),
      ),
    )
  }

  return (
    <Popover
      label={t('guests.columns.button')}
      triggerClassName={styles.iconControl}
      trigger={<SlidersHorizontal aria-hidden="true" />}
    >
      <div className={styles.chooser}>
        <div className={styles.chooserActions}>
          <Button
            variant="ghost"
            size="sm"
            disabled={shown.size === GUEST_COLUMNS.length}
            onClick={() => onChange([...GUEST_COLUMNS])}
          >
            {t('guests.columns.selectAll')}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={shown.size === REQUIRED_GUEST_COLUMNS.length}
            onClick={() => onChange([...REQUIRED_GUEST_COLUMNS])}
          >
            {t('guests.columns.clear')}
          </Button>
        </div>
        <ul className={styles.chooserList}>
          {GUEST_COLUMNS.map((column) => (
            <li key={column}>
              <Checkbox
                label={
                  isRequiredColumn(column)
                    ? t('guests.columns.alwaysShown', {
                        column: t(`guests.columns.${column}`),
                      })
                    : t(`guests.columns.${column}`)
                }
                checked={shown.has(column)}
                disabled={isRequiredColumn(column)}
                onChange={(event) => toggle(column, event.target.checked)}
              />
            </li>
          ))}
        </ul>
      </div>
    </Popover>
  )
}
