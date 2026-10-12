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
