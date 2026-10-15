import { expect, test, type Browser, type Page } from '@playwright/test'
import { isolate } from '../src/shared/ltr.ts'
import { chooseOption } from './helpers.ts'
import {
  addGuestByApi,
  createEventByApi,
  inviteByApi,
  makePast,
  signUpByApi,
} from './realApi.ts'

/**
 * Real accounts: inviting with roles, what each role may do in the pages,
 * and the server refusing what a role may not do, whatever the page shows.
 */

/** Another person, in a browser of their own. */
async function anotherPerson(browser: Browser, name: string) {
  const context = await browser.newContext()
  const page = await context.newPage()
  const account = await signUpByApi(page, name)
  return { page, account, close: () => context.close() }
}

function memberList(page: Page, isMobile: boolean) {
  return isMobile
    ? page.getByRole('list', { name: 'Event members' })
    : page.getByRole('table', { name: 'Event members' })
}

function entry(page: Page, isMobile: boolean, text: string) {
  return memberList(page, isMobile)
    .getByRole(isMobile ? 'listitem' : 'row')
    .filter({ hasText: text })
}

/** Downloads the seating list as CSV; returns the file's name. */
async function seatingDownload(page: Page): Promise<string> {
  const [file] = await Promise.all([
    page.waitForEvent('download'),
    (async () => {
      await page.getByRole('button', { name: 'Export Tables' }).click()
      await page.getByRole('menuitem', { name: 'CSV file (.csv)' }).click()
    })(),
  ])
  return file.suggestedFilename()
}

async function invite(page: Page, email: string, role: string) {
  const button = page.getByRole('button', { name: 'Invite User' })
  await expect(button).toBeEnabled()
  await button.click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Email').fill(email)
  await chooseOption(
    dialog.getByRole('combobox', { name: 'Permission Type' }),
    role,
  )
  await dialog.getByRole('button', { name: 'Invite', exact: true }).click()
  await expect(dialog).toBeHidden()
}

test('an Owner invites by role; an invitation becomes access at sign-up', async ({
  page,
  browser,
  isMobile,
}) => {
  await signUpByApi(page, 'Olive Owner')
  const event = await createEventByApi(page, { name: 'Board Meeting' })
  const viewer = await anotherPerson(browser, 'Vera Viewer')

  await page.goto(`/events/${event.id}/permissions`)
  // An existing account is a member at once.
  await invite(page, viewer.account.email, 'VIEWER')
  await expect(entry(page, isMobile, 'Vera Viewer')).toContainText('Viewer')
  // An email with no account waits.
  const adminEmail = `admin.${Date.now()}.${Math.random().toString(36).slice(2, 6)}@example.com`
  await invite(page, adminEmail, 'ADMIN')
  await expect(entry(page, isMobile, adminEmail)).toContainText('Pending')

  // Signing up with that email turns the invitation into access.
  const adminContext = await browser.newContext()
  const admin = await adminContext.newPage()
  await admin.goto('/signup')
  await admin.getByLabel(/Full name/).fill('Ada Admin')
  await admin.getByLabel(/Email/).fill(adminEmail)
  await admin.getByLabel(/Password/).fill('correct-horse-battery')
  await admin.getByRole('button', { name: 'Sign Up' }).click()
  await expect(admin.getByText('Board Meeting')).toBeVisible()
  await admin.goto(`/events/${event.id}/permissions`)
  await expect(entry(admin, isMobile, 'Ada Admin')).toContainText('Admin')
  await adminContext.close()

  await page.reload()
  await expect(entry(page, isMobile, 'Ada Admin')).toContainText('Admin')
  await expect(entry(page, isMobile, 'Pending')).toHaveCount(0)

  // The bell tells the invited person, and leads to the event (D95).
  await viewer.page.goto('/events')
  await viewer.page
    .getByRole('button', { name: 'Notifications, 1 unread' })
    .click()
  await viewer.page
    .getByRole('link', {
      name: `${isolate('Olive Owner')} gave you Viewer access to ${isolate('Board Meeting')}.`,
    })
    .click()
  await expect(viewer.page).toHaveURL(
    new RegExp(`/events/${event.id}/dashboard$`),
  )
  await expect(
    viewer.page.getByRole('button', { name: 'Notifications', exact: true }),
  ).toBeVisible()
  await viewer.close()
})

