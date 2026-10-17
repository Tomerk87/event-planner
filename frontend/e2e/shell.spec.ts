import { AxeBuilder } from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { chooseOption, openNavigation, startInDemo } from './helpers.ts'

test.beforeEach(async ({ page }) => {
  await startInDemo(page)
})

test('switching to Hebrew flips the layout and is remembered after a reload', async ({
  page,
}) => {
  await page.goto('/events/evt-1/guests')
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr')

  const nav = await openNavigation(page)
  await chooseOption(nav.getByRole('combobox', { name: 'Language' }), 'he')

  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
  await expect(page.locator('html')).toHaveAttribute('lang', 'he')
  await expect(page.getByRole('heading', { name: 'אורחים' })).toBeVisible()

  await page.reload()

  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
  await expect(page.getByRole('heading', { name: 'אורחים' })).toBeVisible()
})

test('the sidebar sits on the inline-start edge in both directions', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'the sidebar is a drawer on the compact layout')
  await page.goto('/events/evt-1/guests')
  const sidebar = page.getByRole('complementary')
  const viewportWidth = page.viewportSize()?.width ?? 0

  const ltrBox = await sidebar.boundingBox()
  expect(ltrBox?.x).toBe(0)

  await chooseOption(sidebar.getByRole('combobox', { name: 'Language' }), 'he')
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')

  const rtlBox = await sidebar.boundingBox()
  expect((rtlBox?.x ?? 0) + (rtlBox?.width ?? 0)).toBe(viewportWidth)
})

test('the page does not scroll sideways', async ({ page }) => {
  for (const path of [
    '/events',
    '/events/evt-1/dashboard',
    '/events/evt-1/guests',
  ]) {
    await page.goto(path)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    )
    expect(overflow, `horizontal overflow at ${path}`).toBe(0)
  }
})

test('pages fit a very narrow phone without sideways scrolling', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 640 })
  for (const [path, content] of [
    ['/events', 'Annual Company Gala'],
    ['/events/evt-1/layout', 'Selected Table'],
    ['/events/evt-5/dashboard', 'Quick Actions'],
  ] as const) {
    await page.goto(path)
    await expect(page.getByText(content)).toBeVisible()

    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    )
    expect(overflow, `horizontal overflow at ${path}`).toBe(0)
    await expect(page.getByText('Alex Morgan')).toBeAttached()
  }
})

test('a dialog keeps focus off the page behind it, closes with Escape and returns focus to its opener', async ({
  page,
}) => {
  await page.goto('/events/evt-1/layout')
  const opener = page.getByRole('button', { name: 'Add Table' })

  await opener.click()
  const dialog = page.getByRole('dialog', { name: 'Add Table' })
  await expect(dialog).toBeVisible()

  // A native modal dialog lets Tab leave to the browser's own controls (the
  // page reports <body> as focused then) but never to the content behind it.
  for (let presses = 0; presses < 8; presses += 1) {
    await page.keyboard.press('Tab')
    const focusIsOnPageBehind = await dialog.evaluate((element) => {
      const active = document.activeElement
      return active !== document.body && !element.contains(active)
    })
    expect(focusIsOnPageBehind).toBe(false)
  }

  await page.keyboard.press('Escape')

  await expect(dialog).toBeHidden()
  await expect(opener).toBeFocused()
})

test('a data table becomes cards on a phone', async ({ page, isMobile }) => {
  await page.goto('/events/evt-1/layout')

  await expect(page.getByRole('table', { name: 'Tables' })).toBeVisible({
    visible: !isMobile,
  })
  await expect(page.getByRole('list', { name: 'Tables' })).toBeVisible({
    visible: isMobile,
  })
})

test('editing controls are hidden for a Viewer and for a past event', async ({
  page,
}) => {
  await page.goto('/events/evt-1/layout')
  await expect(page.getByRole('button', { name: 'Add Table' })).toBeVisible()

  // The demo user is a Viewer of this event.
  await page.goto('/events/evt-4/layout')
  await expect(page.getByText('View-only access').first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Add Table' })).toHaveCount(0)

  // An Owner of an event that has passed.
  await page.goto('/events/evt-5/layout')
  await expect(page.getByText('This event has ended').first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Add Table' })).toHaveCount(0)
})

test('the side menu collapses to icons, stays usable, and is remembered', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'on a phone the menu is a drawer')
  await page.goto('/events/evt-1/guests')
  const sidebar = page.getByRole('complementary')
  const expandedWidth = (await sidebar.boundingBox())?.width ?? 0

  await page.getByRole('button', { name: 'Collapse menu' }).click()

  await expect(page.getByRole('button', { name: 'Expand menu' })).toBeVisible()
  const collapsedWidth = (await sidebar.boundingBox())?.width ?? 0
  expect(collapsedWidth).toBeLessThan(expandedWidth / 2)
  await expect(sidebar.getByRole('combobox', { name: 'Language' })).toBeHidden()
  const results = await new AxeBuilder({ page }).analyze()
  expect(results.violations.map((violation) => violation.id)).toEqual([])

  await sidebar.getByRole('link', { name: 'Dashboard' }).click()
  await expect(page).toHaveURL(/\/dashboard$/)

  await page.reload()
  await expect(page.getByRole('button', { name: 'Expand menu' })).toBeVisible()
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  )
  expect(overflow).toBe(0)

  await page.getByRole('button', { name: 'Expand menu' }).click()
  await expect(
    sidebar.getByRole('combobox', { name: 'Language' }),
  ).toBeVisible()
})

test('a page opened from another page starts at its top', async ({ page }) => {
  async function open(link: string, heading: string) {
    const nav = await openNavigation(page)
    await nav.getByRole('link', { name: link, exact: true }).click()
    await expect(
      page.getByRole('heading', { level: 1, name: heading }),
    ).toBeVisible()
  }

  await page.goto('/events/evt-1/dashboard')
  await expect(page.getByText('Quick Actions')).toBeVisible()

  // A page seen before is shown at once at its full height, so nothing but
  // the navigation itself returns the view to the top.
  for (const [link, heading] of [
    ['Guests', 'Guests'],
    ['Dashboard', 'Dashboard'],
    ['Messages', 'WhatsApp Messages'],
    ['Dashboard', 'Dashboard'],
    ['Guests', 'Guests'],
  ] as const) {
    // The page grows as its data arrives, so keep scrolling until it moves.
    await expect
      .poll(() =>
        page.evaluate(() => {
          window.scrollTo(0, document.documentElement.scrollHeight)
          return window.scrollY
        }),
      )
      .toBeGreaterThan(100)

    await open(link, heading)

    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0)
  }
})

for (const [where, path, list, dialog] of [
  ['Guests', '/events/evt-1/guests', 'Guests', 'Edit Guest'],
  ['Event Layout', '/events/evt-1/layout', 'Tables', /^Edit Table/],
] as const) {
  // Each line offers Edit in place of a ⋯ menu (D105).
  test(`the last line on ${where} opens its edit form`, async ({
    page,
    isMobile,
  }) => {
    await page.goto(path)
    const lines = isMobile
      ? // The cards, not the lists of facts inside them.
        page.getByRole('list', { name: list }).locator(':scope > li')
      : page.getByRole('table', { name: list }).getByRole('row')
    const last = lines.last()
    await last.scrollIntoViewIfNeeded()

    await last.getByRole('button', { name: /^Edit / }).click()

    await expect(page.getByRole('dialog', { name: dialog })).toBeVisible()
  })
}
