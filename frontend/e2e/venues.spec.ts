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

const VENUE_PAGES = [
  ['My Events', VENUE_EVENTS],
  ['My Spaces', '/venues/org-1/spaces'],
  ['a space', '/venues/org-1/spaces/spc-1-1'],
  ['Team', '/venues/org-1/team'],
  ['Settings', '/venues/org-1/settings'],
  ['a layout template', '/venues/org-1/spaces/spc-1-1/layouts/tpl-1-1-3'],
  ['the create event wizard', '/venues/org-1/events/new'],
  [
    'the create event details',
    '/venues/org-1/events/new?space=spc-1-1&layout=tpl-1-1-1',
  ],
] as const

for (const language of ['en', 'he', 'pt'] as const) {
  test.describe(`venue pages in ${language}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.addInitScript((value) => {
        window.localStorage.setItem('event-planner.language', value)
      }, language)
    })

    for (const [name, path] of VENUE_PAGES) {
      test(`${name} is accessible and fits the screen`, async ({ page }) => {
        await page.goto(path)
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
        await expect(page.locator('main')).not.toContainText(/Loading|טוען/)

        await expectNoViolations(page)
        await expectNoSidewaysScroll(page)
      })
    }

    test('the switcher and the space dialog are accessible', async ({
      page,
    }) => {
      await page.goto(VENUE_EVENTS)
      await expect(page.getByRole('article').first()).toBeVisible()
      // Portuguese opens Brazil's sample venue (D103).
      const nav = await openNavigation(page)
      await nav
        .getByRole('button', {
          name: /Grand Garden Hall|Espaço Jardim Imperial/,
        })
        .click()
      await expectNoViolations(page)

      await page.goto('/venues/org-1/spaces/spc-1-1')
      await page
        .getByRole('button', { name: /Edit Space|עריכת חלל|Editar Espaço/ })
        .click()
      await expect(page.getByRole('dialog')).toBeVisible()
      await expectNoViolations(page)
    })
  })
}

test('a space is created and opened', async ({ page }) => {
  await page.goto('/venues/org-1/spaces')
  await page.getByRole('button', { name: 'Create Space' }).first().click()
  const dialog = page.getByRole('dialog', { name: 'Create Space' })
  await dialog.getByRole('textbox', { name: /Space Name/ }).fill('Sky Terrace')
  await dialog.getByRole('textbox', { name: /Address/ }).fill('1 Sky Road')
  await dialog.getByRole('textbox', { name: /Maximum People/ }).fill('90')
  await dialog.getByRole('button', { name: 'Create Space' }).click()

  await page.getByRole('link', { name: 'Open Space: Sky Terrace' }).click()
  await expect(
    page.getByRole('heading', { level: 1, name: 'Sky Terrace' }),
  ).toBeVisible()
  await page.reload()
  await expect(
    page.getByRole('heading', { level: 1, name: 'Sky Terrace' }),
  ).toBeVisible()
})

test('a Manager sees no Settings', async ({ page }) => {
  await page.goto('/venues/org-2/team')
  await expect(
    page.getByText('Only the venue owner can manage the team.'),
  ).toBeVisible()
  const nav = await openNavigation(page)
  await expect(nav.getByRole('link', { name: 'Settings' })).toHaveCount(0)
  await page.goto('/venues/org-2/settings')
  await expect(
    page.getByRole('heading', { name: 'Page not found' }),
  ).toBeVisible()
})

test('the venue list fits a 320px phone', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'a phone width')
  await page.setViewportSize({ width: 320, height: 700 })
  await page.goto(VENUE_EVENTS)
  await expect(page.getByRole('article').first()).toBeVisible()
  await expectNoSidewaysScroll(page)
})

test('a new layout gets a table placed on its plan, kept after a reload', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'the plan is edited on a wider screen (D100)')
  await page.goto('/venues/org-1/spaces/spc-1-3')
  await page.getByRole('button', { name: 'Add Layout' }).click()
  const dialog = page.getByRole('dialog', { name: 'Add Layout' })
  await dialog.getByRole('textbox', { name: /Layout Name/ }).fill('Sky Rounds')
  await dialog.getByRole('button', { name: 'Create Layout' }).click()
  await expect(
    page.getByRole('heading', { level: 1, name: /Sky Rounds/ }),
  ).toBeVisible()

  await page.getByRole('button', { name: 'Add Table' }).first().click()
  await page
    .getByRole('dialog', { name: /Add Table/ })
    .getByRole('button', { name: /Add Table/ })
    .click()
  await expect(page.getByRole('dialog')).toHaveCount(0)

  await page.getByRole('button', { name: 'Edit Layout' }).click()
  await page.getByRole('button', { name: 'Place Table 1 on the plan' }).click()
  await expect(page.getByText('Every table is on the plan.')).toBeVisible()
  await page.getByRole('button', { name: 'Save Layout' }).click()
  await expect(page.getByText('The floor plan was saved.')).toBeVisible()

  await page.reload()
  await page.getByRole('button', { name: 'Edit Layout' }).click()
  await expect(page.getByText('Every table is on the plan.')).toBeVisible()
})

test('a venue event is created from a layout and listed for the venue', async ({
  page,
}) => {
  await page.goto(VENUE_EVENTS)
  await page.getByRole('link', { name: 'Create Event' }).first().click()
  await page.getByRole('button', { name: /Main Hall/ }).click()
  await page.getByRole('button', { name: 'Next' }).click()
  await page.getByRole('button', { name: /Wedding Rounds/ }).click()
  await page.getByRole('button', { name: 'Next' }).click()

  await page.getByRole('textbox', { name: /Event Name/ }).fill('Noa & Ben')
  const day = new Date(Date.now() + 90 * 86_400_000).toISOString().slice(0, 10)
  await page.getByLabel(/^Date/).fill(day)
  await page.getByLabel(/^Start Time/).fill('19:00')
  await page.getByRole('button', { name: 'Next' }).click()

  await expect(
    page.getByRole('heading', { name: 'Review and Create' }),
  ).toBeVisible()
  await expectNoViolations(page)
  await expectNoSidewaysScroll(page)
  await page
    .getByRole('textbox', { name: /Client Email/ })
    .fill('noa@example.com')
  await page.getByRole('button', { name: 'Create Event' }).click()
  await expect(page.getByText('Event created')).toBeVisible()

  await page.getByRole('link', { name: 'Back to My Events' }).click()
  const card = page.getByRole('article').filter({ hasText: 'Noa & Ben' })
  await expect(card).toContainText('Invitation sent')

  // A venue event stays out of the personal My Events.
  await page.goto('/events')
  await expect(page.getByText('Noa & Ben')).toHaveCount(0)
})
