import {
  useEffect,
  useRef,
  type MouseEvent,
  type RefObject,
  type SyntheticEvent,
} from 'react'

interface ModalDialog {
  ref: RefObject<HTMLDialogElement | null>
  /** Ask the dialog to close; `onClose` then runs once from its close event. */
  requestClose: () => void
  dialogProps: {
    onClose: (event: SyntheticEvent<HTMLDialogElement>) => void
    onClick: (event: MouseEvent<HTMLDialogElement>) => void
  }
}

/**
 * Drives a native <dialog> as a modal: the browser contains focus, closes on
 * Escape and restores focus to the opener. On opening, focus goes to the
 * element marked `data-autofocus`, if any, otherwise to the first control. `onClose` is called exactly once
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
      dialog.querySelector<HTMLElement>('[data-autofocus]')?.focus()
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
      onClose: (event) => {
        // React passes a dialog's close event on to the dialogs around it;
        // one opened from inside this one must not close this one too.
        if (event.target !== event.currentTarget) {
          return
        }
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
