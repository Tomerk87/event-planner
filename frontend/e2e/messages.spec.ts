import { AxeBuilder } from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { openNavigation, startInDemo } from './helpers.ts'

const MESSAGES = '/events/evt-1/messages'

/** Records WhatsApp links instead of opening them, so no test leaves the app. */
async function captureOpenedLinks(page: Page) {
  await page.addInitScript(() => {
    const opened: string[] = []
    Object.assign(window, { openedLinks: opened })
    window.open = (url) => {
      opened.push(String(url))
      return null
    }
  })
  return () =>
    page.evaluate(
      () => (window as unknown as { openedLinks: string[] }).openedLinks,
    )
}

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

async function openMessages(page: Page, path: string = MESSAGES) {
  await page.goto(path)
  await expect(
    page.getByRole('heading', { name: /Message Template|תבנית ההודעה/ }),
  ).toBeVisible()
}

async function showPreview(page: Page, isMobile: boolean) {
  if (isMobile) {
    await page.getByRole('tab', { name: 'Preview' }).click()
  }
  return page.getByRole('group', { name: 'WhatsApp preview' })
}

test('the preview follows the editor, and a saved message survives a reload', async ({
  page,
  isMobile,
}) => {
  await openMessages(page)
  const editor = page.getByRole('textbox', { name: 'Message' })

  await editor.fill('Dear {{first_name}}, *welcome*! {{rsvp_url}}')
  await page.getByRole('button', { name: 'Save Changes' }).click()
  await expect(page.getByText('Message saved.')).toBeVisible()

  const preview = await showPreview(page, isMobile)
  await expect(preview.getByText(/^Dear \S+, /)).toBeVisible()
  await expect(preview.locator('strong')).toHaveText('welcome')
  await expect(preview.getByText(/\/rsvp\//)).toBeVisible()

  await page.reload()
  await expect(page.getByRole('textbox', { name: 'Message' })).toHaveValue(
    'Dear {{first_name}}, *welcome*! {{rsvp_url}}',
  )
})

test('the toolbar formats the selection and inserts a variable', async ({
  page,
}) => {
  await openMessages(page)
  const editor = page.getByRole('textbox', { name: 'Message' })
  await editor.fill('Hello friend')
  await editor.selectText()

  await page.getByRole('button', { name: 'Bold' }).click()
  await expect(editor).toHaveValue('*Hello friend*')

  await editor.evaluate((element: HTMLTextAreaElement) =>
    element.setSelectionRange(element.value.length, element.value.length),
  )
  await page.getByRole('button', { name: 'Insert {{event_name}}' }).click()
  await expect(editor).toHaveValue('*Hello friend*{{event_name}}')
  await expect(editor).toBeFocused()
})

test('Send Test Message opens WhatsApp with the message and no recipient', async ({
  page,
}) => {
  const openedLinks = await captureOpenedLinks(page)
  await openMessages(page)
  await page.getByRole('textbox', { name: 'Message' }).fill('Quick test?')

  await page.getByRole('button', { name: 'Send Test Message' }).click()

  expect(await openedLinks()).toEqual(['https://wa.me/?text=Quick%20test%3F'])
})

test('sending from the Guests page opens WhatsApp for that guest and is listed', async ({
  page,
  isMobile,
}) => {
  const openedLinks = await captureOpenedLinks(page)
  await page.goto('/events/evt-1/guests?q=Alex%20Reed')
  await page
    .getByRole('button', { name: 'Send a WhatsApp message to Alex Reed' })
    .first()
    .click()
  const dialog = page.getByRole('dialog', { name: 'Send WhatsApp message' })
  await expect(dialog.getByText(/Hello Alex,/)).toBeVisible()

  await dialog.getByRole('button', { name: 'Open WhatsApp' }).click()

  await expect(page.getByText('WhatsApp opened for Alex Reed.')).toBeVisible()
  const [link] = await openedLinks()
  expect(link).toMatch(/^https:\/\/wa\.me\/972\d{8,9}\?text=Hello%20Alex%2C/)
  expect(await openedLinks()).toHaveLength(1)

  const nav = await openNavigation(page)
  await nav.getByRole('link', { name: 'Messages' }).click()
  await expect(
    page.getByRole('heading', { name: 'Recent Sent Messages' }),
  ).toBeVisible()
  await expect(
    page
      .getByRole(isMobile ? 'list' : 'table', { name: 'Recent Sent Messages' })
      .getByText('Alex Reed')
      .first(),
  ).toBeVisible()
})

test('a sent message can be viewed and sent again', async ({ page }) => {
  const openedLinks = await captureOpenedLinks(page)
  await openMessages(page)
  const menu = page
    .getByRole('button', { name: /^Actions for the message to/ })
    .first()

  await menu.click()
  await page.getByRole('menuitem', { name: 'View message' }).click()
  const viewed = page.getByRole('dialog', { name: /^Message to/ })
  await expect(viewed.getByText(/Hello /)).toBeVisible()
  await expectNoViolations(page)
  await page.keyboard.press('Escape')

  await menu.click()
  await page.getByRole('menuitem', { name: 'Send again' }).click()
  await page
    .getByRole('dialog', { name: 'Send WhatsApp message' })
    .getByRole('button', { name: 'Open WhatsApp' })
    .click()

  await expect(page.getByText(/^WhatsApp opened for/)).toBeVisible()
  expect(await openedLinks()).toHaveLength(1)
})

test('a past event shows the message read-only', async ({ page }) => {
  await openMessages(page, '/events/evt-5/messages')

  await expect(page.getByText('This event has ended')).toBeVisible()
  await expect(
    page.getByRole('textbox', { name: 'Message' }),
  ).not.toBeEditable()
  await expect(page.getByRole('button', { name: 'Save Changes' })).toHaveCount(
    0,
  )
  await expect(
    page.getByRole('button', { name: 'Send Test Message' }),
  ).toHaveCount(0)
})

test('a phone gets Message Editor and Preview tabs with the actions in the bottom bar', async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, 'desktop shows the editor and preview side by side')
  await openMessages(page)
  const bar = page.getByRole('region', { name: 'Page actions' })
  await expect(bar.getByRole('button')).toHaveText([
    'Send Test Message',
    'Save Changes',
  ])

  await page.getByRole('tab', { name: 'Preview' }).click()

  await expect(
    page.getByRole('group', { name: 'WhatsApp preview' }),
  ).toBeVisible()
  await expect(bar.getByRole('button')).toHaveText([
    'Back to Editor',
    'Send Test Message',
  ])
  await bar.getByRole('button', { name: 'Back to Editor' }).click()
  await expect(page.getByRole('textbox', { name: 'Message' })).toBeVisible()
})

test('desktop shows the editor and the preview together', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'a phone uses tabs')
  await openMessages(page)

  await expect(page.getByRole('tab')).toHaveCount(0)
  await expect(
    page.getByRole('group', { name: 'WhatsApp preview' }),
  ).toBeVisible()
  await expect(
    page.getByRole('table', { name: 'Recent Sent Messages' }),
  ).toBeVisible()
})

for (const language of ['en', 'he'] as const) {
  test(`the page is accessible and fits the screen (${language})`, async ({
    page,
  }) => {
    await page.addInitScript((value) => {
      window.localStorage.setItem('event-planner.language', value)
    }, language)
    await openMessages(page)
    await expect(page.locator('html')).toHaveAttribute(
      'dir',
      language === 'he' ? 'rtl' : 'ltr',
    )
    await expect(
      page.getByRole('heading', {
        name: /Recent Sent Messages|הודעות שנשלחו לאחרונה/,
      }),
    ).toBeVisible()

    await expectNoViolations(page)
    await expectNoSidewaysScroll(page, `${MESSAGES} (${language})`)
    await page.setViewportSize({ width: 320, height: 640 })
    await expectNoSidewaysScroll(page, `${MESSAGES} at 320px (${language})`)
  })
}
