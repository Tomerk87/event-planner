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
  /**
   * For long content with nothing to tab to (a read-only list): lets the
   * content itself take focus so it can be scrolled from the keyboard.
   */
  scrollableContent?: boolean
  /** Extra width, for content such as a table. Centered dialogs only. */
  wide?: boolean
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
  scrollableContent = false,
  wide = false,
  placement,
}: DialogFrameProps) {
  const { t } = useTranslation()
  const titleId = useId()
  const { ref, requestClose, dialogProps } = useModalDialog(open, onClose)

  return (
    <dialog
      ref={ref}
      className={cx(styles.dialog, styles[placement], wide && styles.wide)}
      aria-labelledby={titleId}
      {...dialogProps}
    >
      {open && (
        <div className={styles.surface}>
          <div className={styles.header}>
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
          </div>
          <div
            className={styles.body}
            tabIndex={scrollableContent ? 0 : undefined}
          >
            {children}
          </div>
          {footer && <div className={styles.footer}>{footer}</div>}
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
