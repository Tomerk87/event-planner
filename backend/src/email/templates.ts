import type { IsoDateTime, RsvpLanguage } from '../domain/models.ts'
import type { EventRole } from '../domain/roles.ts'
import { PICTURES, type PictureName } from './images.ts'
import type { EmailImage, EmailMessage } from './mailer.ts'

/**
 * The emails the server sends, in English, Hebrew and Portuguese, laid out as in
 * mockups/event_collaboration_email.png: the Event Planner mark, a title, the
 * message, an optional box of details, one button, and a footer. Each email
 * is HTML plus a plain-text version; the HTML escapes every value a person
 * typed. The pictures travel inside the email (inline attachments), since
 * email programs block pictures from the web and do not show SVG.
 */

export type EmailLanguage = RsvpLanguage

type Content = Omit<EmailMessage, 'to'> & { images: EmailImage[] }

const ROLE: Record<EmailLanguage, Record<EventRole, string>> = {
  en: { OWNER: 'Owner', ADMIN: 'Admin', VIEWER: 'Viewer' },
  he: { OWNER: 'בעלים', ADMIN: 'מנהל', VIEWER: 'צופה' },
  pt: { OWNER: 'Proprietário', ADMIN: 'Administrador', VIEWER: 'Leitor' },
}

const LOCALE: Record<EmailLanguage, string> = {
  en: 'en-US',
  he: 'he-IL',
  pt: 'pt-BR',
}

