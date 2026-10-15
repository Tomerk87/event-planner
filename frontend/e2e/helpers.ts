import type { Locator, Page } from '@playwright/test'

/**
 * Returns the navigation container. On the compact layout the navigation is
 * behind the menu button, so the drawer is opened first.
 */
export async function openNavigation(page: Page): Promise<Locator> {
  const menuButton = page.getByRole('button', { name: /Open menu|פתיחת תפריט/ })
  if (await menuButton.isVisible()) {
    await menuButton.click()
    return page.getByRole('dialog')
  }
  return page.getByRole('complementary')
}

/**
 * Starts the visit already inside the demo, as if Try Demo had been chosen,
 * so a test can open a page of the application directly. Applies to every
 * page load of the test, and leaves a session chosen during the test alone.
 */
export async function startInDemo(page: Page): Promise<void> {
  await page.addInitScript(() => {
    if (window.localStorage.getItem('event-planner.session') === null) {
      window.localStorage.setItem(
        'event-planner.session',
        JSON.stringify({ workspace: 'demo' }),
      )
    }
  })
}

/** Opens a dropdown and chooses the option with the given value. */
export async function chooseOption(
  dropdown: Locator,
  value: string,
): Promise<void> {
  await dropdown.click()
  await dropdown
    .page()
    .locator(`[role="option"][data-value="${value}"]`)
    .click()
}

/**
 * An email no other test uses, since accounts live in the real (test)
 * database and both screen sizes run at the same time.
 */
export function uniqueEmail(name: string): string {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  return `${name}.${suffix}@example.com`
}

export const TEST_PASSWORD = 'correct-horse-battery'
