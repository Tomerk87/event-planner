import { AxeBuilder } from '@axe-core/playwright'
import { expect, test, type Browser, type Page } from '@playwright/test'
import { TEST_PASSWORD, uniqueEmail } from './helpers.ts'
import { createEventByApi, makeSuperUser } from './realApi.ts'

/**
 * Email on (D88): real emails, caught by Mailpit (backend
 * docker-compose.dev.yml). Runs in the "email" project only, against a
 * server started with EMAIL_MODE=smtp.
 */

/** As the page writes an address inside a sentence. */
const ltr = (value: string) => `\u2066${value}\u2069`

const MAILPIT = 'http://localhost:8025/api/v1'

interface MailpitMessage {
  ID: string
  Subject: string
}

/** The newest email to an address whose subject matches, once it arrives. */
async function emailTo(
  page: Page,
  address: string,
  subject: RegExp,
): Promise<{ subject: string; text: string }> {
  let found: MailpitMessage | undefined
  await expect
    .poll(
      async () => {
        const response = await page.request.get(
          `${MAILPIT}/search?query=${encodeURIComponent(`to:"${address}"`)}`,
        )
        const { messages } = (await response.json()) as {
          messages: MailpitMessage[]
        }
        found = messages.find((message) => subject.test(message.Subject))
        return found !== undefined
      },
      { message: `an email to ${address} matching ${subject}` },
    )
    .toBe(true)
  const message = (await (
    await page.request.get(`${MAILPIT}/message/${found!.ID}`)
  ).json()) as { Subject: string; Text: string }
  return { subject: message.Subject, text: message.Text }
}

/** The address of the link in an email, within this application. */
function linkIn(text: string, path: string): string {
  const match = text.match(new RegExp(`https?://[^\\s]+${path}[^\\s]*`))
  if (!match) {
    throw new Error(`No ${path} link in: ${text}`)
  }
  const url = new URL(match[0])
  return `${url.pathname}${url.search}`
}

async function signUp(page: Page, name: string, email: string) {
  await page.goto('/signup')
  await page.getByLabel(/Full name/).fill(name)
  await page.getByLabel(/Email/).fill(email)
  await page.getByLabel(/Password/).fill(TEST_PASSWORD)
  await page.getByRole('button', { name: 'Sign Up' }).click()
  await expect(page).toHaveURL(/\/events$/)
}

async function verify(page: Page, email: string) {
  const { text } = await emailTo(page, email, /Verify your email/)
  await page.goto(linkIn(text, '/verify-email'))
  await expect(page.getByText('Your email is verified')).toBeVisible()
}

async function inNewBrowser(browser: Browser) {
  const context = await browser.newContext()
  return { page: await context.newPage(), close: () => context.close() }
}

test.beforeAll(async ({ request }) => {
  const mailpit = await request.get(`${MAILPIT}/info`).catch(() => null)
  if (!mailpit?.ok()) {
    throw new Error(
      'Mailpit is not running: start it with `npm run db:up` in backend/',
    )
  }
})

test('a new account verifies its email from the emailed link', async ({
  page,
}) => {
  const email = uniqueEmail('riley')
  await signUp(page, 'Riley Stone', email)

  const notice = page.getByText('Verify your email')
  await expect(notice).toBeVisible()
  await page.getByRole('button', { name: 'Resend Email' }).click()
  await expect(
    page.getByText('We sent a new verification email.'),
  ).toBeVisible()

  await verify(page, email)
  await page.getByRole('link', { name: 'Go to My Events' }).click()
  await expect(page.getByText('No events yet')).toBeVisible()
  await expect(notice).toHaveCount(0)
})

