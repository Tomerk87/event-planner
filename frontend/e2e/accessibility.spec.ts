import { AxeBuilder } from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { startInDemo } from './helpers.ts'

const pages = [
  ['My Events', '/events'],
  ['event page', '/events/evt-1/dashboard'],
  ['guests', '/events/evt-1/guests'],
  ['event layout', '/events/evt-1/layout'],
  ['event settings', '/events/evt-1/settings'],
  ['messages', '/events/evt-1/messages'],
  ['RSVP settings', '/events/evt-1/rsvp'],
  ['permissions', '/events/evt-1/permissions'],
  ['public RSVP', '/rsvp/abc123'],
  ['not-found page', '/no-such-page'],
] as const

async function expectNoViolations(page: Page) {
  const results = await new AxeBuilder({ page }).analyze()
  const summary = results.violations.map((violation) => ({
    rule: violation.id,
    impact: violation.impact,
    help: violation.help,
    elements: violation.nodes.map((node) => node.target.join(' ')),
  }))

  expect(summary).toEqual([])
}

for (const language of ['en', 'he'] as const) {
  test.describe(`accessibility in ${language}`, () => {
    test.beforeEach(async ({ page }) => {
      await startInDemo(page)
      await page.addInitScript((value) => {
        window.localStorage.setItem('event-planner.language', value)
      }, language)
    })

    for (const [name, path] of pages) {
      test(`${name} has no detectable accessibility violations`, async ({
        page,
      }) => {
        await page.goto(path)
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

        await expectNoViolations(page)
      })
    }

    test('a page with a dialog open has no detectable accessibility violations', async ({
      page,
    }) => {
      await page.goto('/events/evt-1/layout')
      await page.getByRole('button', { name: /Add Table|הוספת שולחן/ }).click()
      await expect(page.getByRole('dialog')).toBeVisible()

      await expectNoViolations(page)
    })

    test('a page with a menu open has no detectable accessibility violations', async ({
      page,
    }) => {
      await page.goto('/events/evt-1/layout')
      await page
        .getByRole('button', { name: /Export Tables|ייצוא שולחנות/ })
        .click()
      await expect(page.getByRole('menu')).toBeVisible()

      await expectNoViolations(page)
    })

    test('a Viewer’s read-only page has no detectable accessibility violations', async ({
      page,
    }) => {
      await page.goto('/events/evt-4/guests')
      await expect(
        page.getByText(/View-only access|גישה לצפייה בלבד/).first(),
      ).toBeVisible()

      await expectNoViolations(page)
    })

    test('a page with a toast shown has no detectable accessibility violations', async ({
      page,
    }) => {
      await page.goto('/events/evt-1/layout')
      await page.getByRole('button', { name: /Add Table|הוספת שולחן/ }).click()
      await page
        .getByRole('dialog')
        .getByRole('button', { name: /Add Table|הוספת שולחן/ })
        .click()
      await expect(
        page.getByRole('region', { name: /Notifications|התראות/ }).locator('p'),
      ).toBeVisible()

      await expectNoViolations(page)
    })

    test('read-only past event has no detectable accessibility violations', async ({
      page,
    }) => {
      await page.goto('/events/evt-5/dashboard')
      await expect(
        page.getByText(/This event has ended|האירוע הסתיים/),
      ).toBeVisible()

      await expectNoViolations(page)
    })

    test('failed load has no detectable accessibility violations', async ({
      page,
    }) => {
      await page.goto('/events/evt-1/guests?demoFail=events.get')
      await expect(page.getByRole('main').getByRole('alert')).toBeVisible()

      await expectNoViolations(page)
    })

    test('reset confirmation has no detectable accessibility violations', async ({
      page,
      isMobile,
    }) => {
      await page.goto('/events/evt-1/guests')
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      if (isMobile) {
        await page
          .getByRole('button', { name: /Open menu|פתיחת תפריט/ })
          .click()
      }
      await page
        .getByRole('button', { name: /Reset Demo|איפוס ההדגמה/ })
        .click()
      await expect(
        page.getByRole('dialog', { name: /Reset the demo|לאפס את ההדגמה/ }),
      ).toBeVisible()

      await expectNoViolations(page)
    })

    test('open navigation drawer has no detectable accessibility violations', async ({
      page,
      isMobile,
    }) => {
      test.skip(!isMobile, 'the drawer exists only on the compact layout')
      await page.goto('/events/evt-1/guests')
      await page.getByRole('button', { name: /Open menu|פתיחת תפריט/ }).click()
      await expect(page.getByRole('dialog')).toBeVisible()

      await expectNoViolations(page)
    })
  })
}
