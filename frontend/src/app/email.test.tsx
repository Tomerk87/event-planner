import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { changeLanguage } from '../i18n/i18n.ts'
import {
  createFakeAccountBackend,
  VALID_TOKEN,
  type FakeEmail,
} from '../test/fakeAccountBackend.ts'
import { ltr } from '../shared/ltr.ts'
import { change } from '../test/controls.ts'
import { createTestBackend, renderApp } from '../test/renderApp.tsx'

/** Email on the server (D88): its pages, notices and actions. */

function emailOn(overrides: Partial<FakeEmail> = {}): FakeEmail {
  return { verified: false, calls: [], ...overrides }
}

async function setUp(
  options: { email?: FakeEmail; signedIn?: boolean; superUser?: boolean } = {},
) {
  const accounts = createFakeAccountBackend({ email: options.email })
  const backend = createTestBackend({ session: 'none', accounts })
  if (options.signedIn) {
    await backend.auth.signUp({
      name: 'Riley Stone',
      email: 'riley@example.com',
      password: 'long-enough',
    })
  }
  if (options.superUser) {
    accounts.makeSuperUser('riley@example.com')
  }
  return { accounts, backend }
}

function fill(label: RegExp | string, value: string) {
  change(screen.getByLabelText(label), { target: { value } })
}

describe('email off (the default)', () => {
  it('offers no Forgot password, no notice and no resend', async () => {
    const { backend } = await setUp({ signedIn: false })
    renderApp('/signin', undefined, { backend })

    await screen.findByRole('heading', { level: 1, name: 'Sign in' })
    expect(screen.queryByRole('link', { name: 'Forgot password?' })).toBeNull()
  })

  it('sends the Forgot password address back to Sign In', async () => {
    const { backend } = await setUp()
    const { router } = renderApp('/forgot-password', undefined, { backend })

    await screen.findByRole('heading', { level: 1, name: 'Sign in' })
    expect(router.state.location.pathname).toBe('/signin')
  })

  it('shows no verification notice to an account', async () => {
    const { backend } = await setUp({ signedIn: true })
    renderApp('/events', undefined, { backend })

    await screen.findByText('No events yet')
    expect(screen.queryByText('Verify your email')).toBeNull()
  })
})

describe('forgot and reset password', () => {
  it('asks for a link and confirms without saying whether the account exists', async () => {
    const email = emailOn()
    const { backend } = await setUp({ email })
    renderApp('/signin', undefined, { backend })

    fireEvent.click(
      await screen.findByRole('link', { name: 'Forgot password?' }),
    )
    await screen.findByRole('heading', {
      level: 1,
      name: 'Reset your password',
    })
    fill(/Email/, 'not-an-email')
    fireEvent.click(screen.getByRole('button', { name: 'Send Reset Link' }))
    expect(
      await screen.findByText('Enter a valid email address.'),
    ).toBeInTheDocument()

    fill(/Email/, ' Dana@Example.com ')
    fireEvent.click(screen.getByRole('button', { name: 'Send Reset Link' }))

    expect(await screen.findByText('Check your inbox')).toBeInTheDocument()
    expect(
      screen.getByText(`If an account exists for ${ltr('dana@example.com')}`, {
        exact: false,
      }),
    ).toBeInTheDocument()
    expect(email.calls).toEqual(['forgotPassword:dana@example.com'])
  })

  it('sets a new password from the link and continues to Sign In', async () => {
    const email = emailOn()
    const { backend } = await setUp({ email, signedIn: true })
    const { router } = renderApp(
      `/reset-password?token=${VALID_TOKEN}`,
      undefined,
      {
        backend,
      },
    )

    await screen.findByRole('heading', {
      level: 1,
      name: 'Choose a new password',
    })
    fill(/New password/, 'short')
    fireEvent.click(screen.getByRole('button', { name: 'Save Password' }))
    expect(
      await screen.findByText('Use at least 8 characters.'),
    ).toBeInTheDocument()

    fill(/New password/, 'battery-staple')
    fireEvent.click(screen.getByRole('button', { name: 'Save Password' }))

    expect(
      await screen.findByText(
        'Your password was changed. Sign in with the new password.',
      ),
    ).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/signin')
    expect(email.calls).toEqual(['resetPassword:battery-staple'])
  })

  it('explains an expired link and a missing one, and offers a new one', async () => {
    const { backend } = await setUp({ email: emailOn() })
    renderApp('/reset-password?token=old', undefined, { backend })

    await screen.findByLabelText(/New password/)
    fill(/New password/, 'battery-staple')
    fireEvent.click(screen.getByRole('button', { name: 'Save Password' }))

    expect(
      await screen.findByText('This link has expired or was already used.'),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Ask for a new link' }),
    ).toHaveAttribute('href', '/forgot-password')
  })

  it('says a link without its token is incomplete', async () => {
    const { backend } = await setUp({ email: emailOn() })
    renderApp('/reset-password', undefined, { backend })

    expect(
      await screen.findByText(/This link is incomplete/),
    ).toBeInTheDocument()
  })
})

