import { expect, test } from '@playwright/test'
import { openNavigation, startInDemo } from './helpers.ts'

test.beforeEach(async ({ page }) => {
  await startInDemo(page)
})

test('My Events loads', async ({ page }) => {
  await page.goto('/events')

  await expect(page.getByRole('heading', { name: 'My Events' })).toBeVisible()
})

test('event pages are reachable through the event navigation', async ({
  page,
}) => {
  await page.goto('/events/evt-1')
  await expect(page).toHaveURL(/\/events\/evt-1\/dashboard$/)
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()

  const nav = await openNavigation(page)
  await nav.getByRole('link', { name: 'Guests' }).click()

  await expect(page).toHaveURL(/\/events\/evt-1\/guests$/)
  await expect(page.getByRole('heading', { name: 'Guests' })).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('public RSVP page loads without event navigation', async ({ page }) => {
  await page.goto('/rsvp/abc123')

  await expect(page.getByRole('heading', { name: 'RSVP' })).toBeVisible()
  await expect(page.getByRole('navigation')).toHaveCount(0)
})

test('unknown address shows the not-found page', async ({ page }) => {
  await page.goto('/no-such-page')

  await expect(
    page.getByRole('heading', { name: 'Page not found' }),
  ).toBeVisible()
})
