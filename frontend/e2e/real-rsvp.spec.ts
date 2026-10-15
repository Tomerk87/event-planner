import { expect, test, type Page } from '@playwright/test'
import { openNavigation } from './helpers.ts'
import { createEventByApi, signUpByApi } from './realApi.ts'

/**
 * RSVP Settings on a real account, where a saved picture comes back as the
 * address of a stored file rather than as the uploaded data.
 */

async function choosePicture(page: Page) {
  const picture = await page.evaluate(async () => {
    const canvas = document.createElement('canvas')
    canvas.width = 1200
    canvas.height = 800
    const context = canvas.getContext('2d')!
    context.fillStyle = '#336699'
    context.fillRect(0, 0, 1200, 800)
    context.fillStyle = '#ffcc00'
    context.fillRect(0, 0, 300, 200)
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

async function save(page: Page) {
  await page.getByRole('button', { name: 'Save Changes' }).first().click()
  await expect(page.getByText('RSVP settings saved.')).toBeVisible()
}

test('saves again after a picture was stored, with its zoom and position', async ({
  page,
}) => {
  await signUpByApi(page, 'Olive Owner')
  const event = await createEventByApi(page, { name: 'Picture Party' })
  await page.goto(`/events/${event.id}/rsvp`)

  await choosePicture(page)
  await expect(
    page.getByRole('img', { name: 'Background image' }),
  ).toBeVisible()
  await save(page)
  expect(
    await page
      .getByRole('img', { name: 'Background image' })
      .getAttribute('src'),
  ).toMatch(/^\/api\/files\//)

  // The second save used to stop in the browser, with nothing sent.
  await page.getByLabel(/^Declined Message/).fill('Next time!')
  await page.getByRole('button', { name: 'Additional Options' }).click()
  await page.getByLabel('Zoom').fill('180')
  await page.getByLabel('Horizontal Position').fill('10')
  await page.getByLabel('Vertical Position').fill('20')
  await save(page)
  await expect(
    page.getByRole('button', { name: 'Save Changes' }).first(),
  ).toBeDisabled()

  await page.reload()
  await expect(page.getByLabel(/^Declined Message/)).toHaveValue('Next time!')
  await page.getByRole('button', { name: 'Additional Options' }).click()
  await expect(page.getByLabel('Zoom')).toHaveValue('180')

  // Guests see the picture framed the same way.
  await page.goto(`/rsvp/${event.rsvpSlug}`)
  const shown = page.locator('img[src^="/api/files/"]')
  await expect(shown).toHaveCSS('object-position', '10% 20%')
  await expect(shown).toHaveCSS('transform', 'matrix(1.8, 0, 0, 1.8, 0, 0)')

  // Nothing is left unsaved, so leaving does not ask.
  await page.goto(`/events/${event.id}/rsvp`)
  await expect(page.getByLabel(/^Declined Message/)).toHaveValue('Next time!')
  const nav = await openNavigation(page)
  await nav.getByRole('link', { name: 'Guests' }).click()
  await expect(page).toHaveURL(new RegExp(`/events/${event.id}/guests$`))
  await expect(
    page.getByRole('dialog', { name: 'Leave without saving?' }),
  ).toHaveCount(0)
})
