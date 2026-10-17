import { expect, test, type Download, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { readSheet } from 'read-excel-file/node'
import { chooseOption } from './helpers.ts'
import {
  addGuestByApi,
  answerRsvpByApi,
  createEventByApi,
  signUpByApi,
} from './realApi.ts'

/**
 * A real account's guests, messages, public answers and seating, all kept
 * by the server: the same pages as the demo, with every rule applied there.
 */

/** Records WhatsApp links instead of opening them. */
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

function figure(page: Page, region: string, label: string) {
  return page
    .getByRole('region', { name: region })
    .locator('div', { hasText: new RegExp(`^${label}`) })
    .locator('p')
    .nth(1)
}

async function download(page: Page, action: () => Promise<void>) {
  const [file] = await Promise.all([page.waitForEvent('download'), action()])
  return file
}

async function csvRows(file: Download) {
  const text = await readFile(await file.path(), 'utf8')
  return text.replace(/^﻿/, '').trim().split('\r\n')
}

async function addGuest(page: Page, first: string, phone: string) {
  await page.getByRole('button', { name: 'Add Guest' }).first().click()
  const dialog = page.getByRole('dialog', { name: 'Add Guest' })
  await dialog.getByLabel(/First Name/).fill(first)
  await dialog.getByLabel(/Phone Number/).fill(phone)
  await dialog.getByRole('button', { name: 'Add Guest' }).click()
  return dialog
}

test('guests are added, refused as duplicates, deleted, restored by import and exported', async ({
  page,
}) => {
  await signUpByApi(page, 'Olive Owner')
  const event = await createEventByApi(page, { name: 'Spring Picnic' })
  await page.goto(`/events/${event.id}/guests`)

  await addGuest(page, 'Zohar', '050-555-0199')
  await expect(page.getByText('The guest was added.')).toBeVisible()
  await expect(figure(page, 'Guest figures', 'Total Guests')).toHaveText('1')

  // The same phone twice is refused by the server.
  const duplicate = await addGuest(page, 'Twin', '0505550199')
  await expect(
    duplicate.getByText(
      'Another guest in this event already has this phone number.',
    ),
  ).toBeVisible()
  await duplicate.getByRole('button', { name: 'Cancel' }).click()

  // Deleted guests leave the list...
  await page
    .getByRole('button', { name: /^Edit Zohar/ })
    .first()
    .click()
  await page.getByRole('button', { name: 'Delete Guest' }).click()
  await page
    .getByRole('dialog', { name: 'Delete Guest' })
    .getByRole('button', { name: 'Delete' })
    .click()
  await expect(figure(page, 'Guest figures', 'Total Guests')).toHaveText('0')

  // ...and come back when a file has their phone again.
  await page.getByRole('button', { name: 'Import Guests' }).click()
  const dialog = page.getByRole('dialog', { name: 'Import guests' })
  await dialog.getByLabel('Choose a CSV or Excel file').setInputFiles({
    name: 'list.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(
      'First Name,Last Name,Phone,Attendees\r\nZohar,Back,050-555-0199,2\r\nNoa,New,050-555-0201,3\r\nBad,Row,123,2\r\n',
    ),
  })
  await expect(dialog.getByText(/^list\.csv: 4 rows\./)).toBeVisible()
  await dialog.getByRole('button', { name: 'Preview' }).click()
  await dialog.getByRole('button', { name: 'Import 2 guests' }).click()
  await expect(
    dialog.getByText('1 guests added, 1 restored, 1 rows skipped.'),
  ).toBeVisible()
  await dialog.getByRole('button', { name: 'Done' }).click()
  await expect(figure(page, 'Guest figures', 'Total Guests')).toHaveText('2')

  // The server writes the files, in CSV and Excel.
  const csv = await download(page, async () => {
    await page.getByRole('button', { name: 'Export', exact: true }).click()
    await page.getByRole('menuitem', { name: 'CSV file (.csv)' }).click()
  })
  expect(csv.suggestedFilename()).toBe('Spring Picnic - guests.csv')
  const lines = await csvRows(csv)
  expect(lines[0]).toBe(
    'First Name,Last Name,Invitation Name,Phone,Expected Attendees,Confirmed Attendees,RSVP Status,Invitations Sent,Table,Group',
  )
  expect(lines.slice(1).sort()).toEqual([
    'Noa,New,,050-555-0201,3,,Not Sent,0,,',
    'Zohar,Back,,050-555-0199,2,,Not Sent,0,,',
  ])
  const xlsx = await download(page, async () => {
    await page.getByRole('button', { name: 'Export', exact: true }).click()
    await page.getByRole('menuitem', { name: 'Excel file (.xlsx)' }).click()
  })
  const sheet = await readSheet(await xlsx.path())
  expect(sheet).toHaveLength(3)
  expect(typeof sheet[1]?.[4]).toBe('number')
})

