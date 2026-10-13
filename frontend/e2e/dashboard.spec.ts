import { AxeBuilder } from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { startInDemo } from './helpers.ts'

const DASHBOARD = '/events/evt-1/dashboard'

test.beforeEach(async ({ page }) => {
  await startInDemo(page)
})

async function expectNoViolations(page: Page) {
  const results = await new AxeBuilder({ page }).analyze()
  expect(
    results.violations.map((violation) => ({
      rule: violation.id,
      elements: violation.nodes.map((node) => node.target.join(' ')),
    })),
  ).toEqual([])
}

async function expectNoSidewaysScroll(page: Page, where: string) {
  // Polled, because after a resize the layout settles a moment later.
  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            document.documentElement.scrollWidth -
            document.documentElement.clientWidth,
        ),
      { message: `horizontal overflow at ${where}` },
    )
    .toBe(0)
}

function figures(page: Page) {
  return page.getByRole('region', { name: /Key figures|נתונים עיקריים/ })
}

test('the dashboard shows figures, warnings, the RSVP breakdown, activity and shortcuts', async ({
  page,
}) => {
  await page.goto(DASHBOARD)

  await expect(figures(page).locator('p', { hasText: /^\d+$/ })).toHaveCount(10)
  await expect(page.getByRole('list', { name: 'Warnings' })).toBeVisible()
  await expect(page.getByRole('table', { name: 'RSVP Status' })).toBeVisible()
  await expect(
    page.getByRole('progressbar', { name: 'Confirmed Attendees' }),
  ).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'Recent Guest Activity' }),
  ).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'Quick Actions' }),
  ).toBeVisible()
})

test('the RSVP breakdown adds up to the total number of guests', async ({
  page,
}) => {
  await page.goto(DASHBOARD)
  const table = page.getByRole('table', { name: 'RSVP Status' })
  await expect(table).toBeVisible()

  const counts = await table
    .locator('tbody td:nth-of-type(1)')
    .allTextContents()
  const percents = await table
    .locator('tbody td:nth-of-type(2)')
    .allTextContents()
  const total = await figures(page)
    .locator('div', { hasText: /^Total Guests/ })
    .locator('p')
    .nth(1)
    .textContent()

  expect(counts.reduce((sum, count) => sum + Number(count), 0)).toBe(
    Number(total),
  )
  expect(
    percents.reduce((sum, percent) => sum + Number.parseInt(percent, 10), 0),
  ).toBe(100)
})

test('the Event Settings button, a warning and a quick action each lead to their page', async ({
  page,
}) => {
  await page.goto(DASHBOARD)

  await page
    .getByRole('main')
    .getByRole('link', { name: 'Event Settings' })
    .click()
  await expect(page).toHaveURL(/\/events\/evt-1\/settings$/)

  await page.goto(DASHBOARD)
  await page.getByRole('link', { name: /Tables over capacity/ }).click()
  await expect(page).toHaveURL(/\/events\/evt-1\/layout$/)

  await page.goto(DASHBOARD)
  await page.getByRole('link', { name: /^Manage Guests/ }).click()
  await expect(page).toHaveURL(/\/events\/evt-1\/guests$/)
})

test('View All opens the full activity list and Escape returns to the button', async ({
  page,
}) => {
  await page.goto(DASHBOARD)
  const viewAll = page.getByRole('button', { name: 'View All' })

  await viewAll.click()
  const dialog = page.getByRole('dialog', { name: 'Recent Guest Activity' })
  await expect(dialog.getByRole('listitem').nth(5)).toBeVisible()
  await page.keyboard.press('Escape')

  await expect(dialog).toHaveCount(0)
  await expect(viewAll).toBeFocused()
})

test('a figure changed elsewhere is kept after a reload', async ({ page }) => {
  await page.goto(DASHBOARD)
  await expect(page.getByRole('list', { name: 'Warnings' })).toBeVisible()
  const role = page.getByRole('combobox', { name: 'Simulated role' })
  test.skip(
    !(await role.isVisible()),
    'role switcher is in the drawer on a phone',
  )

  await role.selectOption('VIEWER')
  await expect(page.getByText('View-only access')).toBeVisible()
  await page.reload()

  await expect(page.getByText('View-only access')).toBeVisible()
  await expect(figures(page).locator('p', { hasText: /^\d+$/ })).toHaveCount(10)
})

for (const language of ['en', 'he'] as const) {
  test.describe(`dashboard in ${language}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.addInitScript((value) => {
        window.localStorage.setItem('event-planner.language', value)
      }, language)
    })

    for (const [name, path] of [
      ['the main event', DASHBOARD],
      ['the Hebrew event', '/events/evt-2/dashboard'],
      ['a past event', '/events/evt-5/dashboard'],
    ] as const) {
      test(`${name} has no accessibility violations and fits the screen`, async ({
        page,
      }) => {
        await page.goto(path)
        await expect(figures(page)).toBeVisible()
        await expect(page.getByRole('table')).toBeVisible()

        await expectNoViolations(page)
        await expectNoSidewaysScroll(page, path)

        await page.setViewportSize({ width: 320, height: 640 })
        await expectNoSidewaysScroll(page, `${path} at 320px`)
      })
    }

    test('the full activity dialog has no accessibility violations', async ({
      page,
    }) => {
      await page.goto(DASHBOARD)
      await page.getByRole('button', { name: /View All|הצגת הכול/ }).click()
      await expect(page.getByRole('dialog')).toBeVisible()

      await expectNoViolations(page)
    })

    test('the bars fill from the reading-start side', async ({ page }) => {
      await page.goto(DASHBOARD)
      const bar = page.getByRole('progressbar').first()
      await expect(bar).toBeVisible()

      const track = await bar.boundingBox()
      const fill = await bar.locator('div').boundingBox()
      expect(track).not.toBeNull()
      expect(fill).not.toBeNull()
      if (track && fill) {
        const startGap =
          language === 'he'
            ? track.x + track.width - (fill.x + fill.width)
            : fill.x - track.x
        expect(Math.abs(startGap)).toBeLessThan(1)
        expect(fill.width).toBeLessThan(track.width)
      }
    })
  })
}

test('an event with no guests shows empty states', async ({ page }) => {
  await page.goto('/events')
  await page.getByRole('button', { name: 'Create Event' }).click()
  const dialog = page.getByRole('dialog', { name: 'Create event' })
  await dialog.getByLabel(/Event Name/).fill('Fresh Start')
  await dialog.getByLabel(/^Date/).fill('2031-02-02')
  await dialog.getByLabel(/^Time \*/).fill('18:00')
  await dialog.getByRole('button', { name: 'Create Event' }).click()

  await page
    .getByRole('article')
    .filter({ hasText: 'Fresh Start' })
    .getByRole('link')
    .first()
    .click()

  await expect(page.getByText('No guests yet')).toBeVisible()
  await expect(page.getByText('No activity yet')).toBeVisible()
  await expectNoViolations(page)
})
