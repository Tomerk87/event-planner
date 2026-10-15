import { Logger } from '@nestjs/common'
import { loadConfig } from '../config.ts'
import { createMailer, NullMailer, SmtpMailer } from './mailer.ts'
import * as emails from './templates.ts'

const base = {
  DATABASE_URL: 'postgresql://user:secret@localhost:5432/app',
  CORS_ORIGIN: 'http://localhost:5173',
}

describe('mailer', () => {
  it('is off unless SMTP is configured', () => {
    expect(createMailer(loadConfig(base).email)).toBeInstanceOf(NullMailer)
    expect(
      createMailer(
        loadConfig({
          ...base,
          EMAIL_MODE: 'smtp',
          SMTP_HOST: 'localhost',
          EMAIL_FROM: 'noreply@localhost',
        }).email,
      ),
    ).toBeInstanceOf(SmtpMailer)
  })

  it('logs only the kind of an email it does not send', async () => {
    const log = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => {})
    await new NullMailer().send({
      to: 'dana@example.com',
      kind: 'reset-password',
      subject: 'Reset',
      text: 'http://localhost/reset-password?token=secret',
      html: '',
    })
    expect(log).toHaveBeenCalledWith('Email is off; not sent: reset-password')
    expect(JSON.stringify(log.mock.calls)).not.toMatch(/dana|secret/)
    log.mockRestore()
  })
})

describe('email texts', () => {
  const invite = {
    inviter: 'Riley',
    event: 'Garden <Party>',
    role: 'ADMIN' as const,
    url: 'https://events.example.com/signup',
  }

  it.each(['en', 'he'] as const)(
    'are written in %s, left to right or right to left',
    (language) => {
      const all = [
        emails.verifyEmail(language, {
          name: 'Dana',
          url: 'https://x/v',
          hours: 24,
        }),
        emails.resetPassword(language, {
          name: 'Dana',
          url: 'https://x/r',
          minutes: 60,
        }),
        emails.invitation(language, invite),
        emails.accessGranted(language, invite),
        emails.testEmail(language, { url: 'https://x' }),
      ]
      for (const email of all) {
        expect(email.html).toContain(`lang="${language}"`)
        expect(email.html).toContain(
          `dir="${language === 'he' ? 'rtl' : 'ltr'}"`,
        )
        expect(email.subject.length).toBeGreaterThan(5)
        expect(email.text).toMatch(/https:\/\/x|events\.example\.com/)
      }
      expect(all.map((email) => email.kind)).toEqual([
        'verify-email',
        'reset-password',
        'invitation',
        'access-granted',
        'test',
      ])
    },
  )

  it('names the role and escapes typed values in the HTML only', () => {
    const en = emails.invitation('en', invite)
    expect(en.text).toContain(
      'Riley invited you to the event "Garden <Party>" as Admin.',
    )
    expect(en.html).toContain('Garden &lt;Party&gt;')
    expect(en.html).not.toContain('<Party>')
    expect(emails.invitation('he', invite).text).toContain('בהרשאת מנהל')
  })
})
