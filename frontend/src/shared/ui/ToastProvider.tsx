import { CircleCheck, Info, TriangleAlert, X } from 'lucide-react'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useTranslation } from 'react-i18next'
import { cx } from './cx.ts'
import styles from './Toast.module.css'
import {
  ToastContext,
  type ToastApi,
  type ToastInput,
  type ToastTone,
} from './toastContext.ts'

const DISMISS_AFTER_MS = 5000

interface ToastEntry {
  id: number
  tone: ToastTone
  message: string
}

const icons = {
  success: CircleCheck,
  danger: TriangleAlert,
  info: Info,
} as const

interface ToastItemProps {
  toast: ToastEntry
  onDismiss: (id: number) => void
}

function ToastItem({ toast, onDismiss }: ToastItemProps) {
  const { t } = useTranslation()
  const Icon = icons[toast.tone]

  // An error stays until the user dismisses it; other toasts clear themselves.
  const persistent = toast.tone === 'danger'

  useEffect(() => {
    if (persistent) {
      return
    }
    const timer = window.setTimeout(() => onDismiss(toast.id), DISMISS_AFTER_MS)
    return () => window.clearTimeout(timer)
  }, [toast.id, persistent, onDismiss])

  return (
    <div
      className={cx(styles.toast, styles[toast.tone])}
      role={toast.tone === 'danger' ? 'alert' : 'status'}
    >
      <Icon className={styles.icon} aria-hidden="true" />
      <p className={styles.message}>{toast.message}</p>
      <button
        type="button"
        className={styles.dismiss}
        aria-label={t('toast.dismiss')}
        onClick={() => onDismiss(toast.id)}
      >
        <X aria-hidden="true" />
      </button>
    </div>
  )
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  const [toasts, setToasts] = useState<ToastEntry[]>([])
  const nextId = useRef(0)

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const showToast = useCallback(({ tone = 'info', message }: ToastInput) => {
    nextId.current += 1
    const id = nextId.current
    setToasts((current) => [...current, { id, tone, message }])
  }, [])

  const api = useMemo<ToastApi>(() => ({ showToast }), [showToast])

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        className={styles.region}
        role="region"
        aria-label={t('toast.region')}
      >
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}