/** Shown when the event's date is the event's own day, wherever the reader is. */
function eventDate(
  language: EmailLanguage,
  startsAt: IsoDateTime,
  timeZone: string,
): string {
  return new Intl.DateTimeFormat(LOCALE[language], {
    dateStyle: 'long',
    timeZone,
  }).format(new Date(startsAt))
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

/**
 * A value a person typed, such as an event's name. In a Hebrew email it is
 * isolated, so an English name keeps its own direction inside the sentence.
 */
function typed(language: EmailLanguage, value: string): string {
  return language === 'he' ? `⁨${value}⁩` : value
}

/** Part of a paragraph: plain, or bold. */
type Segment = string | { strong: string }

interface Detail {
  picture: PictureName
  label: string
  value: string
}

interface Layout {
  kind: string
  subject: string
  /** The big picture above the title. */
  hero?: PictureName
  title: string
  /** "Hi Dana,"; left out when the person's name is not known. */
  greeting?: string
  body: Segment[][]
  details?: Detail[]
  button: { label: string; url: string }
  /** Paragraphs after the button. */
  notes: string[]
  /** The two small lines at the bottom. */
  footer: [string, string]
}

const APP_NAME = 'Event Planner'

const CLOSING: Record<EmailLanguage, string> = {
  en: 'Thanks,',
  he: 'תודה,',
  pt: 'Obrigado,',
}

const SECURE: Record<EmailLanguage, { email: string; invitation: string }> = {
  en: {
    email: 'This email was sent securely by Event Planner.',
    invitation: 'This invitation was sent securely by Event Planner.',
  },
  he: {
    email: 'ההודעה נשלחה באופן מאובטח על ידי Event Planner.',
    invitation: 'ההזמנה נשלחה באופן מאובטח על ידי Event Planner.',
  },
  pt: {
    email: 'Este e-mail foi enviado com segurança pelo Event Planner.',
    invitation: 'Este convite foi enviado com segurança pelo Event Planner.',
  },
}

const COLOR = {
  page: '#f3f4f8',
  card: '#ffffff',
  border: '#e5e7eb',
  heading: '#0f172a',
  text: '#1f2937',
  muted: '#4b5563',
  faint: '#6b7280',
  primary: '#4f46e5',
  box: '#f4f5fb',
  tile: '#e6e7fd',
  lockTile: '#f1f2f5',
}

const FONT =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, 'Noto Sans Hebrew', sans-serif"

function plain(segments: Segment[]): string {
  return segments
    .map((segment) => (typeof segment === 'string' ? segment : segment.strong))
    .join('')
}

function rich(segments: Segment[]): string {
  return segments
    .map((segment) =>
      typeof segment === 'string'
        ? escapeHtml(segment)
        : `<strong style="color: ${COLOR.heading};">${escapeHtml(segment.strong)}</strong>`,
    )
    .join('')
}

function compose(language: EmailLanguage, layout: Layout): Content {
  const dir = language === 'he' ? 'rtl' : 'ltr'
  const start = dir === 'rtl' ? 'right' : 'left'
  const end = dir === 'rtl' ? 'left' : 'right'
  const arrow = dir === 'rtl' ? '&larr;' : '&rarr;'
  const used = new Set<PictureName>(['logo', 'lock'])

  function img(name: PictureName, scale = 1): string {
    used.add(name)
    const picture = PICTURES[name]
    const width = Math.round(picture.width * scale)
    const height = Math.round(picture.height * scale)
    return `<img src="cid:${name}@event-planner" width="${width}" height="${height}" alt="" style="display: block; border: 0; width: ${width}px; height: ${height}px;">`
  }

  const paragraph = (html: string, style = '') =>
    `<p style="margin: 0 0 14px; font-size: 16px; line-height: 1.55; color: ${COLOR.text};${style}">${html}</p>`

  const details = layout.details
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 22px 0 26px; background: ${COLOR.box}; border-radius: 12px;">
<tr><td style="padding: 18px 20px 6px;">
${layout.details
  .map(
    (
      detail,
    ) => `<table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom: 14px;"><tr>
<td width="40" height="40" align="center" valign="middle" style="width: 40px; height: 40px; background: ${COLOR.tile}; border-radius: 10px;">${img(detail.picture)}</td>
<td valign="middle" style="padding-${start}: 16px; text-align: ${start};">
<div style="font-size: 14px; color: ${COLOR.muted};">${escapeHtml(detail.label)}</div>
<div style="font-size: 17px; font-weight: 700; color: ${COLOR.heading};">${escapeHtml(detail.value)}</div>
</td></tr></table>`,
  )
  .join('\n')}
</td></tr></table>`
    : '<div style="height: 12px;"></div>'

  const html = `<!doctype html>
<html lang="${language}" dir="${dir}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${escapeHtml(layout.subject)}</title>
</head>
<body style="margin: 0; padding: 0; background: ${COLOR.page};">
<div style="display: none; max-height: 0; overflow: hidden;">${escapeHtml(plain(layout.body[0] ?? []))}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: ${COLOR.page};">
<tr><td align="center" style="padding: 32px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" dir="${dir}" style="max-width: 560px; background: ${COLOR.card}; border: 1px solid ${COLOR.border}; border-radius: 16px;">
<tr><td style="padding: 36px 32px 28px; font-family: ${FONT}; text-align: ${start};">
<table role="presentation" align="center" cellpadding="0" cellspacing="0"><tr>
<td valign="middle" style="padding-${end}: 10px;">${img('logo', 0.9)}</td>
<td valign="middle" style="font-size: 22px; font-weight: 700; color: ${COLOR.heading};">${APP_NAME}</td>
</tr></table>
${layout.hero ? `<table role="presentation" align="center" cellpadding="0" cellspacing="0" style="margin-top: 24px;"><tr><td>${img(layout.hero)}</td></tr></table>` : ''}
<h1 style="margin: 26px 0 22px; font-size: 26px; line-height: 1.25; font-weight: 800; text-align: center; color: ${COLOR.heading};">${escapeHtml(layout.title)}</h1>
${layout.greeting ? paragraph(escapeHtml(layout.greeting)) : ''}
${layout.body.map((segments) => paragraph(rich(segments))).join('\n')}
${details}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td align="center" bgcolor="${COLOR.primary}" style="border-radius: 10px; background: ${COLOR.primary};">
<a href="${escapeHtml(layout.button.url)}" style="display: block; padding: 15px 24px; font-size: 17px; font-weight: 600; color: #ffffff; text-decoration: none;">${escapeHtml(layout.button.label)}&nbsp;&nbsp;${arrow}</a>
</td></tr></table>
<div style="height: 22px;"></div>
${layout.notes.map((note) => paragraph(escapeHtml(note), ` font-size: 15px; color: ${COLOR.muted};`)).join('\n')}
${paragraph(`${escapeHtml(CLOSING[language])}<br><strong style="color: ${COLOR.heading};">${APP_NAME}</strong>`, ` margin-top: 22px; color: ${COLOR.muted};`)}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top: 22px; border-top: 1px solid ${COLOR.border};"><tr><td style="padding-top: 18px;">
<table role="presentation" cellpadding="0" cellspacing="0"><tr>
<td valign="top" width="34" style="width: 34px;"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td width="34" height="34" align="center" valign="middle" style="width: 34px; height: 34px; background: ${COLOR.lockTile}; border-radius: 17px;">${img('lock', 0.8)}</td></tr></table></td>
<td valign="middle" style="padding-${start}: 12px; font-size: 12px; line-height: 1.5; color: ${COLOR.faint}; text-align: ${start};">${escapeHtml(layout.footer[0])}<br>${escapeHtml(layout.footer[1])}</td>
</tr></table>
</td></tr></table>
</td></tr></table>
</td></tr></table>
</body>
</html>`

  const text = [
    layout.title,
    ...(layout.greeting ? [layout.greeting] : []),
    ...layout.body.map(plain),
    ...(layout.details ?? []).map(
      (detail) => `${detail.label} ${detail.value}`,
    ),
    `${layout.button.label}: ${layout.button.url}`,
    ...layout.notes,
    `${CLOSING[language]}\n${APP_NAME}`,
    layout.footer.join('\n'),
  ].join('\n\n')

  const images: EmailImage[] = [...used].map((name) => ({
    cid: `${name}@event-planner`,
    filename: `${name}.png`,
    png: PICTURES[name].png,
  }))

  return { kind: layout.kind, subject: layout.subject, text, html, images }
}

function greet(language: EmailLanguage, name?: string): string {
  const hello = { en: 'Hi', he: 'שלום', pt: 'Olá' }[language]
  return name ? `${hello} ${typed(language, name)},` : `${hello},`
}

export function verifyEmail(
  language: EmailLanguage,
  input: { name: string; url: string; hours: number },
): Content {
  const greeting = greet(language, input.name)
  const layouts: Record<EmailLanguage, Layout> = {
    en: {
      kind: 'verify-email',
      subject: 'Verify your email for Event Planner',
      title: 'Verify your email',
      greeting,
      body: [['To finish signing up, please verify your email address.']],
      button: { label: 'Verify Email', url: input.url },
      notes: [`This link works for ${input.hours} hours.`],
      footer: [
        SECURE.en.email,
        "If you didn't sign up for Event Planner, you can safely ignore this email.",
      ],
    },
    he: {
      kind: 'verify-email',
      subject: 'אימות כתובת האימייל שלך ב-Event Planner',
      title: 'אימות כתובת האימייל',
      greeting,
      body: [['כדי להשלים את ההרשמה, יש לאמת את כתובת האימייל שלך.']],
      button: { label: 'אימות האימייל', url: input.url },
      notes: [`הקישור תקף ל-${input.hours} שעות.`],
      footer: [
        SECURE.he.email,
        'אם לא נרשמת ל-Event Planner, אפשר להתעלם מהודעה זו בבטחה.',
      ],
    },
    pt: {
      kind: 'verify-email',
      subject: 'Confirme seu e-mail no Event Planner',
      title: 'Confirme seu e-mail',
      greeting,
      body: [['Para concluir seu cadastro, confirme seu endereço de e-mail.']],
      button: { label: 'Confirmar e-mail', url: input.url },
      notes: [`Este link é válido por ${input.hours} horas.`],
      footer: [
        SECURE.pt.email,
        'Se você não se cadastrou no Event Planner, pode ignorar este e-mail com segurança.',
      ],
    },
  }
  return compose(language, layouts[language])
}

export function resetPassword(
  language: EmailLanguage,
  input: { name: string; url: string; minutes: number },
): Content {
  const greeting = greet(language, input.name)
  const layouts: Record<EmailLanguage, Layout> = {
    en: {
      kind: 'reset-password',
      subject: 'Reset your Event Planner password',
      title: 'Reset your password',
      greeting,
      body: [['We received a request to reset the password of your account.']],
      button: { label: 'Choose a New Password', url: input.url },
      notes: [`This link works for ${input.minutes} minutes, once.`],
      footer: [
        SECURE.en.email,
        "If you didn't ask to reset your password, you can safely ignore this email; your password stays the same.",
      ],
    },
    he: {
      kind: 'reset-password',
      subject: 'איפוס הסיסמה שלך ב-Event Planner',
      title: 'איפוס הסיסמה',
      greeting,
      body: [['התקבלה בקשה לאפס את הסיסמה של החשבון שלך.']],
      button: { label: 'בחירת סיסמה חדשה', url: input.url },
      notes: [`הקישור תקף ל-${input.minutes} דקות ולשימוש אחד.`],
      footer: [
        SECURE.he.email,
        'אם לא ביקשת לאפס את הסיסמה, אפשר להתעלם מהודעה זו בבטחה; הסיסמה לא תשתנה.',
      ],
    },
    pt: {
      kind: 'reset-password',
      subject: 'Redefina sua senha do Event Planner',
      title: 'Redefina sua senha',
      greeting,
      body: [
        ['Recebemos uma solicitação para redefinir a senha da sua conta.'],
      ],
      button: { label: 'Escolher nova senha', url: input.url },
      notes: [
        `Este link é válido por ${input.minutes} minutos e pode ser usado uma vez.`,
      ],
      footer: [
        SECURE.pt.email,
        'Se você não pediu para redefinir sua senha, pode ignorar este e-mail com segurança; sua senha continua a mesma.',
      ],
    },
  }
  return compose(language, layouts[language])
}

/** What an email about an event says about it. */
export interface EventInvite {
  inviter: string
  event: { name: string; startsAt: IsoDateTime; timeZone: string }
  role: EventRole
  url: string
}

const DETAIL_LABELS: Record<EmailLanguage, { role: string; date: string }> = {
  en: { role: 'Role:', date: 'Date:' },
  he: { role: 'הרשאה:', date: 'תאריך:' },
  pt: { role: 'Permissão:', date: 'Data:' },
}

function eventDetails(language: EmailLanguage, input: EventInvite): Detail[] {
  const labels = DETAIL_LABELS[language]
  return [
    {
      picture: 'role',
      label: labels.role,
      value: ROLE[language][input.role],
    },
    {
      picture: 'date',
      label: labels.date,
      value: eventDate(language, input.event.startsAt, input.event.timeZone),
    },
  ]
}

/** To an address with no verified account: sign up to accept (D90). */
export function invitation(
  language: EmailLanguage,
  input: EventInvite,
): Content {
  const event = typed(language, input.event.name)
  const inviter = typed(language, input.inviter)
  const greeting = greet(language)
  const details = eventDetails(language, input)
  const layouts: Record<EmailLanguage, Layout> = {
    en: {
      kind: 'invitation',
      subject: `You're invited to "${event}" on Event Planner`,
      hero: 'envelope',
      title: `You're invited to ${event}`,
      greeting,
      body: [
        [`${inviter} invited you to collaborate on `, { strong: event }, '.'],
      ],
      details,
      button: { label: 'Accept Invitation', url: input.url },
      notes: [
        'Once accepted, the event will appear in your My Events page.',
        "If you don't have an account yet, you can create one using this email address.",
      ],
      footer: [
        SECURE.en.invitation,
        "If you weren't expecting this, you can safely ignore this email.",
      ],
    },
    he: {
      kind: 'invitation',
      subject: `הוזמנת לאירוע "${event}" ב-Event Planner`,
      hero: 'envelope',
      title: `הוזמנת לאירוע ${event}`,
      greeting,
      body: [
        [
          `${inviter} הזמין/ה אותך להצטרף לניהול האירוע `,
          { strong: event },
          '.',
        ],
      ],
      details,
      button: { label: 'קבלת ההזמנה', url: input.url },
      notes: [
        'לאחר קבלת ההזמנה, האירוע יופיע בדף "האירועים שלי".',
        'אם עדיין אין לך חשבון, אפשר ליצור אותו עם כתובת האימייל הזו.',
      ],
      footer: [
        SECURE.he.invitation,
        'אם לא ציפית להודעה הזו, אפשר להתעלם ממנה בבטחה.',
      ],
    },
    pt: {
      kind: 'invitation',
      subject: `Você foi convidado para "${event}" no Event Planner`,
      hero: 'envelope',
      title: `Você foi convidado para ${event}`,
      greeting,
      body: [
        [`${inviter} convidou você para colaborar em `, { strong: event }, '.'],
      ],
      details,
      button: { label: 'Aceitar convite', url: input.url },
      notes: [
        'Depois de aceitar, o evento aparecerá na sua página Meus Eventos.',
        'Se você ainda não tem uma conta, pode criar uma usando este endereço de e-mail.',
      ],
      footer: [
        SECURE.pt.invitation,
        'Se você não esperava este convite, pode ignorar este e-mail com segurança.',
      ],
    },
  }
  return compose(language, layouts[language])
}

