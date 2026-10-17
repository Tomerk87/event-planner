import { expect, test } from '@playwright/test'
import { startInDemo } from './helpers.ts'

/**
 * Owner feedback of 2026-10-17 (D104): a field's error goes as soon as the
 * field is edited, a time zone can be found by its country, and an answer
 * is limited by the event's Maximum Attendees per Guest.
 */

test.beforeEach(async ({ page }) => {
  await startInDemo(page)
})

test('a field’s error goes as soon as it is edited', async ({ page }) => {
  await page.goto('/events/evt-1/guests')
  await page.getByRole('button', { name: 'Add Guest' }).first().click()
  const dialog = page.getByRole('dialog', { name: 'Add Guest' })
  await dialog.getByLabel(/^First Name/).fill('Noa')
  await dialog.getByLabel(/^Phone Number/).fill('12')
  await dialog.getByRole('button', { name: 'Add Guest' }).click()

  const phone = dialog.getByLabel(/^Phone Number/)
  await expect(dialog.getByText('Enter a valid phone number.')).toBeVisible()
  await expect(phone).toHaveAttribute('aria-invalid', 'true')

  await phone.pressSequentially('3')
  await expect(dialog.getByText('Enter a valid phone number.')).toBeHidden()
  await expect(phone).not.toHaveAttribute('aria-invalid', 'true')
})

test('a time zone is found by its country', async ({ page }) => {
  await page.goto('/events/evt-1/settings')
  const zone = page.getByRole('combobox', { name: /^Timezone/ })
  await zone.click()
  await zone.fill('brazil')

  const saoPaulo = page.getByRole('option', {
    name: 'America/Sao Paulo · Brazil',
  })
  await expect(saoPaulo).toBeVisible()

  // A tap chooses it (on an iPhone the tap used to close the list first).
  await saoPaulo.click()
  await expect(page.getByRole('listbox')).toBeHidden()
  await expect(zone).toHaveValue('America/Sao Paulo · Brazil')
})

test('Status and Confirmed change in the table, within the event’s maximum per guest (D105)', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'the cells are edited in the desktop table')
  await page.goto('/events/evt-1/guests?rsvp=NO_RESPONSE')
  const row = page
    .getByRole('table', { name: 'Guests' })
    .locator('tbody tr')
    .first()

  const name = await row.locator('button[title^="View details"]').textContent()
  // One click opens the Status dropdown, as the filters open.
  await row.getByRole('combobox', { name: /^Status of / }).click()
  await page.getByRole('option', { name: 'Approved' }).click()
  await expect(page.getByText('The RSVP was updated.')).toBeVisible()

  // The guest is now approved, so the list (filtered on No response) drops
  // them; find them through Approved.
  await page.goto(`/events/evt-1/guests?q=${encodeURIComponent(name ?? '')}`)
  const approved = page
    .getByRole('table', { name: 'Guests' })
    .locator('tbody tr')
    .first()
  await approved
    .getByRole('button', { name: /^Confirmed attendees of / })
    .dblclick()
  const count = approved.getByRole('spinbutton')
  await count.fill('6')
  await count.press('Enter')
  await expect(approved.getByRole('alert')).toHaveText('1 to 5')
  await count.fill('5')
  await expect(approved.getByRole('alert')).toBeHidden()
  await count.press('Enter')
  await expect(
    approved.getByRole('button', { name: /^Confirmed attendees of .*: 5\./ }),
  ).toBeVisible()
})