test('WhatsApp sends are counted per guest, and the Dashboard counts invited guests once', async ({
  page,
}) => {
  const openedLinks = await captureOpenedLinks(page)
  await signUpByApi(page, 'Olive Owner')
  const event = await createEventByApi(page)
  await addGuestByApi(page, event.id, {
    firstName: 'Dana',
    lastName: 'Lev',
    phone: '0521234567',
  })
  await addGuestByApi(page, event.id, {
    firstName: 'Eli',
    lastName: 'Cohen',
    phone: '0527654321',
  })
  await page.goto(`/events/${event.id}/guests`)

  for (const name of ['Dana Lev', 'Dana Lev', 'Eli Cohen']) {
    await page
      .getByRole('button', { name: `Send a WhatsApp message to ${name}` })
      .first()
      .click()
    const send = page.getByRole('dialog', { name: 'Send WhatsApp message' })
    await send.getByRole('button', { name: 'Open WhatsApp' }).click()
    await expect(send).toBeHidden()
  }
  // Each link was opened by the click, not by the page on its own.
  expect(await openedLinks()).toHaveLength(3)

  const guests = (await (
    await page.request.get(`/api/events/${event.id}/guests`)
  ).json()) as { firstName: string; invitationSentCount: number }[]
  expect(
    Object.fromEntries(
      guests.map((guest) => [guest.firstName, guest.invitationSentCount]),
    ),
  ).toEqual({ Dana: 2, Eli: 1 })

  await page.goto(`/events/${event.id}/dashboard`)
  await expect(figure(page, 'Key figures', 'Invitations Sent')).toHaveText('2')
})

test('the public page takes known and unknown answers within the allowance', async ({
  page,
  browser,
  isMobile,
}) => {
  await signUpByApi(page, 'Olive Owner')
  const event = await createEventByApi(page, { name: 'Summer Wedding' })
  for (const [firstName, phone] of [
    ['Dana', '0521111111'],
    ['Eli', '0522222222'],
    ['Gal', '0523333333'],
  ] as const) {
    await addGuestByApi(page, event.id, {
      firstName,
      phone,
      allowedAttendees: 2,
    })
  }

  // Guests answer from their own phones, signed out.
  const context = await browser.newContext()
  const guest = await context.newPage()
  const answer = async (
    name: string,
    phone: string,
    button: string,
    attendees?: string,
  ) => {
    await guest.goto(`/rsvp/${event.rsvpSlug}`)
    await guest.getByRole('textbox', { name: 'Full Name' }).fill(name)
    await guest.getByRole('textbox', { name: 'Phone Number' }).fill(phone)
    if (attendees) {
      await chooseOption(
        guest.getByRole('combobox', { name: 'Number of Attendees' }),
        attendees,
      )
    }
    await guest.getByRole('button', { name: button }).click()
  }
  await answer('Dana', '052-111-1111', "I'll be there!", '2')
  await expect(guest.getByText('Attendees confirmed: 2')).toBeVisible()
  // The form asks how many come whatever the answer.
  await answer('Eli', '0522222222', 'Not sure yet', '1')
  await expect(
    guest.getByText('No worries! Please let us know if anything changes.'),
  ).toBeVisible()
  await answer('Gal', '0523333333', "I won't be able to attend", '1')
  await expect(
    guest.getByText('Thank you for letting us know. We will miss you!'),
  ).toBeVisible()
  // The page offers up to the event's Maximum Attendees per Guest (2), and
  // the server refuses more (D104).
  await guest.goto(`/rsvp/${event.rsvpSlug}`)
  await guest.getByRole('combobox', { name: 'Number of Attendees' }).click()
  await expect(guest.getByRole('option', { name: /^\d+$/ })).toHaveText([
    '1',
    '2',
  ])
  await guest.keyboard.press('Escape')
  const over = await answerRsvpByApi(guest, event.rsvpSlug, {
    name: 'Gal',
    phone: '0523333333',
    status: 'APPROVED',
    attendees: 5,
  })
  expect(await over.json()).toMatchObject({ code: 'INVALID_ATTENDEE_COUNT' })
  // A phone not on the list waits for the organizer's review.
  await answer('Stranger', '0529999999', "I'll be there!", '2')
  await expect(guest.getByText('Attendees confirmed: 2')).toBeVisible()
  await context.close()

  await page.goto(`/events/${event.id}/dashboard`)
  await expect(figure(page, 'Key figures', 'Confirmed Attendees')).toHaveText(
    '2',
  )

  await page.goto(`/events/${event.id}/guests?tab=unknown`)
  const pending = isMobile
    ? page.getByRole('list', { name: 'Awaiting review' })
    : page.getByRole('table', { name: 'Awaiting review' })
  await expect(pending.getByText('Stranger')).toBeVisible()
  await pending.getByRole('button', { name: 'Reject' }).click()
  await page.getByRole('tab', { name: /^Rejected/ }).click()
  await page.getByRole('button', { name: 'Restore' }).click()
  await page.getByRole('tab', { name: /^Awaiting review/ }).click()
  await pending.getByRole('button', { name: 'Add as guest' }).click()
  const add = page.getByRole('dialog', { name: 'Add as guest' })
  await add.getByRole('button', { name: 'Add as guest' }).click()
  await expect(
    page.getByText('The response was added as a guest.'),
  ).toBeVisible()

  await page.goto(`/events/${event.id}/dashboard`)
  await expect(figure(page, 'Key figures', 'Confirmed Attendees')).toHaveText(
    '4',
  )
})

