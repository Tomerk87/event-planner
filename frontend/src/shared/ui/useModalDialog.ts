import { useEffect, useRef, type MouseEvent, type RefObject } from 'react'

interface ModalDialog {
  ref: RefObject<HTMLDialogElement | null>
  onBackdropClick: (event: MouseEvent<HTMLDialogElement>) => void
}

/**
 * Drives a native <dialog> as a modal: the browser traps focus, closes on
 * Escape and restores focus to the opener.
 */
export function useModalDialog(
  open: boolean,
  onClose: () => void,
): ModalDialog {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) {
      return
    }
    if (open && !dialog.open) {
      dialog.showModal()
    } else if (!open && dialog.open) {
      dialog.close()
    }
  }, [open])

  function onBackdropClick(event: MouseEvent<HTMLDialogElement>) {
    if (event.target === event.currentTarget) {
      onClose()
    }
  }

  return { ref, onBackdropClick }
}