/** To an existing account that was given access at once (D90). */
export function accessGranted(
  language: EmailLanguage,
  input: EventInvite & { name: string },
): Content {
  const event = typed(language, input.event.name)
  const inviter = typed(language, input.inviter)
  const greeting = greet(language, input.name)
  const details = eventDetails(language, input)
  const layouts: Record<EmailLanguage, Layout> = {
    en: {
      kind: 'access-granted',
      subject: `You now have access to "${event}"`,
      hero: 'envelope',
      title: `You now have access to ${event}`,
      greeting,
      body: [[`${inviter} gave you access to `, { strong: event }, '.']],
      details,
      button: { label: 'Open Event', url: input.url },
      notes: ['The event now appears in your My Events page.'],
      footer: [
        SECURE.en.email,
        "If you weren't expecting this, you can safely ignore this email.",
      ],
    },
    he: {
      kind: 'access-granted',
      subject: `קיבלת גישה לאירוע "${event}"`,
      hero: 'envelope',
      title: `קיבלת גישה לאירוע ${event}`,
      greeting,
      body: [[`${inviter} נתן/ה לך גישה לאירוע `, { strong: event }, '.']],
      details,
      button: { label: 'פתיחת האירוע', url: input.url },
      notes: ['האירוע מופיע עכשיו בדף "האירועים שלי".'],
      footer: [
        SECURE.he.email,
        'אם לא ציפית להודעה הזו, אפשר להתעלם ממנה בבטחה.',
      ],
    },
    pt: {
      kind: 'access-granted',
      subject: `Agora você tem acesso a "${event}"`,
      hero: 'envelope',
      title: `Agora você tem acesso a ${event}`,
      greeting,
      body: [[`${inviter} deu a você acesso a `, { strong: event }, '.']],
      details,
      button: { label: 'Abrir evento', url: input.url },
      notes: ['O evento agora aparece na sua página Meus Eventos.'],
      footer: [
        SECURE.pt.email,
        'Se você não esperava este e-mail, pode ignorá-lo com segurança.',
      ],
    },
  }
  return compose(language, layouts[language])
}

