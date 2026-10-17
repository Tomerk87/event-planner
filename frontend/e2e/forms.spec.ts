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

  await expect(
    page.getByRole('option', { name: 'America/Sao Paulo · Brazil' }),
  ).toBeVisible()
})

test('Change RSVP accepts up to the event’s Maximum Attendees per Guest', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'the row menu is checked on desktop')
  await page.goto('/events/evt-1/guests?rsvp=NO_RESPONSE')
  await page
    .getByRole('table')
    .getByRole('button', { name: /^More actions for/ })
    .first()
    .click()
  await page.getByRole('menuitem', { name: 'Change RSVP' }).click()
  const dialog = page.getByRole('dialog', { name: 'Change RSVP' })
  await dialog.getByRole('radio', { name: 'Approved' }).check()

  await expect(
    dialog.getByText(
      'Up to 5 per invitation (Maximum Attendees per Guest in Event Settings).',
    ),
  ).toBeVisible()
  const attendees = dialog.getByLabel(/^Confirmed Attendees/)
  await attendees.fill('6')
  await dialog.getByRole('button', { name: 'Save RSVP' }).click()
  await expect(
    dialog.getByText('Enter a whole number from 1 to 5.'),
  ).toBeVisible()
  await attendees.fill('5')
  await dialog.getByRole('button', { name: 'Save RSVP' }).click()
  await expect(page.getByText('The RSVP was updated.')).toBeVisible()
})
