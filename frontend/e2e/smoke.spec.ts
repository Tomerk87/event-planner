import { expect, test } from '@playwright/test'

test('home page loads', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'My Events' })).toBeVisible()
})

test('event pages are reachable through the event navigation', async ({
  page,
}) => {
  await page.goto('/events/e1')
  await expect(page).toHaveURL(/\/events\/e1\/dashboard$/)
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()

  await page.getByRole('link', { name: 'Guests' }).click()

  await expect(page).toHaveURL(/\/events\/e1\/guests$/)
  await expect(page.getByRole('heading', { name: 'Guests' })).toBeVisible()
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
