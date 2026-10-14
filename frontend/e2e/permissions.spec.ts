import { AxeBuilder } from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { chooseOption, openNavigation, startInDemo } from './helpers.ts'

const PERMISSIONS = '/events/evt-1/permissions'

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

/** The members, whichever way this screen shows them. */
function memberList(page: Page, isMobile: boolean) {
  return isMobile
    ? page.getByRole('list', { name: 'Event members' })
    : page.getByRole('table', { name: 'Event members' })
}

/** One member's row on desktop, or card on a phone. */
function entry(page: Page, isMobile: boolean, text: string) {
  return memberList(page, isMobile)
    .getByRole(isMobile ? 'listitem' : 'row')
    .filter({ hasText: text })
}

async function invite(page: Page, email: string, role?: string) {
  await page.getByRole('button', { name: 'Invite User' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Email').fill(email)
  if (role) {
    await chooseOption(
      dialog.getByRole('combobox', { name: 'Permission Type' }),
      role,
    )
  }
  await dialog.getByRole('button', { name: 'Invite', exact: true }).click()
}

test('lists the members and passes the accessibility check', async ({
  page,
  isMobile,
}) => {
  await page.goto(PERMISSIONS)

  await expect(
    page.getByRole('heading', { name: 'Permissions', level: 1 }),
  ).toBeVisible()
  await expect(entry(page, isMobile, 'Alex Morgan')).toContainText('You')
  await expect(entry(page, isMobile, 'morgan.reed@example.com')).toContainText(
    'Pending',
  )
  await expectNoSidewaysScroll(page, 'the members list')
  await expectNoViolations(page)

  await page.getByRole('button', { name: 'Invite User' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expectNoViolations(page)
})

test('an invited email stays pending across a reload, and can be cancelled', async ({
  page,
  isMobile,
}) => {
  await page.goto(PERMISSIONS)

  await invite(page, 'new.person@example.com', 'ADMIN')
  await expect(
    page.getByText('new.person@example.com is invited'),
  ).toBeVisible()

  await page.reload()
  const pending = entry(page, isMobile, 'new.person@example.com')
  await expect(pending).toContainText('Pending')
  await expect(pending).toContainText('Admin')

  await pending
    .getByRole('button', { name: /Cancel the invitation of/ })
    .click()
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Cancel Invitation' })
    .click()
  await expect(pending).toHaveCount(0)
})

test('adds an existing account, changes its role and removes it', async ({
  page,
  isMobile,
}) => {
  await page.goto(PERMISSIONS)

  await invite(page, 'jamie.rhodes@example.com')
  const jamie = entry(page, isMobile, 'Jamie Rhodes')
  await expect(jamie).toContainText('Viewer')

  await jamie
    .getByRole('button', { name: 'Change role of Jamie Rhodes' })
    .click()
  const dialog = page.getByRole('dialog')
  await chooseOption(
    dialog.getByRole('combobox', { name: 'Permission Type' }),
    'OWNER',
  )
  await dialog.getByRole('button', { name: 'Save' }).click()
  await expect(jamie).toContainText('Owner')

  await jamie.getByRole('button', { name: 'Remove Jamie Rhodes' }).click()
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Remove', exact: true })
    .click()
  await expect(jamie).toHaveCount(0)
})

test('a Viewer has no Permissions entry and cannot open the address', async ({
  page,
}) => {
  await page.goto('/events/evt-4/permissions')

  await expect(page.getByText('You cannot open this page')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Invite User' })).toHaveCount(0)
  const nav = await openNavigation(page)
  await expect(nav.getByRole('link', { name: 'Dashboard' })).toBeVisible()
  await expect(nav.getByRole('link', { name: 'Permissions' })).toHaveCount(0)
})

test('an Admin of a past event sees its members but cannot change them', async ({
  page,
  isMobile,
}) => {
  // The demo user is an Admin of the gala, which has passed.
  await page.goto('/events/evt-6/permissions')

  await expect(
    page.getByText('Only an Owner can change the permissions'),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: 'Invite User' })).toHaveCount(0)
  await expect(memberList(page, isMobile)).toBeVisible()
  await expect(memberList(page, isMobile).getByRole('button')).toHaveCount(0)
})

for (const language of ['en', 'he'] as const) {
  test(`fits the screen in ${language}`, async ({ page }) => {
    await page.addInitScript((value) => {
      window.localStorage.setItem('event-planner.language', value)
    }, language)
    await page.goto(PERMISSIONS)

    await expect(
      page.getByRole('heading', {
        name: language === 'he' ? 'הרשאות' : 'Permissions',
        level: 1,
      }),
    ).toBeVisible()
    await expect(page.locator('html')).toHaveAttribute(
      'dir',
      language === 'he' ? 'rtl' : 'ltr',
    )
    await expect(page.getByText('jordan.hale@example.com')).toBeVisible()
    await expectNoSidewaysScroll(page, `permissions in ${language}`)
  })
}
