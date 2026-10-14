import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useBlocker } from 'react-router'
import { Button } from './ui/Button.tsx'
import { Dialog } from './ui/Dialog.tsx'

/** Asks before leaving the page while there are unsaved changes. */
export function UnsavedChangesGuard({ active }: { active: boolean }) {
  const { t } = useTranslation()
  const blocker = useBlocker(active)

  useEffect(() => {
    if (!active) {
      return
    }
    const warn = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [active])

  return (
    <Dialog
      open={blocker.state === 'blocked'}
      onClose={() => blocker.reset?.()}
      title={t('common.unsaved.title')}
      footer={
        <>
          <Button
            data-autofocus
            variant="ghost"
            onClick={() => blocker.reset?.()}
          >
            {t('common.unsaved.stay')}
          </Button>
          <Button variant="danger" onClick={() => blocker.proceed?.()}>
            {t('common.unsaved.leave')}
          </Button>
        </>
      }
    >
      <p>{t('common.unsaved.body')}</p>
    </Dialog>
  )
}