test('an invitation is emailed, and gives access only once the email is verified', async ({
  page,
  browser,
}) => {
  const owner = uniqueEmail('owner')
  await signUp(page, 'Olive Owner', owner)
  await verify(page, owner)
  const event = await createEventByApi(page, { name: 'Emailed Gala' })

  const invited = uniqueEmail('ada')
  await page.goto(`/events/${event.id}/permissions`)
  const invite = page.getByRole('button', { name: 'Invite User' })
  await expect(invite).toBeEnabled()
  await invite.click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByText(/gets an invitation email/)).toBeVisible()
  await dialog.getByLabel('Email').fill(invited)
  await dialog.getByRole('button', { name: 'Invite', exact: true }).click()
  await expect(
    page.getByText(`${ltr(invited)} was invited by email`),
  ).toBeVisible()
  const invitation = await emailTo(page, invited, /invited to "Emailed Gala"/)
  expect(invitation.text).toContain('Olive Owner invited you to collaborate')
  const accept = linkIn(invitation.text, '/signup')
  expect(accept).toBe(`/signup?email=${encodeURIComponent(invited)}`)

  // Sent again on request.
  await page
    .getByRole('button', { name: `Email the invitation to ${invited} again` })
    .first()
    .click()
  await expect(
    page.getByText(`The invitation was emailed again to ${ltr(invited)}.`),
  ).toBeVisible()

  // Signing up is not enough; verifying the email is.
  // Accepting opens the sign-up form with the invited address filled in.
  const guest = await inNewBrowser(browser)
  await guest.page.goto(accept)
  await expect(guest.page.getByLabel(/Email/)).toHaveValue(invited)
  await guest.page.getByLabel(/Full name/).fill('Ada Admin')
  await guest.page.getByLabel(/Password/).fill(TEST_PASSWORD)
  await guest.page.getByRole('button', { name: 'Sign Up' }).click()
  await expect(guest.page).toHaveURL(/\/events$/)
  await expect(guest.page.getByText('No events yet')).toBeVisible()
  await verify(guest.page, invited)
  await guest.page.goto('/events')
  await expect(guest.page.getByText('Emailed Gala')).toBeVisible()
  await guest.close()
})

test('a forgotten password is reset from the emailed link, ending every session', async ({
  page,
  browser,
}) => {
  const email = uniqueEmail('dana')
  await signUp(page, 'Dana Lev', email)

  const other = await inNewBrowser(browser)
  await other.page.goto('/signin')
  await other.page.getByRole('link', { name: 'Forgot password?' }).click()
  await expect(
    other.page.getByRole('heading', { name: 'Reset your password' }),
  ).toBeVisible()
  await other.page.getByLabel(/Email/).fill(email)
  await other.page.getByRole('button', { name: 'Send Reset Link' }).click()
  await expect(other.page.getByText('Check your inbox')).toBeVisible()

  const { text } = await emailTo(other.page, email, /Reset your/)
  await other.page.goto(linkIn(text, '/reset-password'))
  await other.page.getByLabel(/New password/).fill('a-brand-new-password')
  await other.page.getByRole('button', { name: 'Save Password' }).click()
  await expect(
    other.page.getByText(
      'Your password was changed. Sign in with the new password.',
    ),
  ).toBeVisible()
  await other.page.getByLabel(/Email/).fill(email)
  await other.page.getByLabel(/Password/).fill('a-brand-new-password')
  await other.page.getByRole('button', { name: 'Sign In' }).click()
  await expect(other.page).toHaveURL(/\/events$/)
  await other.close()

  // The first browser's session ended with the reset.
  await page.reload()
  await expect(page).toHaveURL(/\/$/)
})

test('a Super User sees the email settings and sends a test email', async ({
  page,
}) => {
  const email = uniqueEmail('admin')
  await signUp(page, 'Sam Super', email)
  makeSuperUser(email)
  await page.reload()

  await page.getByRole('link', { name: 'System' }).click()
  await expect(page.getByText('On: emails are sent')).toBeVisible()
  await expect(page.getByText('localhost:1025')).toBeVisible()
  await page.getByRole('button', { name: 'Send a Test Email' }).click()
  await expect(
    page.getByText(`A test email was sent to ${ltr(email)}.`),
  ).toBeVisible()
  await emailTo(page, email, /Test email/)
})

for (const language of ['en', 'he'] as const) {
  for (const width of [1280, 390]) {
    test(`the email pages pass the accessibility check in ${language} at ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 })
      await page.addInitScript((value) => {
        window.localStorage.setItem('event-planner.language', value)
      }, language)
      const check = async (path: string) => {
        await page.goto(path)
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
        await expect(page.getByRole('status')).toHaveCount(0)
        const results = await new AxeBuilder({ page }).analyze()
        expect(
          results.violations.map((violation) => ({
            path,
            rule: violation.id,
            elements: violation.nodes.map((node) => node.target.join(' ')),
          })),
        ).toEqual([])
        expect(
          await page.evaluate(
            () =>
              document.documentElement.scrollWidth -
              document.documentElement.clientWidth,
          ),
        ).toBe(0)
      }
      await check('/forgot-password')
      await check('/reset-password?token=made-up')
      await check('/verify-email?token=made-up')

      const email = uniqueEmail('sam')
      await page.request.post('/api/auth/sign-up', {
        data: { name: 'Sam Super', email, password: TEST_PASSWORD },
      })
      makeSuperUser(email)
      // The verification notice, and the System page.
      await check('/events')
      await check('/system')
    })
  }
}
