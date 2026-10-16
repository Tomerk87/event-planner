import { expect, test, type Page } from '@playwright/test'
import { chooseOption, TEST_PASSWORD } from '../e2e/helpers.ts'
import { addGuestByApi, createEventByApi } from '../e2e/realApi.ts'

/**
 * The deployed stack end to end, through Nginx: static pages and deep links,
 * the demo, a real account on PostgreSQL, a stored picture, and the public
 * RSVP page in English and Hebrew. See playwright.deploy.config.ts.
 *
 * DEPLOY_DEMO_ONLY=1 checks a demo-only site instead (D102, Netlify): only
 * the demo, no account pages, and not one request to the API.
 */
const demoOnly = process.env['DEPLOY_DEMO_ONLY'] === '1'

/**
 * Signs the page up. The address is Amazon SES's mailbox simulator, which
 * accepts every message, so a server with email on bounces nothing.
 */
async function signUp(page: Page) {
  const label = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const response = await page.request.post('/api/auth/sign-up', {
    data: {
      name: 'Smoke Test',
      email: `success+smoke-${label}@simulator.amazonses.com`,
      password: TEST_PASSWORD,
    },
  })
  expect(response.ok(), await response.text()).toBe(true)
}

async function choosePicture(page: Page) {
  const picture = await page.evaluate(async () => {
    const canvas = document.createElement('canvas')
    canvas.width = 1200
    canvas.height = 800
    const context = canvas.getContext('2d')!
    context.fillStyle = '#336699'
    context.fillRect(0, 0, 1200, 800)
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
}

test('the landing page, the demo and a page opened by its address', async ({
  page,
}) => {
  const apiRequests: string[] = []
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith('/api/')) {
      apiRequests.push(request.url())
    }
  })

  await page.goto('/')
  await expect(
    page.getByRole('heading', { level: 1, name: /Plan every guest/ }),
  ).toBeVisible()
  if (demoOnly) {
    await expect(page.getByRole('link', { name: 'Sign In' })).toHaveCount(0)
  }

  await page
    .getByRole('main')
    .getByRole('button', { name: 'Try Demo' })
    .first()
    .click()
  await expect(page).toHaveURL(/\/events$/)
  await expect(page.getByText('Demo Mode')).toBeAttached()

  // Nginx answers every page address with the application.
  await page.goto('/events/evt-1/guests')
  await page.reload()
  await expect(
    page.getByRole('heading', { level: 1, name: 'Guests' }),
  ).toBeVisible()

  if (demoOnly) {
    expect(apiRequests).toEqual([])
  }
})

test('a demo-only site: account pages lead back to the landing page, and a demo RSVP link opens anywhere', async ({
  page,
  browser,
}, testInfo) => {
  test.skip(!demoOnly, 'only for a demo-only site (DEPLOY_DEMO_ONLY=1)')
  const apiRequests: string[] = []
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith('/api/')) {
      apiRequests.push(request.url())
    }
  })

  for (const path of ['/signin', '/signup', '/reset-password?token=x']) {
    await page.goto(path)
    await expect(page).toHaveURL(/\/$/)
    await expect(
      page.getByRole('heading', { level: 1, name: /Plan every guest/ }),
    ).toBeVisible()
  }
  // A link that is not a demo event's is simply not found.
  await page.goto('/rsvp/not-a-demo-link')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

  // The demo data is the same in every browser, so a guest opening a demo
  // event's link elsewhere (as from WhatsApp) gets its RSVP page.
  await page.goto('/')
  await page
    .getByRole('main')
    .getByRole('button', { name: 'Try Demo' })
    .first()
    .click()
  await expect(page).toHaveURL(/\/events$/)
  await page.goto('/events/evt-1/rsvp')
  const link = new URL(await page.getByLabel('RSVP link').inputValue())
  const { baseURL, ...device } = testInfo.project.use
  const guest = await browser.newContext({ ...device, baseURL })
  const guestPage = await guest.newPage()
  guestPage.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith('/api/')) {
      apiRequests.push(request.url())
    }
  })
  await guestPage.goto(link.pathname)
  await expect(
    guestPage.getByRole('button', { name: "I'll be there!" }),
  ).toBeVisible()
  await guest.close()
  expect(apiRequests).toEqual([])
})

test('a real account: guest, stored picture, and public RSVP in English and Hebrew', async ({
  page,
  browser,
}, testInfo) => {
  test.skip(demoOnly, 'a demo-only site has no accounts')
  await signUp(page)
  const event = await createEventByApi(page, { name: 'Smoke Party' })
  const hebrew = await createEventByApi(page, {
    name: 'מסיבת בדיקה',
    rsvpLanguage: 'he',
  })

  try {
    await addGuestByApi(page, event.id, {
      firstName: 'Dana',
      lastName: 'Lev',
      phone: '052-123-4567',
    })
    await page.goto(`/events/${event.id}/guests`)
    await page.reload()
    await expect(page.getByText('Dana Lev').first()).toBeVisible()

    // A picture is stored on the server's volume and served back through Nginx.
    await page.goto(`/events/${event.id}/rsvp`)
    await choosePicture(page)
    await page.getByRole('button', { name: 'Save Changes' }).first().click()
    await expect(page.getByText('RSVP settings saved.')).toBeVisible()
    await page.reload()
    const picture = page.getByRole('img', { name: 'Background image' })
    await expect(picture).toHaveAttribute('src', /^\/api\/files\//)
    await expect
      .poll(() => picture.evaluate((img: HTMLImageElement) => img.naturalWidth))
      .toBeGreaterThan(0)

    // The guest answers with no session, as from the WhatsApp link.
    const { baseURL, ignoreHTTPSErrors, ...device } = testInfo.project.use
    const guest = await browser.newContext({
      ...device,
      baseURL,
      ignoreHTTPSErrors,
    })
    const guestPage = await guest.newPage()
    await guestPage.goto(`/rsvp/${event.rsvpSlug}`)
    await guestPage.getByRole('textbox', { name: 'Full Name' }).fill('Dana Lev')
    await guestPage
      .getByRole('textbox', { name: 'Phone Number' })
      .fill('052-123-4567')
    await chooseOption(
      guestPage.getByRole('combobox', { name: 'Number of Attendees' }),
      '2',
    )
    await guestPage.getByRole('button', { name: "I'll be there!" }).click()
    await expect(guestPage.getByText('Attendees confirmed: 2')).toBeVisible()

    await guestPage.goto(`/rsvp/${hebrew.rsvpSlug}`)
    await expect(guestPage.getByRole('button', { name: 'אגיע!' })).toBeVisible()
    await expect(guestPage.locator('main [dir="rtl"]').first()).toBeVisible()
    await guest.close()

    await page.goto(`/events/${event.id}/dashboard`)
    await expect(
      page.getByRole('heading', { level: 1, name: 'Dashboard' }),
    ).toBeVisible()
    const dashboard = await page.request.get(
      `/api/events/${event.id}/dashboard`,
    )
    expect(dashboard.ok()).toBe(true)
    expect(await dashboard.json()).toMatchObject({
      metrics: { confirmedAttendees: 2 },
    })
  } finally {
    for (const id of [event.id, hebrew.id]) {
      await page.request.delete(`/api/events/${id}`)
    }
  }
})
