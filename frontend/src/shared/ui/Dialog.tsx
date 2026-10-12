import { X } from 'lucide-react'
import { useId, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { IconButton } from './Button.tsx'
import { cx } from './cx.ts'
import styles from './Dialog.module.css'
import { useModalDialog } from './useModalDialog.ts'

interface DialogProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  footer?: ReactNode
}

interface DialogFrameProps extends DialogProps {
  placement: 'center' | 'side'
}

function DialogFrame({
  open,
  onClose,
  title,
  children,
  footer,
  placement,
}: DialogFrameProps) {
  const { t } = useTranslation()
  const titleId = useId()
  const { ref, requestClose, dialogProps } = useModalDialog(open, onClose)

  return (
    <dialog
      ref={ref}
      className={cx(styles.dialog, styles[placement])}
      aria-labelledby={titleId}
      {...dialogProps}
    >
      {open && (
        <div className={styles.surface}>
          <header className={styles.header}>
            <h2 id={titleId} className={styles.title}>
              {title}
            </h2>
            <IconButton
              label={t('common.close')}
              variant="ghost"
              onClick={requestClose}
            >
              <X />
            </IconButton>
          </header>
          <div className={styles.body}>{children}</div>
          {footer && <footer className={styles.footer}>{footer}</footer>}
        </div>
      )}
    </dialog>
  )
}

export function Dialog(props: DialogProps) {
  return <DialogFrame {...props} placement="center" />
}

export function Drawer(props: DialogProps) {
  return <DialogFrame {...props} placement="side" />
}
