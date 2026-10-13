import { AxeBuilder } from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { startInDemo } from './helpers.ts'

const WEDDING = 'Maya & Daniel’s Wedding'

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

async function setLanguage(page: Page, language: 'en' | 'he') {
  await page.addInitScript((value) => {
    window.localStorage.setItem('event-planner.language', value)
  }, language)
}

/** The landing page's first Try Demo button that is on screen. */
function tryDemo(page: Page) {
  return page
    .getByRole('main')
    .getByRole('button', { name: 'Try Demo' })
    .first()
}

async function signUp(page: Page, name: string, email: string) {
  await page.goto('/signup')
  await page.getByLabel(/Full name/).fill(name)
  await page.getByLabel(/Email/).fill(email)
  await page.getByLabel(/Password/).fill('not-a-real-password')
  await page.getByRole('button', { name: 'Sign Up' }).click()
  await expect(page).toHaveURL(/\/events$/)
}

async function createEvent(page: Page, name: string) {
  const dialog = page.getByRole('dialog', { name: 'Create event' })
  await dialog.getByLabel(/Event Name/).fill(name)
  await dialog.getByLabel(/^Date/).fill('2031-02-02')
  await dialog.getByLabel(/^Time \*/).fill('18:00')
  await dialog.getByRole('button', { name: 'Create Event' }).click()
  await expect(page.getByRole('heading', { level: 2, name })).toBeVisible()
}

test('Landing → Try Demo opens the populated demo, and a card opens its event', async ({
  page,
}) => {
  await page.goto('/')
  await expect(
    page.getByRole('heading', { level: 1, name: /Plan every guest/ }),
  ).toBeVisible()

  await tryDemo(page).click()

  await expect(page).toHaveURL(/\/events$/)
  await expect(page.getByRole('article')).toHaveCount(6)
  await expect(page.getByText('Demo Mode')).toBeAttached()

  const card = page.getByRole('article').filter({ hasText: WEDDING })
  await card.getByRole('link').first().click()

  await expect(page).toHaveURL(/\/events\/evt-1\/dashboard$/)
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
})

test('Landing → Sign Up creates an account with no events; it survives a reload; log out and Sign In return to it', async ({
  page,
  isMobile,
}) => {
  await page.goto('/')
  if (isMobile) {
    await page.getByRole('button', { name: 'Open menu' }).click()
    await page.getByRole('menuitem', { name: 'Sign Up' }).click()
  } else {
    await page
      .getByRole('banner')
      .getByRole('link', { name: 'Sign Up' })
      .click()
  }
  await expect(page).toHaveURL(/\/signup$/)
  await page.getByLabel(/Full name/).fill('Riley Stone')
  await page.getByLabel(/Email/).fill('riley@example.com')
  await page.getByLabel(/Password/).fill('not-a-real-password')
  await page.getByRole('button', { name: 'Sign Up' }).click()

  await expect(page).toHaveURL(/\/events$/)
  await expect(page.getByText('No events yet')).toBeVisible()
  await expect(page.getByText('Demo Mode')).toHaveCount(0)

  await page.getByRole('button', { name: 'Create your first event' }).click()
  await createEvent(page, 'Housewarming')

  await page.reload()
  await expect(
    page.getByRole('heading', { level: 2, name: 'Housewarming' }),
  ).toBeVisible()

  await page
    .getByRole('button', { name: /Account menu for Riley Stone/ })
    .click()
  await page.getByRole('menuitem', { name: 'Log out' }).click()
  await expect(page).toHaveURL(/\/$/)

  await page.goto('/events')
  await expect(page).toHaveURL(/\/$/)

  await page.goto('/signin')
  await page.getByLabel(/Email/).fill('riley@example.com')
  await page.getByLabel(/Password/).fill('anything')
  await page.getByRole('button', { name: 'Sign In' }).click()

  await expect(page).toHaveURL(/\/events$/)
  await expect(
    page.getByRole('heading', { level: 2, name: 'Housewarming' }),
  ).toBeVisible()
  await expect(page.getByRole('article')).toHaveCount(1)
})

test('signing in with an unknown email is refused', async ({ page }) => {
  await page.goto('/signin')
  await page.getByLabel(/Email/).fill('nobody@example.com')
  await page.getByLabel(/Password/).fill('anything')
  await page.getByRole('button', { name: 'Sign In' }).click()

  await expect(page.getByRole('alert')).toContainText(
    'No account with this email',
  )
  await expect(page).toHaveURL(/\/signin$/)
})

test('an account never sees the demo events, and the demo never sees the account’s', async ({
  page,
}) => {
  await signUp(page, 'Riley Stone', 'riley@example.com')
  await page.getByRole('button', { name: 'Create your first event' }).click()
  await createEvent(page, 'Housewarming')
  await page.goto('/events/evt-1/guests')
  await expect(
    page.getByRole('heading', { name: 'Page not found' }),
  ).toBeVisible()

  await page.goto('/events')
  await page
    .getByRole('button', { name: /Account menu for Riley Stone/ })
    .click()
  await page.getByRole('menuitem', { name: 'Log out' }).click()
  await tryDemo(page).click()

  await expect(page.getByRole('article')).toHaveCount(6)
  await expect(page.getByText('Housewarming')).toHaveCount(0)
})