test('only approved guests are seated, a full table refuses more, and a changed answer is reflected', async ({
  page,
}) => {
  await signUpByApi(page, 'Olive Owner')
  // A party grows to 3 below: the maximum per guest allows it (D104).
  const event = await createEventByApi(page, { defaultAllowedAttendees: 3 })
  const api = (path: string) => `/api/events/${event.id}${path}`
  const table = (await (
    await page.request.post(api('/tables'), {
      data: { number: 1, capacity: 2, shape: 'CIRCLE' },
    })
  ).json()) as { id: string }
  const dana = await addGuestByApi(page, event.id, {
    firstName: 'Dana',
    phone: '0521111111',
    allowedAttendees: 3,
  })
  const eli = await addGuestByApi(page, event.id, {
    firstName: 'Eli',
    phone: '0522222222',
  })
  const seat = (guestId: string) =>
    page.request.put(api(`/guests/${guestId}/table`), {
      data: { tableId: table.id },
    })

  // A guest who has not approved cannot be seated.
  expect(await (await seat(eli.id)).json()).toMatchObject({
    code: 'GUEST_NOT_APPROVED',
  })
  await answerRsvpByApi(page, event.rsvpSlug, {
    name: 'Dana',
    phone: '0521111111',
    status: 'APPROVED',
    attendees: 2,
  })
  await answerRsvpByApi(page, event.rsvpSlug, {
    name: 'Eli',
    phone: '0522222222',
    status: 'APPROVED',
    attendees: 1,
  })
  expect((await seat(dana.id)).ok()).toBe(true)
  // The table's two chairs are taken.
  expect(await (await seat(eli.id)).json()).toMatchObject({
    code: 'TABLE_FULL',
  })

  // Dana now brings three: the table is over capacity, and both pages say so.
  await answerRsvpByApi(page, event.rsvpSlug, {
    name: 'Dana',
    phone: '0521111111',
    status: 'APPROVED',
    attendees: 3,
  })
  await page.goto(`/events/${event.id}/layout`)
  await expect(page.getByText('Over Capacity').first()).toBeVisible()
  await page.goto(`/events/${event.id}/dashboard`)
  await expect(page.getByRole('link', { name: /over capacity/i })).toBeVisible()

  // Declining takes Dana off the table.
  await answerRsvpByApi(page, event.rsvpSlug, {
    name: 'Dana',
    phone: '0521111111',
    status: 'DECLINED',
    attendees: 1,
  })
  const guests = (await (await page.request.get(api('/guests'))).json()) as {
    firstName: string
    tableId: string | null
  }[]
  expect(guests.find((guest) => guest.firstName === 'Dana')?.tableId).toBe(null)
  expect((await seat(eli.id)).ok()).toBe(true)
})
