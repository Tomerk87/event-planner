/**
 * The texts under review (D74, D103): every text of the application, and the
 * emails the server sends, in English and one other language, grouped by the
 * screen where it appears and numbered. The review sheet and the review PDF
 * both list these rows, so a line number means the same text in both.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import * as emails from '../../backend/src/email/templates.ts'

type Texts = { [key: string]: string | Texts }

/** The languages reviewed against English. */
export const REVIEWED = {
  he: {
    name: 'Hebrew',
    file: 'hebrew-review',
    timeZone: 'Asia/Jerusalem',
  },
  pt: {
    name: 'Portuguese (Brazil)',
    file: 'portuguese-review',
    timeZone: 'America/Sao_Paulo',
  },
} as const

export type Reviewed = keyof typeof REVIEWED

/** Reads the language named on the command line (default Hebrew). */
export function reviewedLanguage(argument: string | undefined): Reviewed {
  const language = argument ?? 'he'
  if (!(language in REVIEWED)) {
    throw new Error(`Unknown language "${language}": use he or pt`)
  }
  return language as Reviewed
}

/** Where each group of texts appears, in the order a person meets them. */
export const SCREENS: Record<string, string> = {
  app: 'Everywhere',
  nav: 'Menus and navigation',
  language: 'Language switcher',
  countries: 'Country names',
  roles: 'Role names',
  notifications: 'Notification bell',
  eventSelector: 'Event switcher',
  user: 'Account menu',
  pages: 'Page titles',
  common: 'Shared buttons and words',
  states: 'Loading and empty states',
  access: 'Read-only notices',
  toast: 'Short messages',
  errors: 'Error messages',
  notFound: 'Page not found',
  routeError: 'Unexpected error page',
  unavailable: 'Service unavailable page',
  landing: 'Landing page',
  auth: 'Sign up, sign in and password',
  email: 'Email verification notice',
  demo: 'Demo Mode',
  events: 'My Events',
  dashboard: 'Dashboard',
  guests: 'Guests',
  messages: 'Messages (WhatsApp)',
  rsvpSettings: 'RSVP Settings',
  publicRsvp: 'Public RSVP page (guests see it)',
  layout: 'Event Layout (tables)',
  settings: 'Event Settings',
  permissions: 'Permissions',
  system: 'System page (Super Users)',
}

/** The group of the server's emails, after every screen of the application. */
export const EMAILS = 'emails'
export const EMAILS_TITLE = 'Emails the server sends'

export interface ReviewRow {
  /** 1, 2, 3, … in the order below; the same in the sheet and the PDF. */
  number: number
  /** The first part of the key (`guests`), or EMAILS. */
  group: string
  /** Where it appears, in words. */
  screen: string
  key: string
  english: string
  /** The current translation; '(missing)' when there is none. */
  current: string
}

function flatten(texts: Texts, prefix = ''): [string, string][] {
  return Object.entries(texts).flatMap(([key, value]) =>
    typeof value === 'string'
      ? [[`${prefix}${key}`, value] as [string, string]]
      : flatten(value, `${prefix}${key}.`),
  )
}

function read(language: string): Texts {
  return JSON.parse(
    readFileSync(
      path.join(import.meta.dirname, `../src/i18n/locales/${language}.json`),
      'utf8',
    ),
  ) as Texts
}

/** The server's emails, with sample values in place of a person's details. */
function emailTexts(language: Reviewed): [string, string, string][] {
  const write = sampleEmails(emailSample(language))
  return Object.entries(write).flatMap(([kind, email]) => {
    const english = email('en')
    const other = email(language)
    return [
      [`email.${kind}.subject`, english.subject, other.subject],
      [`email.${kind}.text`, english.text, other.text],
    ] as [string, string, string][]
  })
}

type EmailLanguage = 'en' | Reviewed
type Sample = Parameters<typeof emails.invitation>[1] &
  Parameters<typeof emails.verifyEmail>[1] &
  Parameters<typeof emails.resetPassword>[1] &
  Parameters<typeof emails.accessGranted>[1] &
  Parameters<typeof emails.testEmail>[1]

/** Each email the server sends, written with the sample values. */
export function sampleEmails(sample: Sample) {
  return {
    verifyEmail: (into: EmailLanguage) => emails.verifyEmail(into, sample),
    resetPassword: (into: EmailLanguage) => emails.resetPassword(into, sample),
    invitation: (into: EmailLanguage) => emails.invitation(into, sample),
    accessGranted: (into: EmailLanguage) => emails.accessGranted(into, sample),
    testEmail: (into: EmailLanguage) => emails.testEmail(into, sample),
  }
}

/** The sample values the emails are shown with. */
export function emailSample(language: Reviewed): Sample {
  return {
    name: 'Dana',
    url: 'https://events.example.com/…',
    hours: 24,
    minutes: 60,
    inviter: 'Riley',
    event: {
      name: 'Garden Party',
      startsAt: '2026-10-24T17:00:00.000Z',
      timeZone: REVIEWED[language].timeZone,
    },
    role: 'ADMIN',
  } as Sample
}

/** Every text under review, numbered. */
export function reviewRows(language: Reviewed): ReviewRow[] {
  const en = new Map(flatten(read('en')))
  const translated = new Map(flatten(read(language)))
  const groups = [...new Set([...en.keys()].map((key) => key.split('.')[0]!))]
  const ordered = [
    ...Object.keys(SCREENS).filter((group) => groups.includes(group)),
    ...groups.filter((group) => !(group in SCREENS)),
  ]
  const rows: Omit<ReviewRow, 'number'>[] = [
    ...ordered.flatMap((group) =>
      [...en.entries()]
        .filter(([key]) => key.split('.')[0] === group)
        .map(([key, english]) => ({
          group,
          screen: SCREENS[group] ?? group,
          key,
          english,
          current: translated.get(key) ?? '(missing)',
        })),
    ),
    ...emailTexts(language).map(([key, english, current]) => ({
      group: EMAILS,
      screen: EMAILS_TITLE,
      key,
      english,
      current,
    })),
  ]
  return rows.map((row, index) => ({ ...row, number: index + 1 }))
}
