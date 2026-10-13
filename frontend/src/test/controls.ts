import { fireEvent } from '@testing-library/react'

function isDropdown(element: Element): boolean {
  return element.matches('button[role="combobox"]')
}

/** The choices of a dropdown, as shown when it is open. */
export function optionLabels(dropdown: HTMLElement): string[] {
  fireEvent.click(dropdown)
  const list = document.getElementById(
    dropdown.getAttribute('aria-controls') ?? '',
  )
  const labels = Array.from(
    list?.querySelectorAll('[role="option"]') ?? [],
  ).map((option) => option.textContent ?? '')
  fireEvent.click(dropdown)
  return labels
}

/** Opens a dropdown and chooses the option with the given value. */
export function chooseOption(dropdown: HTMLElement, value: string): void {
  fireEvent.click(dropdown)
  const list = document.getElementById(
    dropdown.getAttribute('aria-controls') ?? '',
  )
  const option = Array.from(
    list?.querySelectorAll<HTMLElement>('[role="option"]') ?? [],
  ).find((candidate) => candidate.dataset.value === value)
  if (!option) {
    throw new Error(`the dropdown has no option with the value "${value}"`)
  }
  fireEvent.click(option)
}

/**
 * Sets a form control's value the way a person would: typing into a text
 * box, or opening a dropdown and choosing from it.
 */
export function change(
  control: HTMLElement,
  init: { target: Record<string, unknown> },
): void {
  if (isDropdown(control)) {
    chooseOption(control, String(init.target.value))
  } else {
    fireEvent.change(control, init)
  }
}
