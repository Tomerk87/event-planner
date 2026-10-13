import { useTranslation } from 'react-i18next'
import { EVENT_LIMITS } from '../../domain/events.ts'
import { Button } from '../../shared/ui/Button.tsx'
import { Dialog } from '../../shared/ui/Dialog.tsx'
import styles from './EventSettings.module.css'

interface EventRulesDialogProps {
  open: boolean
  onClose: () => void
}

/** The rules every event follows, for reading only. */
export function EventRulesDialog({ open, onClose }: EventRulesDialogProps) {
  const { t } = useTranslation()

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('settings.rules.title')}
      scrollableContent
      footer={<Button onClick={onClose}>{t('common.close')}</Button>}
    >
      <ul className={styles.rules}>
        <li>{t('settings.rules.lock')}</li>
        <li>{t('settings.rules.rsvp')}</li>
        <li>{t('settings.rules.exports')}</li>
        <li>{t('settings.rules.date')}</li>
        <li>{t('settings.rules.maxAttendees', EVENT_LIMITS.maxAttendees)}</li>
        <li>{t('settings.rules.allowed', EVENT_LIMITS.allowedAttendees)}</li>
        <li>{t('settings.rules.warnings')}</li>
        <li>{t('settings.rules.roles')}</li>
      </ul>
    </Dialog>
  )
}
