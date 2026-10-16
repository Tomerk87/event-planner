import { expect, test, type Page } from '@playwright/test'
import { createEventByApi, signUpByApi } from './realApi.ts'

/**
 * The floor plan of a real account (D100): saved on the server, with its
 * picture stored as a file.
 */

function plan(page: Page) {
  return page.getByRole('group', { name: 'Floor plan' })
}

async function addTable(page: Page, eventId: string, number: number) {
  const response = await page.request.post(`/api/events/${eventId}/tables`, {
    data: { number, capacity: 8, shape: 'CIRCLE' },
  })
  expect(response.ok(), await response.text()).toBe(true)
}

test('a real event’s plan and floor picture are saved and come back', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'the layout is edited on a larger screen')
  await signUpByApi(page, 'Olive Owner')
  const event = await createEventByApi(page, { name: 'Plan Party' })
  await addTable(page, event.id, 1)
  await addTable(page, event.id, 2)
  await page.goto(`/events/${event.id}/layout?view=arrangement`)

  await expect(page.getByText('Tables not on the plan yet: 2.')).toBeVisible()
  await page.getByRole('button', { name: 'Edit Layout' }).click()
  await page.getByRole('button', { name: 'Place Table 1 on the plan' }).click()
  await page.getByLabel('From the left (m)').fill('4')
  await page.getByRole('button', { name: 'Place Table 2 on the plan' }).click()
  await page.getByLabel('From the left (m)').fill('8')
  await page.getByRole('button', { name: 'Add Bar' }).click()
  await page.getByRole('button', { name: 'Room and Picture' }).click()
  const picture = await page.evaluate(async () => {
    const canvas = document.createElement('canvas')
    canvas.width = 400
    canvas.height = 300
    canvas.getContext('2d')!.fillRect(0, 0, 200, 150)
    const blob = await new Promise<Blob>((resolve) =>
      canvas.toBlob((made) => resolve(made!), 'image/png'),
    )
    return Array.from(new Uint8Array(await blob.arrayBuffer()))
  })
  await page.getByTestId('floor-picture-file').setInputFiles({
    name: 'floor.png',
    mimeType: 'image/png',
    buffer: Buffer.from(picture),
  })
  await page.getByLabel('Rotate').fill('45')
  await page.getByRole('button', { name: 'Save Layout' }).click()
  await expect(page.getByText('The floor plan was saved.')).toBeVisible()

  await page.reload()
  await expect(
    plan(page).getByRole('button', { name: /^Table \d,/ }),
  ).toHaveCount(2)
  await expect(plan(page).getByRole('img', { name: 'Bar' })).toBeVisible()
  const image = plan(page).locator('image')
  await expect(image).toHaveAttribute('href', /^\/api\/files\//)
  await expect(image).toHaveAttribute('transform', /rotate\(45\)/)

  // Saving again keeps the stored picture.
  await page.getByRole('button', { name: 'Edit Layout' }).click()
  await plan(page)
    .getByRole('button', { name: /^Table 1,/ })
    .focus()
  await page.keyboard.press('ArrowDown')
  await page.getByRole('button', { name: 'Save Layout' }).click()
  await expect(page.getByText('The floor plan was saved.')).toBeVisible()
  await expect(image).toHaveAttribute('href', /^\/api\/files\//)
})
