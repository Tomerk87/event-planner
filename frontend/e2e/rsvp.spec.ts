import { AxeBuilder } from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { chooseOption, openNavigation, startInDemo } from './helpers.ts'

const SETTINGS = '/events/evt-1/rsvp'

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

async function expectNoSidewaysScroll(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
    )
    .toBe(true)
}

/** On a phone the settings and the preview are separate tabs. */
async function showPreview(page: Page, isMobile: boolean) {
  if (isMobile) {
    await page.getByRole('tab', { name: 'Preview', exact: true }).click()
  }
}

async function publicLink(page: Page): Promise<string> {
  return page.getByLabel('RSVP link').inputValue()
}

async function answer(
  page: Page,
  name: string,
  phone: string,
  attendees: string,
  response: string,
) {
  await page.getByRole('textbox', { name: 'Full Name' }).fill(name)
  await page.getByRole('textbox', { name: 'Phone Number' }).fill(phone)
  await chooseOption(
    page.getByRole('combobox', { name: 'Number of Attendees' }),
    attendees,
  )
  await page.getByRole('button', { name: response }).click()
}

test('RSVP Settings is reached from the menu and has no accessibility violations', async ({
  page,
  isMobile,
}) => {
  await page.goto('/events/evt-1/dashboard')
  const navigation = await openNavigation(page)
  await navigation.getByRole('link', { name: 'RSVP', exact: true }).click()

  await expect(
    page.getByRole('heading', { level: 1, name: 'RSVP Settings' }),
  ).toBeVisible()
  await expectNoViolations(page)
  await expectNoSidewaysScroll(page)

  await showPreview(page, isMobile)
  await expect(
    page.getByRole('group', { name: 'Preview of the public RSVP page' }),
  ).toBeVisible()
  await expectNoViolations(page)
  await expectNoSidewaysScroll(page)
})

test('an edited message shows in the preview, is saved, and reaches the public page', async ({
  page,
  isMobile,
}) => {
  await page.goto(SETTINGS)
  await page.getByLabel('Welcome Message').fill('Come and celebrate with us')
  await page
    .getByRole('switch', { name: /Add to Google Calendar/ })
    .check({ force: true })
  const link = await publicLink(page)
  await page.getByRole('button', { name: 'Save Changes' }).click()
  await expect(page.getByText('RSVP settings saved.')).toBeVisible()

  await showPreview(page, isMobile)
  await expect(
    page
      .getByRole('group', { name: 'Preview of the public RSVP page' })
      .getByText('Come and celebrate with us'),
  ).toBeVisible()

  await page.goto(link)
  await expect(page.getByText('Come and celebrate with us')).toBeVisible()
  await expect(page.getByText('Add to Calendar')).toBeVisible()
  await expect(page.getByRole('navigation')).toHaveCount(0)
  await expectNoViolations(page)
  await expectNoSidewaysScroll(page)
})

test('a guest answers in another tab and the organizer sees it', async ({
  page,
  context,
}) => {
  await page.goto('/events/evt-1/guests?tab=unknown')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await page.goto(SETTINGS)
  const link = await publicLink(page)

  const guestTab = await context.newPage()
  await guestTab.goto(link)
  await guestTab.getByRole('button', { name: "I'll be there!" }).click()
  await expect(guestTab.getByText('Enter your name.')).toBeVisible()
  await expectNoViolations(guestTab)

  await answer(guestTab, 'Walk In Guest', '050-000-7777', '2', "I'll be there!")
  await expect(guestTab.getByText('Attendees confirmed: 2')).toBeVisible()
  await expectNoViolations(guestTab)
  await guestTab.getByRole('button', { name: 'Change My Response' }).click()
  await guestTab.getByRole('button', { name: 'Not sure yet' }).click()
  await expect(guestTab.getByRole('status')).toBeVisible()
  await guestTab.close()

  // The organizer's tab was open all along and is not reloaded.
  const navigation = await openNavigation(page)
  await navigation.getByRole('link', { name: 'Guests' }).click()
  await page.getByRole('tab', { name: /Unknown Guests/ }).click()
  await expect(page.getByText('Walk In Guest').first()).toBeVisible()
})

