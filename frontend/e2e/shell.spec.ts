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
  for (const path of ['/events', '/events/evt-1/dashboard', '/showcase']) {
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
    ['/events/evt-1/layout', 'This page is not implemented yet.'],
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
  await page.goto('/showcase')
  const opener = page.getByRole('button', { name: 'Open dialog' })

  await opener.click()
  const dialog = page.getByRole('dialog', { name: 'Delete table?' })
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

test('the showcase table becomes cards on a phone', async ({
  page,
  isMobile,
}) => {
  await page.goto('/showcase')

  await expect(page.getByRole('table', { name: 'Sample guests' })).toBeVisible({
    visible: !isMobile,
  })
  await expect(page.getByRole('list', { name: 'Sample guests' })).toBeVisible({
    visible: isMobile,
  })
})

test('the showcase hides editing controls for a Viewer and for a past event', async ({
  page,
}) => {
  await page.goto('/showcase')
  const addGuest = page.getByRole('button', { name: 'Add Guest' })
  const baseline = await addGuest.count()

  await chooseOption(
    page.getByRole('combobox', { name: 'Role in this event' }),
    'VIEWER',
  )

  await expect(addGuest).toHaveCount(baseline - 1)
  await expect(page.getByText('View-only access').first()).toBeVisible()

  await chooseOption(
    page.getByRole('combobox', { name: 'Role in this event' }),
    'OWNER',
  )
  await chooseOption(
    page.getByRole('combobox', { name: 'Event state' }),
    'past',
  )

  await expect(addGuest).toHaveCount(baseline - 1)
  await expect(page.getByText('This event has ended').first()).toBeVisible()
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
