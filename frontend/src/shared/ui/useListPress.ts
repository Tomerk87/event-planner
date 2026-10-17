import { useRef, type SyntheticEvent } from 'react'

/** How long after a press in the list a blur still counts as part of it. */
const PRESS_MS = 1000

/**
 * Lets a list of options be tapped while the text box it belongs to keeps
 * the focus (and the phone keyboard stays up).
 *
 * Pressing the list does not take the focus. An iPhone ignores that on
 * `pointerdown` alone, so `mousedown` is stopped as well. Should the text box
 * blur anyway, `pressing()` tells its `onBlur` that the blur came from the
 * list, so the list stays open until the tap's click chooses.
 */
export function useListPress() {
  const pressedAt = useRef(0)

  function press(event: SyntheticEvent) {
    event.preventDefault()
    pressedAt.current = Date.now()
  }

  return {
    listProps: {
      onPointerDown: press,
      onMouseDown: press,
      onClick: () => {
        pressedAt.current = 0
      },
    },
    pressing: () => Date.now() - pressedAt.current < PRESS_MS,
  }
}
