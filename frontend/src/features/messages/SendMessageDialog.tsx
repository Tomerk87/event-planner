import { MessageCircle } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { describeError } from '../../shared/errorMessage.ts'
import { openExternal } from '../../shared/openExternal.ts'
import { Button } from '../../shared/ui/Button.tsx'
import { ButtonLink } from '../../shared/ui/ButtonLink.tsx'
import { Dialog } from '../../shared/ui/Dialog.tsx'
import { Notice } from '../../shared/ui/Notice.tsx'
import { ErrorState, LoadingState } from '../../shared/ui/States.tsx'
import { useToast } from '../../shared/ui/toastContext.ts'
import styles from './Messages.module.css'
import { useSendMessage, useSendPreview } from './messageQueries.ts'
import { MessageText } from './MessageText.tsx'

interface SendMessageDialogProps {
  eventId: string
  /** The guest to send to; null keeps the dialog closed. */
  guest: { id: string; name: string } | null
  onClose: () => void
}

/**
 * Shows the message a guest will get and, on confirmation, opens WhatsApp
 * with it and records the send.
 */
export function SendMessageDialog({
  eventId,
  guest,
  onClose,
}: SendMessageDialogProps) {
  const { t } = useTranslation()
  const { showToast } = useToast()
  const preview = useSendPreview(eventId, guest?.id ?? null)
  const send = useSendMessage(eventId)
  const [failure, setFailure] = useState<string | null>(null)
  const isEmpty = preview.data?.message.trim() === ''

  function close() {
    setFailure(null)
    onClose()
  }

  function confirm() {
    if (!guest || !preview.data || isEmpty) {
      return
    }
    // Opened straight from the click, before anything is awaited, so the
    // browser does not treat it as a pop-up.
    openExternal(preview.data.launchUrl)
    setFailure(null)
    send.mutate(guest.id, {
      onSuccess: () => {
        showToast({
          tone: 'success',
          message: t('messages.send.done', { name: guest.name }),
        })
        close()
      },
      onError: (error) => setFailure(describeError(t, error)),
    })
  }

  return (
    <Dialog
      open={guest !== null}
      onClose={close}
      title={t('messages.send.title')}
      footer={
        <>
          <Button variant="ghost" onClick={close}>
            {t('common.cancel')}
          </Button>
          <Button
            icon={<MessageCircle />}
            loading={send.isPending}
            disabled={!preview.data || isEmpty}
            onClick={confirm}
          >
            {t('messages.send.confirm')}
          </Button>
        </>
      }
    >
      <div className={styles.sendDialog}>
        {failure && <Notice tone="danger" title={failure} announce />}
        <p className={styles.sendTo}>
          {t('messages.send.to', { name: guest?.name ?? '' })}
        </p>
        {preview.isError ? (
          <ErrorState
            description={describeError(t, preview.error)}
            onRetry={() => void preview.refetch()}
          />
        ) : !preview.data ? (
          <LoadingState />
        ) : isEmpty ? (
          <Notice
            tone="warning"
            title={t('messages.send.emptyTemplate')}
            action={
              <ButtonLink
                to={`/events/${eventId}/messages`}
                variant="secondary"
              >
                {t('messages.send.editTemplate')}
              </ButtonLink>
            }
          />
        ) : (
          <>
            <div className={styles.bubble}>
              <MessageText message={preview.data.message} />
            </div>
            <p className={styles.note}>{t('messages.send.body')}</p>
            <p className={styles.note}>{t('messages.send.countNote')}</p>
          </>
        )}
      </div>
    </Dialog>
  )
}
