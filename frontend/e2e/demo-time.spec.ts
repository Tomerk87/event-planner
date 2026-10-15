import { AxeBuilder } from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { startInDemo } from './helpers.ts'

/**
 * A demo ends on its own 3 days after it started, or after 12 hours without
 * activity (D99): the visitor lands on the landing page, told why, and can
 * start a fresh demo.
 */

const HOUR = 60 * 60 * 1000

/** A demo whose clock started and was last used this long ago. */
async function openDemoAged(
  page: Page,
  startedHoursAgo: number,
  idleHours: number,
  language: 'en' | 'he' = 'en',
) {
  await startInDemo(page)
  await page.addInitScript(
    ({ startedAt, lastActiveAt, language }) => {
      // Only before the first page of the test.
      if (window.sessionStorage.getItem('aged') === null) {
        window.sessionStorage.setItem('aged', 'yes')
        window.localStorage.setItem(
          'event-planner.demo-clock',
          JSON.stringify({ startedAt, lastActiveAt }),
        )
      }
      window.localStorage.setItem('event-planner.language', language)
    },
    {
      startedAt: new Date(Date.now() - startedHoursAgo * HOUR).toISOString(),
      lastActiveAt: new Date(Date.now() - idleHours * HOUR).toISOString(),
      language,
    },
  )
  await page.goto('/events')
}

test('a demo idle for 12 hours ends, and Try Demo starts a fresh one', async ({
  page,
}) => {
  await openDemoAged(page, 20, 12)

  await expect(page).toHaveURL(/\/$/)
  const notice = page.getByRole('status').filter({
    hasText: 'Your demo has ended',
  })
  await expect(notice).toContainText('was not used for 12 hours')
  await notice.getByRole('button', { name: 'Try Demo' }).click()

  await expect(page.getByRole('heading', { name: 'My Events' })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { name: 'My Events' })).toBeVisible()
})

test('a demo started 3 days ago ends even when in use', async ({ page }) => {
  await openDemoAged(page, 72, 0)

  await expect(
    page.getByText('A demo lasts 3 days, so its sample data was cleared.', {
      exact: false,
    }),
  ).toBeVisible()
})

test('a demo within its time goes on', async ({ page }) => {
  await openDemoAged(page, 60, 11)

  await expect(page.getByRole('heading', { name: 'My Events' })).toBeVisible()
})

test('the ended notice is translated and accessible', async ({ page }) => {
  await openDemoAged(page, 80, 1, 'he')

  await expect(page.getByText('ההדגמה הסתיימה')).toBeVisible()
  const results = await new AxeBuilder({ page }).analyze()
  expect(results.violations.map((violation) => violation.id)).toEqual([])
})
