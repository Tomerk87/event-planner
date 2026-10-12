import { createContext, useContext } from 'react'

export type ToastTone = 'success' | 'danger' | 'info'

export interface ToastInput {
  tone?: ToastTone
  message: string
}

export interface ToastApi {
  showToast: (toast: ToastInput) => void
}

export const ToastContext = createContext<ToastApi | null>(null)

export function useToast(): ToastApi {
  const api = useContext(ToastContext)
  if (!api) {
    throw new Error('useToast must be used inside a ToastProvider')
  }
  return api
}
