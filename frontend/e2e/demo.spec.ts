import { expect, test, type Page } from '@playwright/test'
import { openNavigation } from './helpers.ts'

const MAIN_EVENT = '/events/evt-1/guests'

/** The demo controls are in the top bar on desktop and in the drawer on a phone. */
async function openDemoTools(page: Page) {
  const container = await openNavigation(page)
  const inDrawer = (await container.getAttribute('role')) !== null
  return (
    (await page.getByRole('dialog').count()) > 0 && inDrawer
      ? page.getByRole('dialog')
      : page
  ).getByRole('group', { name: 'Demo controls' })
}

async function closeDrawerIfOpen(page: Page) {
  const close = page.getByRole('button', { name: 'Close menu' })
  if (await close.isVisible()) {
    await close.click()
  }
}

test('a first visit shows generated demo data with no setup', async ({
  page,
}) => {
  await page.goto(MAIN_EVENT)

  await expect(page.getByRole('heading', { name: 'Guests' })).toBeVisible()
  await expect(page.getByText('Demo Mode')).toBeAttached()
  await expect(page.getByText('Your role in this event: Owner')).toBeAttached()

  const nav = await openNavigation(page)
  await expect(
    nav.getByRole('button', { name: /Current event: Maya & Daniel/ }),
  ).toBeVisible()
  await expect(nav.getByRole('link', { name: 'Permissions' })).toBeVisible()
})

test('a simulated role changes what is shown and survives a reload', async ({
  page,
}) => {
  await page.goto(MAIN_EVENT)
  await expect(page.getByRole('heading', { name: 'Guests' })).toBeVisible()

  const tools = await openDemoTools(page)
  await tools
    .getByRole('combobox', { name: 'Simulated role' })
    .selectOption('VIEWER')
  await closeDrawerIfOpen(page)

  await expect(page.getByText('Your role in this event: Viewer')).toBeAttached()
  await expect(page.getByText('View-only access')).toBeVisible()

  await page.reload()

  await expect(page.getByText('View-only access')).toBeVisible()
  const nav = await openNavigation(page)
  await expect(nav.getByRole('link', { name: 'Guests' })).toBeVisible()
  await expect(nav.getByRole('link', { name: 'Permissions' })).toHaveCount(0)
})

test('Reset Demo asks for confirmation and restores the original state', async ({
  page,
}) => {
  await page.goto(MAIN_EVENT)
  let tools = await openDemoTools(page)
  await tools
    .getByRole('combobox', { name: 'Simulated role' })
    .selectOption('VIEWER')
  await closeDrawerIfOpen(page)
  await expect(page.getByText('View-only access')).toBeVisible()

  tools = await openDemoTools(page)
  await tools.getByRole('button', { name: 'Reset Demo' }).click()
  const dialog = page.getByRole('dialog', { name: 'Reset the demo?' })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Reset Demo' }).click()

  await expect(
    page.getByText('The demo was reset to its original data.'),
  ).toBeVisible()
  await closeDrawerIfOpen(page)
  await expect(page.getByText('View-only access')).toHaveCount(0)
  await expect(page.getByText('Your role in this event: Owner')).toBeAttached()
})

test('demo data is kept per browser and not shared between visitors', async ({
  page,
  browser,
}) => {
  await page.goto(MAIN_EVENT)
  const tools = await openDemoTools(page)
  await tools
    .getByRole('combobox', { name: 'Simulated role' })
    .selectOption('VIEWER')
  await closeDrawerIfOpen(page)
  await expect(page.getByText('View-only access')).toBeVisible()

  const otherVisitor = await browser.newContext()
  const otherPage = await otherVisitor.newPage()
  await otherPage.goto(`${new URL(page.url()).origin}${MAIN_EVENT}`)

  await expect(otherPage.getByRole('heading', { name: 'Guests' })).toBeVisible()
  await expect(otherPage.getByText('View-only access')).toHaveCount(0)
  await otherVisitor.close()
})

test('a past event is shown as read-only', async ({ page }) => {
  await page.goto('/events/evt-5/dashboard')

  await expect(page.getByText('This event has ended')).toBeVisible()
})

test('an event that does not exist shows the not-found page', async ({
  page,
}) => {
  await page.goto('/events/no-such-event/guests')

  await expect(
    page.getByRole('heading', { name: 'Page not found' }),
  ).toBeVisible()
})

test('a slow response shows a loading state first', async ({ page }) => {
  await page.goto(`${MAIN_EVENT}?demoDelay=1500`)

  await expect(page.getByRole('main').getByRole('status')).toHaveText(
    'Loading…',
  )
  await expect(page.getByRole('heading', { name: 'Guests' })).toBeVisible()
})

test('a failed load shows an error with a retry', async ({ page }) => {
  await page.goto(`${MAIN_EVENT}?demoFail=events.get`)

  const alert = page.getByRole('main').getByRole('alert')
  await expect(alert).toContainText('The service is not available right now.')
  await expect(alert.getByRole('button', { name: 'Try again' })).toBeVisible()
})

test('Hebrew shows the demo controls translated', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('event-planner.language', 'he')
  })
  await page.goto('/events/evt-2/guests')

  await expect(page.getByRole('heading', { name: 'אורחים' })).toBeVisible()
  await expect(page.getByText('מצב הדגמה')).toBeAttached()
  const nav = await openNavigation(page)
  await expect(
    nav.getByRole('button', { name: /חגיגת בר מצווה לאיתי/ }),
  ).toBeVisible()
})
