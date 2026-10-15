import { AxeBuilder } from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { openNavigation, startInDemo } from './helpers.ts'

const SETTINGS = '/events/evt-1/settings'

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

async function openSettings(page: Page, path: string = SETTINGS) {
  await page.goto(path)
  await expect(
    page.getByRole('heading', { name: /General Information|מידע כללי/ }),
  ).toBeVisible()
}

test('saved changes survive a reload and show on the other pages', async ({
  page,
}) => {
  await openSettings(page)
  const saveButton = page.getByRole('button', { name: 'Save Changes' })
  await expect(saveButton).toBeDisabled()

  await page.getByLabel('Event Name').fill('Our Big Day')
  await page.getByLabel('Maximum Attendees').first().fill('450')
  await saveButton.click()

  await expect(page.getByText('Event settings saved.')).toBeVisible()
  await expect(saveButton).toBeDisabled()

  await page.reload()
  await expect(page.getByLabel('Event Name')).toHaveValue('Our Big Day')
  await expect(page.getByLabel('Maximum Attendees').first()).toHaveValue('450')

  const nav = await openNavigation(page)
  await expect(nav.getByRole('button', { name: /Our Big Day/ })).toBeVisible()
  await nav.getByRole('link', { name: 'Dashboard' }).click()
  await expect(page.getByText(/of 450|\/ 450/).first()).toBeVisible()
})

test('the maximum is brought back within its range, never below those who confirmed', async ({
  page,
}) => {
  await openSettings(page)
  const field = page.getByLabel('Maximum Attendees').first()
  const hint = page.getByText(/attendees have already confirmed\.$/)
  const confirmed = Number(/: (\d+) attendees/.exec(await hint.innerText())![1])
  expect(confirmed).toBeGreaterThan(50)

  await field.fill('3001')
  await field.press('Tab')
  await expect(field).toHaveValue('3000')
  await field.fill('10')
  await field.press('Tab')
  await expect(field).toHaveValue(String(confirmed))

  await page.reload()
  await expect(page.getByLabel('Maximum Attendees').first()).toHaveValue('300')
})

test('leaving with unsaved changes asks first', async ({ page }) => {
  await openSettings(page)
  await page.getByLabel('Event Name').fill('Half Done')

  let nav = await openNavigation(page)
  await nav.getByRole('link', { name: 'Guests' }).click()
  const prompt = page.getByRole('dialog', { name: 'Leave without saving?' })
  await prompt.getByRole('button', { name: 'Keep Editing' }).click()
  await expect(page).toHaveURL(/\/settings$/)
  await expect(page.getByLabel('Event Name')).toHaveValue('Half Done')

  nav = await openNavigation(page)
  await nav.getByRole('link', { name: 'Guests' }).click()
  await prompt.getByRole('button', { name: 'Leave', exact: true }).click()
  await expect(page).toHaveURL(/\/guests$/)
})

test('unsaved changes can be saved on the way out', async ({ page }) => {
  await openSettings(page)
  await page.getByLabel('Event Name').fill('Saved On The Way')

  const nav = await openNavigation(page)
  await nav.getByRole('link', { name: 'Guests' }).click()
  await page
    .getByRole('dialog', { name: 'Leave without saving?' })
    .getByRole('button', { name: 'Save and Leave' })
    .click()

  await expect(page).toHaveURL(/\/guests$/)
  await expect(page.getByText('Event settings saved.')).toBeVisible()
  await page.goto(SETTINGS)
  await expect(page.getByLabel('Event Name')).toHaveValue('Saved On The Way')
})

test('the event rules open from the Danger Zone', async ({ page }) => {
  await openSettings(page)

  await page.getByRole('button', { name: 'View Event Rules' }).click()

  const dialog = page.getByRole('dialog', { name: 'Event Rules' })
  await expect(dialog.getByRole('listitem')).toHaveCount(8)
  await expectNoViolations(page)
})

test('a past event is shown read-only', async ({ page }) => {
  await openSettings(page, '/events/evt-5/settings')

  await expect(page.getByText('This event has ended')).toBeVisible()
  await expect(page.getByLabel('Event Name')).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Save Changes' })).toHaveCount(
    0,
  )
  await expect(page.getByText('RSVP is closed.')).toBeVisible()
})

test('Save Changes sits in the bottom bar on a phone and in the header on desktop', async ({
  page,
  isMobile,
}) => {
  await openSettings(page)

  const bar = page.getByRole('region', { name: 'Page actions' })
  await expect(bar).toHaveCount(isMobile ? 1 : 0)
  if (isMobile) {
    await expect(
      bar.getByRole('button', { name: 'Save Changes' }),
    ).toBeVisible()
    // The bar never covers the end of the page.
    const rules = page.getByRole('button', { name: 'View Event Rules' })
    await rules.scrollIntoViewIfNeeded()
    await rules.click()
    await expect(
      page.getByRole('dialog', { name: 'Event Rules' }),
    ).toBeVisible()
  }
})

for (const language of ['en', 'he'] as const) {
  test(`the page is accessible and fits the screen (${language})`, async ({
    page,
  }) => {
    await page.addInitScript((value) => {
      window.localStorage.setItem('event-planner.language', value)
    }, language)
    await openSettings(page)
    await expect(page.locator('html')).toHaveAttribute(
      'dir',
      language === 'he' ? 'rtl' : 'ltr',
    )
    await expect(
      page.getByText(/Seating Capacity|מקומות ישיבה/).first(),
    ).toBeVisible()

    await expectNoViolations(page)
    await expectNoSidewaysScroll(page, `${SETTINGS} (${language})`)
    await page.setViewportSize({ width: 320, height: 640 })
    await expectNoSidewaysScroll(page, `${SETTINGS} at 320px (${language})`)
  })
}