test('the public page opens in Hebrew for a Hebrew event and switches to English', async ({
  page,
}) => {
  await page.goto('/events/evt-2/rsvp')
  const link = await publicLink(page)
  await page.goto(link)

  await expect(page.getByRole('button', { name: 'אגיע!' })).toBeVisible()
  await expect(page.locator('main [dir="rtl"]').first()).toBeVisible()
  await expectNoViolations(page)
  await expectNoSidewaysScroll(page)

  await page.getByRole('button', { name: 'שפה' }).click()
  await page.getByRole('menuitem', { name: 'English' }).click()
  await expect(
    page.getByRole('button', { name: "I'll be there!" }),
  ).toBeVisible()
})

test('a past event’s page is closed, and an unknown link says so plainly', async ({
  page,
}) => {
  await page.goto('/events/evt-5/rsvp')
  await expect(page.getByText('RSVP page is closed')).toBeVisible()
  await page.goto(await publicLink(page))
  await expect(page.getByText('RSVP is closed')).toBeVisible()
  await expect(page.getByRole('textbox')).toHaveCount(0)

  await page.goto('/rsvp/no-such-link')
  await expect(
    page.getByRole('heading', { name: 'This RSVP page is not available' }),
  ).toBeVisible()
  await expectNoViolations(page)
})

test('the QR code and the full-size preview open from the settings', async ({
  page,
  isMobile,
}) => {
  await page.goto(SETTINGS)
  await page.getByRole('button', { name: 'Show QR Code' }).click()
  const dialog = page.getByRole('dialog', { name: 'RSVP QR Code' })
  await expect(
    dialog.getByRole('img', { name: 'QR code of the RSVP link' }),
  ).toBeVisible()
  await expectNoViolations(page)
  const download = page.waitForEvent('download')
  await dialog.getByRole('button', { name: 'Download' }).click()
  expect((await download).suggestedFilename()).toMatch(/RSVP QR\.png$/)
  await dialog.getByRole('button', { name: 'Close' }).click()

  await page.getByRole('button', { name: 'Preview Public Page' }).click()
  if (isMobile) {
    await expect(
      page.getByRole('tab', { name: 'Preview', exact: true }),
    ).toHaveAttribute('aria-selected', 'true')
  } else {
    await expect(
      page.getByRole('dialog', { name: 'Public Page Preview' }),
    ).toBeVisible()
    await expectNoViolations(page)
  }
})

test('a background picture is shrunk in the browser and shown in the preview', async ({
  page,
  isMobile,
}) => {
  await page.goto(SETTINGS)
  const picture = await page.evaluate(async () => {
    const canvas = document.createElement('canvas')
    canvas.width = 2400
    canvas.height = 1200
    const context = canvas.getContext('2d')!
    context.fillStyle = '#336699'
    context.fillRect(0, 0, 2400, 1200)
    const blob = await new Promise<Blob>((resolve) =>
      canvas.toBlob((made) => resolve(made!), 'image/png'),
    )
    return Array.from(new Uint8Array(await blob.arrayBuffer()))
  })
  await page.getByTestId('background-file').setInputFiles({
    name: 'background.png',
    mimeType: 'image/png',
    buffer: Buffer.from(picture),
  })

  const thumbnail = page.getByRole('img', { name: 'Background image' })
  await expect(thumbnail).toBeVisible()
  expect(await thumbnail.getAttribute('src')).toMatch(
    /^data:image\/jpeg;base64,/,
  )
  expect(
    await thumbnail.evaluate((image: HTMLImageElement) => image.naturalWidth),
  ).toBe(1600)

  await page.getByRole('button', { name: 'Save Changes' }).click()
  await expect(page.getByText('RSVP settings saved.')).toBeVisible()
  await page.reload()
  await expect(
    page.getByRole('img', { name: 'Background image' }),
  ).toBeVisible()
  await showPreview(page, isMobile)
  await expectNoViolations(page)
})