export function testEmail(
  language: EmailLanguage,
  input: { url: string },
): Content {
  const layouts: Record<EmailLanguage, Layout> = {
    en: {
      kind: 'test',
      subject: 'Test email from Event Planner',
      title: 'Sending email works',
      body: [['This is a test email. If it arrived, sending email works.']],
      button: { label: 'Open Event Planner', url: input.url },
      notes: [],
      footer: [SECURE.en.email, 'Sent from the System page by a Super User.'],
    },
    he: {
      kind: 'test',
      subject: 'אימייל בדיקה מ-Event Planner',
      title: 'שליחת אימיילים עובדת',
      body: [['זהו אימייל בדיקה. אם הוא הגיע, שליחת האימיילים עובדת.']],
      button: { label: 'פתיחת Event Planner', url: input.url },
      notes: [],
      footer: [SECURE.he.email, 'נשלח מדף המערכת על ידי משתמש-על.'],
    },
    pt: {
      kind: 'test',
      subject: 'E-mail de teste do Event Planner',
      title: 'O envio de e-mails funciona',
      body: [
        [
          'Este é um e-mail de teste. Se ele chegou, o envio de e-mails funciona.',
        ],
      ],
      button: { label: 'Abrir o Event Planner', url: input.url },
      notes: [],
      footer: [
        SECURE.pt.email,
        'Enviado da página Sistema por um Superusuário.',
      ],
    },
  }
  return compose(language, layouts[language])
}
