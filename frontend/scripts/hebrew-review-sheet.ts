/**
 * Writes the Hebrew review sheet (D74): every text of the application in
 * English and Hebrew, side by side and grouped by screen, with an empty
 * column for corrections. Includes the emails the server sends.
 *
 *   node scripts/hebrew-review-sheet.ts [output.xlsx]
 *
 * Default output: ../docs/hebrew-review.xlsx.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import writeExcelFile from 'write-excel-file/node'
import * as emails from '../../backend/src/email/templates.ts'

type Texts = { [key: string]: string | Texts }

const here = import.meta.dirname
const read = (language: string): Texts =>
  JSON.parse(
    readFileSync(
      path.join(here, `../src/i18n/locales/${language}.json`),
      'utf8',
    ),
  ) as Texts

/** Where each group of texts appears, in the order a person meets them. */
const SCREENS: Record<string, string> = {
  app: 'Everywhere',
  nav: 'Menus and navigation',
  language: 'Language switcher',
  roles: 'Role names',
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

function flatten(texts: Texts, prefix = ''): [string, string][] {
  return Object.entries(texts).flatMap(([key, value]) =>
    typeof value === 'string'
      ? [[`${prefix}${key}`, value] as [string, string]]
      : flatten(value, `${prefix}${key}.`),
  )
}

const en = new Map(flatten(read('en')))
const he = new Map(flatten(read('he')))
const groups = [...new Set([...en.keys()].map((key) => key.split('.')[0]!))]
const ordered = [
  ...Object.keys(SCREENS).filter((group) => groups.includes(group)),
  ...groups.filter((group) => !(group in SCREENS)),
]

/** The server's emails, with sample values in place of a person's details. */
function emailRows(): [string, string, string][] {
  const sample = {
    name: 'Dana',
    url: 'https://events.example.com/…',
    hours: 24,
    minutes: 60,
    inviter: 'Riley',
    event: 'Garden Party',
    role: 'ADMIN' as const,
  }
  const kinds = {
    verifyEmail: (language: 'en' | 'he') =>
      emails.verifyEmail(language, sample),
    resetPassword: (language: 'en' | 'he') =>
      emails.resetPassword(language, sample),
    invitation: (language: 'en' | 'he') => emails.invitation(language, sample),
    accessGranted: (language: 'en' | 'he') =>
      emails.accessGranted(language, sample),
    testEmail: (language: 'en' | 'he') => emails.testEmail(language, sample),
  }
  return Object.entries(kinds).flatMap(([kind, write]) => {
    const english = write('en')
    const hebrew = write('he')
    return [
      [`email.${kind}.subject`, english.subject, hebrew.subject],
      [`email.${kind}.text`, english.text, hebrew.text],
    ] as [string, string, string][]
  })
}

const header = [
  'Screen',
  'Key',
  'English',
  'Hebrew (current)',
  'Hebrew (your correction)',
  'Comment',
].map((value) => ({ value, fontWeight: 'bold' as const }))

const rows = [
  header,
  ...ordered.flatMap((group) =>
    [...en.entries()]
      .filter(([key]) => key.split('.')[0] === group)
      .map(([key, english]) => [
        { value: SCREENS[group] ?? group },
        { value: key },
        { value: english, wrap: true },
        { value: he.get(key) ?? '(missing)', wrap: true },
        null,
        null,
      ]),
  ),
  ...emailRows().map(([key, english, hebrew]) => [
    { value: 'Emails the server sends' },
    { value: key },
    { value: english, wrap: true },
    { value: hebrew, wrap: true },
    null,
    null,
  ]),
]

const instructions = [
  [{ value: 'How to review', fontWeight: 'bold' as const }],
  [
    {
      value:
        'The "Texts" sheet lists every text of Event Planner in English and Hebrew, grouped by the screen where it appears.',
    },
  ],
  [
    {
      value:
        'Write a better Hebrew wording in "Hebrew (your correction)" only where the current one should change; leave the rest empty.',
    },
  ],
  [
    {
      value:
        'Use "Comment" for anything else, such as a term to use everywhere.',
    },
  ],
  [
    {
      value:
        '{{name}}, {{count}} and similar marks are filled in by the application; keep them in the correction.',
    },
  ],
  [{ value: `${rows.length - 1} texts in all.` }],
]

const output = path.resolve(
  process.argv[2] ?? path.join(here, '../../docs/hebrew-review.xlsx'),
)
await writeExcelFile([
  {
    data: rows,
    sheet: 'Texts',
    columns: [
      { width: 26 },
      { width: 34 },
      { width: 60 },
      { width: 60 },
      { width: 50 },
      { width: 30 },
    ],
    stickyRowsCount: 1,
  },
  { data: instructions, sheet: 'How to review', columns: [{ width: 120 }] },
]).toFile(output)
console.log(`Wrote ${rows.length - 1} texts to ${output}`)
