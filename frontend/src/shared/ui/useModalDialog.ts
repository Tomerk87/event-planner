import { useEffect, useRef, type MouseEvent, type RefObject } from 'react'

interface ModalDialog {
  ref: RefObject<HTMLDialogElement | null>
  /** Ask the dialog to close; `onClose` then runs once from its close event. */
  requestClose: () => void
  dialogProps: {
    onClose: () => void
    onClick: (event: MouseEvent<HTMLDialogElement>) => void
  }
}

/**
 * Drives a native <dialog> as a modal: the browser contains focus, closes on
 * Escape and restores focus to the opener. `onClose` is called exactly once
 * when the user closes the dialog, and not when the parent closes it by
 * setting `open` to false.
 */
export function useModalDialog(
  open: boolean,
  onClose: () => void,
): ModalDialog {
  const ref = useRef<HTMLDialogElement>(null)
  const openRef = useRef(open)

  useEffect(() => {
    openRef.current = open
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

  function requestClose() {
    ref.current?.close()
  }

  return {
    ref,
    requestClose,
    dialogProps: {
      onClose: () => {
        if (openRef.current) {
          openRef.current = false
          onClose()
        }
      },
      onClick: (event) => {
        if (event.target === event.currentTarget) {
          requestClose()
        }
      },
    },
  }
}