test('each role may do what the pages offer, and the server refuses the rest', async ({
  page,
  browser,
}) => {
  const owner = await signUpByApi(page, 'Olive Owner')
  const event = await createEventByApi(page)
  const guest = await addGuestByApi(page, event.id, {
    firstName: 'Dana',
    phone: '0521234567',
  })
  const admin = await anotherPerson(browser, 'Ada Admin')
  const viewer = await anotherPerson(browser, 'Vera Viewer')
  const outsider = await anotherPerson(browser, 'Oscar Outsider')
  await inviteByApi(page, event.id, admin.account.email, 'ADMIN')
  await inviteByApi(page, event.id, viewer.account.email, 'VIEWER')

  // A Viewer sees the guests without a way to change them...
  await viewer.page.goto(`/events/${event.id}/guests`)
  await expect(viewer.page.getByText('View-only access')).toBeVisible()
  await expect(
    viewer.page.getByRole('button', { name: 'Add Guest' }),
  ).toHaveCount(0)
  // ...and the server refuses the change all the same.
  const viewerAdd = await viewer.page.request.post(
    `/api/events/${event.id}/guests`,
    {
      data: {
        firstName: 'X',
        lastName: '',
        phone: '0529999999',
        allowedAttendees: 1,
      },
    },
  )
  expect(viewerAdd.status()).toBe(403)
  expect(await viewerAdd.json()).toMatchObject({ code: 'FORBIDDEN' })
  expect(
    (
      await viewer.page.request.post(
        `/api/events/${event.id}/permissions/invitations`,
        { data: { email: 'x@example.com', role: 'VIEWER' } },
      )
    ).status(),
  ).toBe(403)
  // Exports stay open to a Viewer.
  await viewer.page.goto(`/events/${event.id}/layout`)
  await expect(seatingDownload(viewer.page)).resolves.toMatch(/\.csv$/)

  // An Admin changes guests but not the Owner, nor deletes the event.
  expect(
    (
      await admin.page.request.put(
        `/api/events/${event.id}/guests/${guest.id}`,
        {
          data: {
            firstName: 'Dana',
            lastName: 'Lev',
            phone: '0521234567',
            allowedAttendees: 3,
          },
        },
      )
    ).ok(),
  ).toBe(true)
  expect(
    (
      await admin.page.request.put(
        `/api/events/${event.id}/permissions/members/${owner.id}`,
        { data: { role: 'VIEWER' } },
      )
    ).status(),
  ).toBe(403)
  expect(
    (await admin.page.request.delete(`/api/events/${event.id}`)).status(),
  ).toBe(403)

  // Someone with no role does not even learn the event exists.
  await outsider.page.goto(`/events/${event.id}/dashboard`)
  await expect(
    outsider.page.getByRole('heading', { name: 'Page not found' }),
  ).toBeVisible()
  const hidden = await outsider.page.request.get(`/api/events/${event.id}`)
  expect(hidden.status()).toBe(404)
  // Nor does anyone signed out.
  const context = await browser.newContext()
  expect(
    (
      await context.request.get(`http://localhost:5174/api/events/${event.id}`)
    ).status(),
  ).toBe(401)
  await context.close()

  // The last Owner cannot leave the event without one.
  const self = await page.request.delete(
    `/api/events/${event.id}/permissions/members/${owner.id}`,
  )
  expect(self.status()).toBe(409)

  await Promise.all([admin.close(), viewer.close(), outsider.close()])
})

test('a past event is read-only, and its data can still be viewed and exported', async ({
  page,
}) => {
  await signUpByApi(page, 'Olive Owner')
  const event = await createEventByApi(page, { name: 'Last Year' })
  await addGuestByApi(page, event.id, {
    firstName: 'Dana',
    phone: '0521234567',
  })
  makePast(event.id)

  await page.goto(`/events/${event.id}/guests`)
  await expect(page.getByText('This event has ended')).toBeVisible()
  await expect(page.getByText('Dana').first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Add Guest' })).toHaveCount(0)
  const refused = await page.request.post(`/api/events/${event.id}/guests`, {
    data: {
      firstName: 'Late',
      lastName: '',
      phone: '0529999999',
      allowedAttendees: 1,
    },
  })
  expect(await refused.json()).toMatchObject({ code: 'EVENT_READ_ONLY' })

  // The seating list still downloads.
  await page.goto(`/events/${event.id}/layout`)
  expect(await seatingDownload(page)).toMatch(/Last Year.*\.csv$/)

  // The public page is closed.
  await page.goto(`/rsvp/${event.rsvpSlug}`)
  await expect(page.getByText('RSVP is closed')).toBeVisible()
})
