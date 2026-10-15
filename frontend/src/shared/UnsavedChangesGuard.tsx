import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useBlocker } from 'react-router'
import { Button } from './ui/Button.tsx'
import { Dialog } from './ui/Dialog.tsx'

/**
 * Asks before leaving the page while there are unsaved changes. With
 * `onSave`, the changes can also be saved on the way out: the page is left
 * only when the save succeeds; otherwise the page stays, showing why.
 */
export function UnsavedChangesGuard({
  active,
  onSave,
}: {
  active: boolean
  /** Saves the changes; resolves to whether they were saved. */
  onSave?: () => Promise<boolean>
}) {
  const { t } = useTranslation()
  const blocker = useBlocker(active)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (!active) {
      return
    }
    const warn = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [active])

  async function saveAndLeave() {
    if (!onSave) {
      return
    }
    setIsSaving(true)
    const saved = await onSave()
    setIsSaving(false)
    if (saved) {
      blocker.proceed?.()
    } else {
      blocker.reset?.()
    }
  }

  return (
    <Dialog
      open={blocker.state === 'blocked'}
      onClose={() => {
        if (!isSaving) {
          blocker.reset?.()
        }
      }}
      title={t('common.unsaved.title')}
      footer={
        <>
          <Button
            data-autofocus
            variant="ghost"
            disabled={isSaving}
            onClick={() => blocker.reset?.()}
          >
            {t('common.unsaved.stay')}
          </Button>
          <Button
            variant="danger"
            disabled={isSaving}
            onClick={() => blocker.proceed?.()}
          >
            {t('common.unsaved.leave')}
          </Button>
          {onSave && (
            <Button loading={isSaving} onClick={() => void saveAndLeave()}>
              {t('common.unsaved.save')}
            </Button>
          )}
        </>
      }
    >
      <p>{t('common.unsaved.body')}</p>
    </Dialog>
  )
}
