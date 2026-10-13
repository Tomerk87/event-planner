import { expect, test, type Page } from '@playwright/test'
import { chooseOption, startInDemo } from './helpers.ts'

const TOLERANCE = 1

async function gotoShowcase(page: Page, language: 'en' | 'he') {
  await startInDemo(page)
  await page.addInitScript((value) => {
    window.localStorage.setItem('event-planner.language', value)
  }, language)
  await page.goto('/showcase')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
}

async function box(locator: ReturnType<Page['locator']>) {
  const result = await locator.boundingBox()
  if (!result) {
    throw new Error('element has no bounding box')
  }
  return result
}

test.describe('bottom action bar on a phone', () => {
  test.beforeEach(({ isMobile }) => {
    test.skip(!isMobile, 'the bar is used only below the desktop width')
  })

  for (const language of ['en', 'he'] as const) {
    test(`lines up with the page content and splits the width equally (${language})`, async ({
      page,
    }) => {
      await gotoShowcase(page, language)
      const buttons = page
        .getByRole('region', { name: /Page actions|פעולות בעמוד/ })
        .getByRole('button')
      await expect(buttons).toHaveCount(2)
      const card = await box(page.locator('main section').first())
      const first = await box(buttons.first())
      const second = await box(buttons.last())
      const start = Math.min(first.x, second.x)
      const end = Math.max(first.x + first.width, second.x + second.width)

      expect(Math.abs(start - card.x)).toBeLessThanOrEqual(TOLERANCE)
      expect(Math.abs(end - (card.x + card.width))).toBeLessThanOrEqual(
        TOLERANCE,
      )
      expect(Math.abs(first.width - second.width)).toBeLessThanOrEqual(
        TOLERANCE,
      )
    })
  }

  test('puts the primary action on the right in English and on the left in Hebrew', async ({
    page,
  }) => {
    await gotoShowcase(page, 'en')
    const bar = page.getByRole('region', { name: 'Page actions' })
    const saveEn = await box(bar.getByRole('button', { name: 'Save Changes' }))
    const previewEn = await box(bar.getByRole('button', { name: 'Preview' }))
    expect(saveEn.x).toBeGreaterThan(previewEn.x)

    await page.evaluate(() =>
      window.localStorage.setItem('event-planner.language', 'he'),
    )
    await page.addInitScript(() => {
      window.localStorage.setItem('event-planner.language', 'he')
    })
    await page.reload()
    const barHe = page.getByRole('region', { name: 'פעולות בעמוד' })
    const saveHe = await box(
      barHe.getByRole('button', { name: 'שמירת שינויים' }),
    )
    const previewHe = await box(
      barHe.getByRole('button', { name: 'תצוגה מקדימה' }),
    )
    expect(saveHe.x).toBeLessThan(previewHe.x)
  })

  test('stays at the bottom of the screen while the page scrolls', async ({
    page,
  }) => {
    await gotoShowcase(page, 'en')
    const bar = page.getByRole('region', { name: 'Page actions' })
    const viewportHeight = page.viewportSize()?.height ?? 0
    const before = await box(bar)
    expect(
      Math.abs(before.y + before.height - viewportHeight),
    ).toBeLessThanOrEqual(TOLERANCE)

    await page.mouse.wheel(0, 2000)
    await expect
      .poll(() => page.evaluate(() => window.scrollY))
      .toBeGreaterThan(500)

    const after = await box(bar)
    expect(after.y).toBe(before.y)
    await expect(bar).toBeInViewport()
  })

  test('does not cover the end of the page', async ({ page }) => {
    await gotoShowcase(page, 'en')
    const bar = page.getByRole('region', { name: 'Page actions' })

    await page.evaluate(() =>
      window.scrollTo(0, document.documentElement.scrollHeight),
    )
    const lastCard = await box(page.locator('main section').last())
    const barBox = await box(bar)

    expect(lastCard.y + lastCard.height).toBeLessThanOrEqual(barBox.y)
  })

  test('keeps toasts above the bar', async ({ page }) => {
    await gotoShowcase(page, 'en')
    await page.getByRole('button', { name: 'Show error toast' }).click()
    const toast = await box(
      page.getByRole('region', { name: 'Notifications' }).getByRole('alert'),
    )
    const barBox = await box(page.getByRole('region', { name: 'Page actions' }))

    expect(toast.y + toast.height).toBeLessThanOrEqual(barBox.y)
  })

  test('fits a narrow phone without sideways scrolling', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 })
    await gotoShowcase(page, 'en')
    const bar = await box(page.getByRole('region', { name: 'Page actions' }))

    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    )
    expect(overflow).toBe(0)
    expect(bar.width).toBeLessThanOrEqual(320)
  })

  test('drops to one full-width button when only one action is allowed', async ({
    page,
  }) => {
    await gotoShowcase(page, 'en')
    await chooseOption(
      page.getByRole('combobox', { name: 'Role in this event' }),
      'VIEWER',
    )
    const bar = page.getByRole('region', { name: 'Page actions' })
    await expect(bar.getByRole('button')).toHaveCount(1)
    const card = await box(page.locator('main section').first())
    const only = await box(bar.getByRole('button'))

    expect(Math.abs(only.width - card.width)).toBeLessThanOrEqual(TOLERANCE)
  })
})

test('page actions stay in the header at desktop width', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'desktop layout only')
  await gotoShowcase(page, 'en')

  await expect(
    page.getByRole('main').getByRole('button', { name: 'Save Changes' }),
  ).toBeVisible()
  await expect(page.getByRole('region', { name: 'Page actions' })).toHaveCount(
    0,
  )
})
