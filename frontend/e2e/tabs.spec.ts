import { expect, test, type Page } from '@playwright/test'
import { startInDemo } from './helpers.ts'

/**
 * A row of tabs never scrolls sideways (owner request 2026-10-15): on the
 * narrowest phones and in Hebrew, whose labels are longer, every tab stays
 * in view.
 */

const pages = [
  ['My Events', '/events'],
  ['Guests', '/events/evt-1/guests'],
  ['Unknown Guests', '/events/evt-1/guests?tab=unknown'],
  ['Event Layout', '/events/evt-1/layout'],
  ['RSVP Settings', '/events/evt-1/rsvp'],
  ['WhatsApp Messages', '/events/evt-1/messages'],
] as const

async function overflowingTabLists(page: Page) {
  return page.locator('[role="tablist"]').evaluateAll((lists) =>
    lists
      .filter((list) => {
        const box = list.getBoundingClientRect()
        const tabs = [...list.querySelectorAll('[role="tab"]')].map((tab) =>
          tab.getBoundingClientRect(),
        )
        return (
          list.scrollWidth > list.clientWidth + 1 ||
          box.left < -1 ||
          box.right > window.innerWidth + 1 ||
          tabs.some(
            (tab) => tab.left < box.left - 1 || tab.right > box.right + 1,
          )
        )
      })
      .map((list) => list.getAttribute('aria-label')),
  )
}

for (const language of ['en', 'he'] as const) {
  for (const width of [360, 390]) {
    test.describe(`tabs in ${language} at ${width}px`, () => {
      test.use({ viewport: { width, height: 800 } })

      test.beforeEach(async ({ page }) => {
        await startInDemo(page)
        await page.addInitScript((value) => {
          window.localStorage.setItem('event-planner.language', value)
        }, language)
      })

      for (const [name, path] of pages) {
        test(`${name} keeps every tab in view`, async ({ page }) => {
          await page.goto(path)
          await expect(page.getByRole('tablist').first()).toBeVisible()

          expect(await overflowingTabLists(page)).toEqual([])
        })
      }
    })
  }
}