describe('email verification (D89)', () => {
  it('asks a new account to verify, and sends the email again on request', async () => {
    const email = emailOn()
    const { backend } = await setUp({ email, signedIn: true })
    renderApp('/events', undefined, { backend })

    expect(await screen.findByText('Verify your email')).toBeInTheDocument()
    expect(
      screen.getByText(`We sent a link to ${ltr('riley@example.com')}`, {
        exact: false,
      }),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Resend Email' }))

    expect(
      await screen.findByText('We sent a new verification email.'),
    ).toBeInTheDocument()
    expect(email.calls).toEqual(['resendVerification'])
  })

  it('verifies from the link once, and the notice goes away', async () => {
    const email = emailOn()
    const { backend } = await setUp({ email, signedIn: true })
    renderApp(`/verify-email?token=${VALID_TOKEN}`, undefined, { backend })

    expect(
      await screen.findByText('Your email is verified'),
    ).toBeInTheDocument()
    expect(email.calls).toEqual(['verifyEmail'])
    fireEvent.click(screen.getByRole('link', { name: 'Go to My Events' }))

    await screen.findByText('No events yet')
    expect(screen.queryByText('Verify your email')).toBeNull()
  })

  it('explains a used link and offers a new one when signed in', async () => {
    const email = emailOn()
    const { backend } = await setUp({ email, signedIn: true })
    renderApp('/verify-email?token=used', undefined, { backend })

    expect(
      await screen.findByText("We couldn't verify your email"),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Send a New Link' }))

    await waitFor(() => expect(email.calls).toEqual(['resendVerification']))
  })

  it('asks a signed-out visitor to sign in for a new link', async () => {
    const { backend } = await setUp({ email: emailOn() })
    renderApp('/verify-email', undefined, { backend })

    expect(
      await screen.findByText('Sign in to ask for a new verification email.'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Send a New Link' })).toBeNull()
  })

  it('never asks the demo to verify anything', async () => {
    const accounts = createFakeAccountBackend({ email: emailOn() })
    renderApp('/events', undefined, {
      backend: createTestBackend({ accounts }),
    })

    await screen.findByRole('heading', { level: 1, name: 'My Events' })
    expect(screen.queryByText('Verify your email')).toBeNull()
  })
})

describe('invitation emails (D90)', () => {
  it('says the invitation is emailed, and emails a pending one again', async () => {
    const email = emailOn({ verified: true })
    const { backend } = await setUp({ email, signedIn: true })
    const event = await backend
      .servicesFor((await backend.auth.getSession())!)
      .events.create({
        name: 'Garden Party',
        startsAt: '2031-02-02T16:00:00.000Z',
        timeZone: 'Asia/Jerusalem',
        maxAttendees: 100,
        defaultAllowedAttendees: 2,
        rsvpLanguage: 'en',
        country: 'IL',
        location: null,
        rsvpTitle: null,
        coverImage: null,
      })
    renderApp(`/events/${event.id}/permissions`, undefined, { backend })
    // Invite opens once the list has loaded.
    await waitFor(() =>
      expect(
        screen.getAllByRole('button', { name: 'Invite User' })[0],
      ).toBeEnabled(),
    )

    fireEvent.click(
      (await screen.findAllByRole('button', { name: 'Invite User' }))[0]!,
    )
    const dialog = await screen.findByRole('dialog')
    expect(
      within(dialog).getByText(/gets an invitation email/),
    ).toBeInTheDocument()
    change(within(dialog).getByLabelText(/Email/), {
      target: { value: 'new@example.com' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Invite' }))
    expect(
      await screen.findByText(
        `${ltr('new@example.com')} was invited by email and will get access after signing up.`,
      ),
    ).toBeInTheDocument()

    const [resend] = await screen.findAllByRole('button', {
      name: 'Email the invitation to new@example.com again',
    })
    fireEvent.click(resend!)

    expect(
      await screen.findByText(
        `The invitation was emailed again to ${ltr('new@example.com')}.`,
      ),
    ).toBeInTheDocument()
    expect(email.calls).toEqual([expect.stringMatching(/^resendInvitation:/)])
  })
})

describe('System page (D91)', () => {
  it('shows the email settings to a Super User and sends a test email', async () => {
    const email = emailOn({
      verified: true,
      status: {
        mode: 'smtp',
        host: 'email-smtp.eu-west-1.amazonaws.com',
        port: 587,
        from: 'Event Planner <noreply@example.com>',
        authenticated: true,
      },
    })
    const { backend } = await setUp({ email, signedIn: true, superUser: true })
    renderApp('/events', undefined, { backend })

    fireEvent.click(await screen.findByRole('link', { name: 'System' }))

    await screen.findByRole('heading', { level: 1, name: 'System' })
    expect(await screen.findByText('On: emails are sent')).toBeInTheDocument()
    expect(
      screen.getByText('email-smtp.eu-west-1.amazonaws.com:587'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Event Planner <noreply@example.com>'),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Send a Test Email' }))
    expect(
      await screen.findByText(
        `A test email was sent to ${ltr('riley@example.com')}.`,
      ),
    ).toBeInTheDocument()
  })

  it('explains email off, with the test disabled', async () => {
    const { backend } = await setUp({ signedIn: true, superUser: true })
    renderApp('/system', undefined, { backend })

    expect(
      await screen.findByText('Off: no emails are sent'),
    ).toBeInTheDocument()
    expect(screen.getByText(/set EMAIL_MODE=smtp/)).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Send a Test Email' }),
    ).toBeDisabled()
  })

  it('is not there for anyone else, nor in the demo', async () => {
    const { backend } = await setUp({ signedIn: true })
    renderApp('/system', undefined, { backend })

    expect(
      await screen.findByRole('heading', { name: 'Page not found' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'System' })).toBeNull()
  })

  it('is translated', async () => {
    await changeLanguage('he')
    try {
      const { backend } = await setUp({ signedIn: true, superUser: true })
      renderApp('/system', undefined, { backend })

      expect(
        await screen.findByText('כבוי: לא נשלחים אימיילים'),
      ).toBeInTheDocument()
    } finally {
      await changeLanguage('en')
    }
  })
})
