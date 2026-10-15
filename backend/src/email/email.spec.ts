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
    event: {
      name: 'Garden <Party>',
      // Late evening in Jerusalem is already the next day in UTC.
      startsAt: '2026-10-24T21:30:00.000Z',
      timeZone: 'Asia/Jerusalem',
    },
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
        emails.accessGranted(language, { ...invite, name: 'Dana' }),
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

  it('names the inviter, the role and the event day, and escapes typed values in the HTML only', () => {
    const en = emails.invitation('en', invite)
    expect(en.subject).toBe(
      'You\'re invited to "Garden <Party>" on Event Planner',
    )
    expect(en.text).toContain(
      'Riley invited you to collaborate on Garden <Party>.',
    )
    expect(en.text).toContain('Role: Admin')
    expect(en.text).toContain('Date: October 25, 2026')
    expect(en.text).toContain(
      'Accept Invitation: https://events.example.com/signup',
    )
    expect(en.html).toContain('Garden &lt;Party&gt;')
    expect(en.html).not.toContain('<Party>')

    const he = emails.invitation('he', invite)
    expect(he.text).toContain('הרשאה: מנהל')
    expect(he.text).toContain('תאריך: 25 באוקטובר 2026')
    // An English name keeps its direction inside a Hebrew sentence.
    expect(he.text).toContain('\u2068Garden <Party>\u2069')
  })

  it('greets by name only when the name is known', () => {
    expect(emails.invitation('en', invite).text).toMatch(/\n\nHi,\n\n/)
    expect(
      emails.accessGranted('en', { ...invite, name: 'Dana' }).text,
    ).toContain('Hi Dana,')
    expect(
      emails.verifyEmail('he', { name: 'Dana', url: 'https://x', hours: 24 })
        .text,
    ).toContain('שלום \u2068Dana\u2069,')
  })

  it('carries its pictures inside the email, each one the HTML shows', () => {
    const invitation = emails.invitation('en', invite)
    expect(invitation.images.map((image) => image.cid).sort()).toEqual([
      'date@event-planner',
      'envelope@event-planner',
      'lock@event-planner',
      'logo@event-planner',
      'role@event-planner',
    ])
    for (const image of invitation.images) {
      expect(invitation.html).toContain(`src="cid:${image.cid}"`)
      expect(Buffer.from(image.png, 'base64').subarray(1, 4).toString()).toBe(
        'PNG',
      )
    }
    const reset = emails.resetPassword('en', {
      name: 'Dana',
      url: 'https://x',
      minutes: 60,
    })
    expect(reset.images.map((image) => image.cid).sort()).toEqual([
      'lock@event-planner',
      'logo@event-planner',
    ])
  })

  it('points the button the way the language reads', () => {
    expect(emails.testEmail('en', { url: 'https://x' }).html).toContain(
      '&rarr;',
    )
    expect(emails.testEmail('he', { url: 'https://x' }).html).toContain(
      '&larr;',
    )
  })
})

describe('SMTP mailer', () => {
  it('sends the pictures as inline attachments', async () => {
    const mailer = new SmtpMailer(
      loadConfig({
        ...base,
        EMAIL_MODE: 'smtp',
        SMTP_HOST: 'localhost',
        EMAIL_FROM: 'noreply@localhost',
      }).email,
    )
    const sendMail = vi.fn().mockResolvedValue({})
    Object.assign(mailer, { transport: { sendMail } })
    await mailer.send({
      to: 'dana@example.com',
      ...emails.testEmail('en', { url: 'https://x' }),
    })
    const [mail] = sendMail.mock.calls[0] as [
      {
        from: string
        attachments: { cid: string; contentDisposition: string }[]
      },
    ]
    expect(mail.from).toBe('noreply@localhost')
    expect(mail.attachments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          cid: 'logo@event-planner',
          contentDisposition: 'inline',
        }),
      ]),
    )
  })
})
