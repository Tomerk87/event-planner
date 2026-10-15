import { expect, test, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { chooseOption, TEST_PASSWORD, uniqueEmail } from './helpers.ts'

/**
 * A real account, end to end, against the API on the test database: the
 * same pages as the demo, with the data on the server.
 */

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

async function signUp(page: Page, email: string) {
  await page.goto('/signup')
  await page.getByLabel(/Full name/).fill('Riley Stone')
  await page.getByLabel(/Email/).fill(email)
  await page.getByLabel(/Password/).fill(TEST_PASSWORD)
  await page.getByRole('button', { name: 'Sign Up' }).click()
  await expect(page).toHaveURL(/\/events$/)
}

/** Creates an event and returns its address in the application. */
async function createEvent(page: Page, name: string): Promise<string> {
  await page.getByRole('button', { name: 'Create your first event' }).click()
  const dialog = page.getByRole('dialog', { name: 'Create event' })
  await dialog.getByLabel(/Event Name/).fill(name)
  await dialog.getByLabel(/^Date/).fill('2031-02-02')
  await dialog.getByLabel(/^Time \*/).fill('18:00')
  await dialog.getByRole('button', { name: 'Create Event' }).click()
  await expect(dialog).toBeHidden()
  // A grid card opens from its Open button, a list row from its name.
  await page
    .getByRole('article')
    .filter({ hasText: name })
    .getByRole('link')
    .first()
    .click()
  await expect(page).toHaveURL(/\/events\/[0-9a-f-]{36}/)
  return new URL(page.url()).pathname.split('/').slice(0, 3).join('/')
}

test('a real account runs an event: guest, WhatsApp send, public RSVP, Dashboard, seating file', async ({
  page,
  browser,
}) => {
  const openedLinks = await captureOpenedLinks(page)
  await signUp(page, uniqueEmail('riley'))
  await expect(page.getByText('Demo Mode')).toHaveCount(0)
  const event = await createEvent(page, 'Garden Party')

  // A guest.
  await page.goto(`${event}/guests`)
  await page.getByRole('button', { name: 'Add Guest' }).first().click()
  const add = page.getByRole('dialog', { name: 'Add Guest' })
  await add.getByLabel(/First Name/).fill('Dana')
  await add.getByLabel(/Last Name/).fill('Lev')
  await add.getByLabel(/Phone Number/).fill('052-123-4567')
  await add.getByRole('button', { name: 'Add Guest' }).click()
  await expect(page.getByText('The guest was added.')).toBeVisible()

  // A WhatsApp send, opened from the click and counted on the server.
  await page
    .getByRole('button', { name: 'Send a WhatsApp message to Dana Lev' })
    .first()
    .click()
  const send = page.getByRole('dialog', { name: 'Send WhatsApp message' })
  await send.getByRole('button', { name: 'Open WhatsApp' }).click()
  await expect(page.getByText('WhatsApp opened for Dana Lev.')).toBeVisible()
  const [link] = await openedLinks()
  expect(link).toMatch(/^https:\/\/wa\.me\/972521234567\?text=Hello%20Dana/)
  // The message carries the real public link of the event.
  expect(decodeURIComponent(link!)).toMatch(/\/rsvp\/[\w-]+/)

  // The guest answers from another browser, with no session at all.
  await page.goto(`${event}/rsvp`)
  const publicLink = await page.getByLabel('RSVP link').inputValue()
  const guestContext = await browser.newContext()
  const guest = await guestContext.newPage()
  await guest.goto(publicLink)
  await guest.getByRole('textbox', { name: 'Full Name' }).fill('Dana L.')
  await guest.getByRole('textbox', { name: 'Phone Number' }).fill('0521234567')
  await chooseOption(
    guest.getByRole('combobox', { name: 'Number of Attendees' }),
    '2',
  )
  await guest.getByRole('button', { name: "I'll be there!" }).click()
  await expect(guest.getByText('Attendees confirmed: 2')).toBeVisible()
  await guestContext.close()

  // The Dashboard counts both, from the server's records.
  await page.goto(`${event}/dashboard`)
  const figures = page.getByRole('region', { name: 'Key figures' })
  await expect(
    figures
      .locator('div', { hasText: /^Invitations Sent/ })
      .locator('p')
      .nth(1),
  ).toHaveText('1')
  await expect(
    figures
      .locator('div', { hasText: /^Confirmed Attendees/ })
      .locator('p')
      .nth(1),
  ).toHaveText('2')

  // A table, and the seating list written by the server.
  await page.goto(`${event}/layout`)
  await page.getByRole('button', { name: 'Add Table' }).first().click()
  const table = page.getByRole('dialog', { name: 'Add Table' })
  await table.getByRole('button', { name: 'Add Table' }).click()
  await expect(table).toBeHidden()
  const [file] = await Promise.all([
    page.waitForEvent('download'),
    (async () => {
      await page.getByRole('button', { name: 'Export Tables' }).click()
      await page.getByRole('menuitem', { name: 'CSV file (.csv)' }).click()
    })(),
  ])
  expect(file.suggestedFilename()).toMatch(/Garden Party.*\.csv$/)
  const text = await readFile(await file.path(), 'utf8')
  expect(text.replace(/^﻿/, '').split('\r\n')[0]).toBe(
    'First Name,Last Name,Invitation Name,Phone,Number of Attendees,Table Number',
  )

  // Everything is still there after a reload: it lives on the server.
  await page.goto(`${event}/guests`)
  await page.reload()
  await expect(page.getByText('Dana').first()).toBeVisible()
})

test('a session belongs to its own account, and the demo never sees it', async ({
  page,
  browser,
}) => {
  const email = uniqueEmail('owner')
  await signUp(page, email)
  const event = await createEvent(page, 'Private Dinner')

  // Someone else, signed in to their own account, cannot open the event.
  const other = await browser.newContext()
  const otherPage = await other.newPage()
  await signUp(otherPage, uniqueEmail('other'))
  await otherPage.goto(`${event}/guests`)
  await expect(
    otherPage.getByRole('heading', { name: 'Page not found' }),
  ).toBeVisible()
  await other.close()

  // A fresh visitor in the demo sees only the demo's events.
  const visitor = await browser.newContext()
  const visitorPage = await visitor.newPage()
  await visitorPage.goto('/')
  await visitorPage
    .getByRole('main')
    .getByRole('button', { name: 'Try Demo' })
    .first()
    .click()
  await expect(visitorPage.getByRole('article')).toHaveCount(6)
  await expect(visitorPage.getByText('Private Dinner')).toHaveCount(0)
  await visitor.close()
})