test('in the demo an event can be created, duplicated and deleted, and the changes survive a reload', async ({
  page,
}) => {
  await startInDemo(page)
  await page.goto('/events')
  await expect(page.getByRole('article')).toHaveCount(6)

  await page.getByRole('button', { name: 'Create Event' }).click()
  await createEvent(page, 'New Year Dinner')
  await expect(page.getByRole('article')).toHaveCount(7)

  const created = page
    .getByRole('article')
    .filter({ hasText: 'New Year Dinner' })
  await created.getByRole('button', { name: /Actions for/ }).click()
  await page.getByRole('menuitem', { name: 'Duplicate' }).click()
  const duplicate = page.getByRole('dialog', { name: 'Duplicate event' })
  await duplicate.getByLabel(/Event Name/).fill('Second Dinner')
  await duplicate.getByLabel(/^Date/).fill('2031-03-03')
  await duplicate.getByLabel(/^Time \*/).fill('19:00')
  await duplicate.getByRole('button', { name: 'Duplicate Event' }).click()
  await expect(page.getByRole('article')).toHaveCount(8)

  await page.reload()
  await expect(page.getByRole('article')).toHaveCount(8)

  await created.getByRole('button', { name: /Actions for/ }).click()
  await page.getByRole('menuitem', { name: 'Delete' }).click()
  const remove = page.getByRole('dialog', { name: 'Delete event' })
  await expect(
    remove.getByRole('button', { name: 'Delete Event' }),
  ).toBeDisabled()
  await remove.getByLabel('Event Name').fill('New Year Dinner')
  await remove.getByRole('button', { name: 'Delete Event' }).click()

  await expect(page.getByRole('article')).toHaveCount(7)
  await expect(
    page.getByRole('heading', { level: 2, name: 'New Year Dinner' }),
  ).toHaveCount(0)
})

test('the card menu works from the keyboard and returns focus when closed', async ({
  page,
}) => {
  await startInDemo(page)
  await page.goto('/events')
  const trigger = page
    .getByRole('article')
    .filter({ hasText: WEDDING })
    .getByRole('button', { name: /Actions for/ })

  await trigger.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('menuitem').first()).toBeFocused()
  await page.keyboard.press('ArrowDown')
  await expect(page.getByRole('menuitem', { name: 'Duplicate' })).toBeFocused()
  await page.keyboard.press('Escape')

  await expect(page.getByRole('menu')).toHaveCount(0)
  await expect(trigger).toBeFocused()
})

test('filter, search and layout are kept in the address', async ({ page }) => {
  await startInDemo(page)
  await page.goto('/events')

  await page.getByRole('tab', { name: /Past/ }).click()
  await expect(page.getByRole('article')).toHaveCount(2)
  await page.getByRole('button', { name: 'List view' }).click()
  await page.reload()

  await expect(page.getByRole('article')).toHaveCount(2)
  await expect(page.getByRole('button', { name: 'List view' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
})

for (const language of ['en', 'he'] as const) {
  test.describe(`entry pages in ${language}`, () => {
    test.beforeEach(async ({ page }) => {
      await setLanguage(page, language)
    })

    for (const path of ['/', '/signin', '/signup']) {
      test(`${path} has no accessibility violations and fits the screen`, async ({
        page,
      }) => {
        await page.goto(path)
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
        await expect(page.locator('html')).toHaveAttribute(
          'dir',
          language === 'he' ? 'rtl' : 'ltr',
        )

        await expectNoViolations(page)
        await expectNoSidewaysScroll(page, path)

        await page.setViewportSize({ width: 320, height: 640 })
        await expectNoSidewaysScroll(page, `${path} at 320px`)
      })
    }

    test('sign-up with errors shown has no accessibility violations', async ({
      page,
    }) => {
      await page.goto('/signup')
      await page.locator('form button[type="submit"]').click()
      await expect(page.locator('[aria-invalid="true"]')).toHaveCount(1)

      await expectNoViolations(page)
    })

    test('My Events in both layouts, with a menu and each dialog open, has no accessibility violations', async ({
      page,
    }) => {
      await startInDemo(page)
      await page.goto('/events')
      await expect(page.getByRole('article')).toHaveCount(6)
      await expectNoViolations(page)
      await expectNoSidewaysScroll(page, '/events')

      for (const view of ['list', 'grid']) {
        await page.goto(`/events?view=${view}`)
        await expect(page.getByRole('article')).toHaveCount(6)
        await expectNoViolations(page)
        await expectNoSidewaysScroll(page, `/events?view=${view}`)
      }

      const card = page.getByRole('article').filter({ hasText: WEDDING })
      await card.locator('button[aria-haspopup="menu"]').click()
      await expect(page.getByRole('menu')).toBeVisible()
      await expectNoViolations(page)

      await page.getByRole('menuitem').nth(1).click()
      await expect(page.getByRole('dialog')).toBeVisible()
      await page.getByRole('dialog').locator('button[type="submit"]').click()
      await expectNoViolations(page)
      await page.keyboard.press('Escape')

      await card.locator('button[aria-haspopup="menu"]').click()
      await page.getByRole('menuitem').nth(2).click()
      await expect(page.getByRole('dialog')).toBeVisible()
      await expectNoViolations(page)
      await page.keyboard.press('Escape')

      await page.goto('/events?q=zzz')
      await expect(page.getByRole('article')).toHaveCount(0)
      await expectNoViolations(page)
    })

    test('My Events fits a very narrow phone', async ({ page }) => {
      await startInDemo(page)
      await page.setViewportSize({ width: 320, height: 640 })
      for (const view of ['list', 'grid']) {
        await page.goto(`/events?view=${view}`)
        await expect(page.getByRole('article')).toHaveCount(6)
        await expectNoSidewaysScroll(page, `/events?view=${view} at 320px`)
      }
    })
  })
}

test('the sidebar event selector shows the event’s generated cover', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'the selector is inside the drawer on a phone')
  await startInDemo(page)
  await page.goto('/events/evt-1/guests')

  const selector = page.getByRole('button', { name: /Current event/ })
  await expect(selector.locator('svg').first()).toBeVisible()
})
