import { AxeBuilder } from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { openNavigation, startInDemo } from './helpers.ts'

/**
 * The venue workspace (V2.2, PLAN.md Phase 25), on the demo with
 * VITE_VENUES_ENABLED (the venues-* projects). The other projects run with
 * venues off and prove nothing changes then.
 */

const VENUE_EVENTS = '/venues/org-1/events'

async function expectNoViolations(page: Page) {
  const results = await new AxeBuilder({ page }).analyze()
  expect(
    results.violations.map((violation) => ({
      rule: violation.id,
      elements: violation.nodes.map((node) => node.target.join(' ')),
    })),
  ).toEqual([])
}

async function expectNoSidewaysScroll(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      ),
    )
    .toBe(0)
}

test.beforeEach(async ({ page }) => {
  await startInDemo(page)
})

test('the switcher moves between the personal workspace and a venue', async ({
  page,
}) => {
  await page.goto('/events')
  const nav = await openNavigation(page)
  await nav.getByRole('button', { name: /^Workspace: Personal/ }).click()
  await nav.getByRole('link', { name: /Grand Garden Hall/ }).click()

  await expect(page).toHaveURL(VENUE_EVENTS)
  await expect(
    page.getByRole('heading', { level: 2, name: 'Dana & Yossi’s Wedding' }),
  ).toBeVisible()
  const venueNav = await openNavigation(page)
  await expect(
    venueNav.getByRole('button', { name: /^Workspace: Grand Garden Hall/ }),
  ).toBeVisible()

  await venueNav
    .getByRole('button', { name: /^Workspace: Grand Garden Hall/ })
    .click()
  await venueNav.getByRole('link', { name: /Personal/ }).click()
  await expect(page).toHaveURL('/events')
  await expect(
    page.getByRole('heading', { level: 2, name: 'Maya & Daniel’s Wedding' }),
  ).toBeVisible()
})

test('a venue’s My Events keeps its filters in the address', async ({
  page,
}) => {
  await page.goto(`${VENUE_EVENTS}?show=past`)
  const list = page.getByRole('list', { name: 'Events' })
  await expect(list.getByRole('article')).toHaveCount(2)

  await page.reload()
  await expect(list.getByRole('article')).toHaveCount(2)
  await expect(page.getByRole('tab', { name: /^Past/ })).toHaveAttribute(
    'aria-selected',
    'true',
  )
})

test('a venue the visitor does not belong to is not found', async ({
  page,
}) => {
  await page.goto('/venues/org-404/events')
  await expect(
    page.getByRole('heading', { name: 'Page not found' }),
  ).toBeVisible()
})

for (const language of ['en', 'he', 'pt'] as const) {
  test(`a venue’s My Events in ${language} is accessible and fits the screen`, async ({
    page,
  }) => {
    await page.addInitScript((value) => {
      window.localStorage.setItem('event-planner.language', value)
    }, language)
    await page.goto(VENUE_EVENTS)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.getByRole('article').first()).toBeVisible()

    await expectNoViolations(page)
    await expectNoSidewaysScroll(page)

    // Portuguese opens Brazil's sample venue (D103).
    const nav = await openNavigation(page)
    await nav
      .getByRole('button', { name: /Grand Garden Hall|Espaço Jardim Imperial/ })
      .click()
    await expectNoViolations(page)
  })
}

test('the venue list fits a 320px phone', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'a phone width')
  await page.setViewportSize({ width: 320, height: 700 })
  await page.goto(VENUE_EVENTS)
  await expect(page.getByRole('article').first()).toBeVisible()
  await expectNoSidewaysScroll(page)
})
