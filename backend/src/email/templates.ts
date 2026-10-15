import type { RsvpLanguage } from '../domain/models.ts'
import type { EventRole } from '../domain/roles.ts'
import type { EmailMessage } from './mailer.ts'

/**
 * The emails the server sends, in English and Hebrew. Each one is plain text
 * plus a simple HTML version; the HTML escapes every value a person typed.
 */

export type EmailLanguage = RsvpLanguage

type Content = Omit<EmailMessage, 'to'>

const ROLE: Record<EmailLanguage, Record<EventRole, string>> = {
  en: { OWNER: 'Owner', ADMIN: 'Admin', VIEWER: 'Viewer' },
  he: { OWNER: 'בעלים', ADMIN: 'מנהל', VIEWER: 'צופה' },
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

interface Parts {
  kind: string
  subject: string
  /** Paragraphs before the button, as plain text. */
  lines: string[]
  link: { label: string; url: string }
  /** A paragraph after the button. */
  footer: string
}

function compose(language: EmailLanguage, parts: Parts): Content {
  const dir = language === 'he' ? 'rtl' : 'ltr'
  const text = [
    ...parts.lines,
    `${parts.link.label}: ${parts.link.url}`,
    parts.footer,
  ].join('\n\n')
  const paragraphs = parts.lines
    .map((line) => `<p>${escapeHtml(line)}</p>`)
    .join('\n')
  const html = `<!doctype html>
<html lang="${language}" dir="${dir}">
<body style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.5;">
${paragraphs}
<p><a href="${escapeHtml(parts.link.url)}" style="display: inline-block; padding: 10px 18px; background: #4f46e5; color: #ffffff; text-decoration: none; border-radius: 6px;">${escapeHtml(parts.link.label)}</a></p>
<p style="color: #6b7280; font-size: 13px;">${escapeHtml(parts.footer)}</p>
</body>
</html>`
  return { kind: parts.kind, subject: parts.subject, text, html }
}

export function verifyEmail(
  language: EmailLanguage,
  input: { name: string; url: string; hours: number },
): Content {
  return compose(
    language,
    language === 'he'
      ? {
          kind: 'verify-email',
          subject: 'אימות כתובת האימייל שלך ב-Event Planner',
          lines: [
            `שלום ${input.name},`,
            'כדי להשלים את ההרשמה, יש לאמת את כתובת האימייל שלך.',
          ],
          link: { label: 'אימות האימייל', url: input.url },
          footer: `הקישור תקף ל-${input.hours} שעות. אם לא נרשמת ל-Event Planner, אפשר להתעלם מהודעה זו.`,
        }
      : {
          kind: 'verify-email',
          subject: 'Verify your email for Event Planner',
          lines: [
            `Hello ${input.name},`,
            'To finish signing up, please verify your email address.',
          ],
          link: { label: 'Verify email', url: input.url },
          footer: `This link works for ${input.hours} hours. If you didn't sign up for Event Planner, you can ignore this email.`,
        },
  )
}

export function resetPassword(
  language: EmailLanguage,
  input: { name: string; url: string; minutes: number },
): Content {
  return compose(
    language,
    language === 'he'
      ? {
          kind: 'reset-password',
          subject: 'איפוס הסיסמה שלך ב-Event Planner',
          lines: [
            `שלום ${input.name},`,
            'התקבלה בקשה לאפס את הסיסמה של החשבון שלך.',
          ],
          link: { label: 'בחירת סיסמה חדשה', url: input.url },
          footer: `הקישור תקף ל-${input.minutes} דקות ולשימוש אחד. אם לא ביקשת לאפס את הסיסמה, אפשר להתעלם מהודעה זו; הסיסמה לא תשתנה.`,
        }
      : {
          kind: 'reset-password',
          subject: 'Reset your Event Planner password',
          lines: [
            `Hello ${input.name},`,
            'We received a request to reset the password of your account.',
          ],
          link: { label: 'Choose a new password', url: input.url },
          footer: `This link works for ${input.minutes} minutes, once. If you didn't ask to reset your password, you can ignore this email; your password stays the same.`,
        },
  )
}

export function invitation(
  language: EmailLanguage,
  input: { inviter: string; event: string; role: EventRole; url: string },
): Content {
  const role = ROLE[language][input.role]
  return compose(
    language,
    language === 'he'
      ? {
          kind: 'invitation',
          subject: `הוזמנת לאירוע "${input.event}" ב-Event Planner`,
          lines: [
            `${input.inviter} הזמין/ה אותך לאירוע "${input.event}" בהרשאת ${role}.`,
            'כדי לקבל גישה, יש להירשם ל-Event Planner עם כתובת האימייל הזו.',
          ],
          link: { label: 'הרשמה', url: input.url },
          footer: 'אם לא ציפית להזמנה הזו, אפשר להתעלם מהודעה זו.',
        }
      : {
          kind: 'invitation',
          subject: `You're invited to "${input.event}" on Event Planner`,
          lines: [
            `${input.inviter} invited you to the event "${input.event}" as ${role}.`,
            'To get access, sign up to Event Planner with this email address.',
          ],
          link: { label: 'Sign up', url: input.url },
          footer:
            "If you weren't expecting this invitation, you can ignore this email.",
        },
  )
}

export function accessGranted(
  language: EmailLanguage,
  input: { inviter: string; event: string; role: EventRole; url: string },
): Content {
  const role = ROLE[language][input.role]
  return compose(
    language,
    language === 'he'
      ? {
          kind: 'access-granted',
          subject: `קיבלת גישה לאירוע "${input.event}"`,
          lines: [
            `${input.inviter} נתן/ה לך גישה לאירוע "${input.event}" בהרשאת ${role}.`,
          ],
          link: { label: 'פתיחת האירוע', url: input.url },
          footer: 'האירוע מופיע עכשיו ברשימת האירועים שלך.',
        }
      : {
          kind: 'access-granted',
          subject: `You now have access to "${input.event}"`,
          lines: [
            `${input.inviter} gave you access to the event "${input.event}" as ${role}.`,
          ],
          link: { label: 'Open the event', url: input.url },
          footer: 'The event now appears in your list of events.',
        },
  )
}

export function testEmail(
  language: EmailLanguage,
  input: { url: string },
): Content {
  return compose(
    language,
    language === 'he'
      ? {
          kind: 'test',
          subject: 'אימייל בדיקה מ-Event Planner',
          lines: ['זהו אימייל בדיקה. אם הוא הגיע, שליחת האימיילים עובדת.'],
          link: { label: 'פתיחת Event Planner', url: input.url },
          footer: 'נשלח מדף המערכת על ידי משתמש-על.',
        }
      : {
          kind: 'test',
          subject: 'Test email from Event Planner',
          lines: ['This is a test email. If it arrived, sending email works.'],
          link: { label: 'Open Event Planner', url: input.url },
          footer: 'Sent from the System page by a Super User.',
        },
  )
}
