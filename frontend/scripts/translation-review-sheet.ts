/**
 * Writes a translation review sheet (D74, D103): every text of the
 * application in English and in one other language, side by side and grouped
 * by screen, with an empty column for corrections. Includes the emails the
 * server sends.
 *
 *   node scripts/translation-review-sheet.ts <he|pt> [output.xlsx]
 *
 * Default output: ../docs/hebrew-review.xlsx or ../docs/portuguese-review.xlsx.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import writeExcelFile from 'write-excel-file/node'
import * as emails from '../../backend/src/email/templates.ts'

type Texts = { [key: string]: string | Texts }

/** The languages reviewed against English, as the sheet names them. */
const REVIEWED = {
  he: {
    name: 'Hebrew',
    file: 'hebrew-review.xlsx',
    timeZone: 'Asia/Jerusalem',
  },
  pt: {
    name: 'Portuguese (Brazil)',
    file: 'portuguese-review.xlsx',
    timeZone: 'America/Sao_Paulo',
  },
} as const

type Reviewed = keyof typeof REVIEWED

const language = (process.argv[2] ?? 'he') as Reviewed
if (!(language in REVIEWED)) {
  throw new Error(`Usage: translation-review-sheet.ts <he|pt> [output.xlsx]`)
}
const { name: languageName, file, timeZone } = REVIEWED[language]

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

function flatten(texts: Texts, prefix = ''): [string, string][] {
  return Object.entries(texts).flatMap(([key, value]) =>
    typeof value === 'string'
      ? [[`${prefix}${key}`, value] as [string, string]]
      : flatten(value, `${prefix}${key}.`),
  )
}

const en = new Map(flatten(read('en')))
const translated = new Map(flatten(read(language)))
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
    event: {
      name: 'Garden Party',
      startsAt: '2026-10-24T17:00:00.000Z',
      timeZone,
    },
    role: 'ADMIN' as const,
  }
  type Language = 'en' | Reviewed
  const kinds = {
    verifyEmail: (into: Language) => emails.verifyEmail(into, sample),
    resetPassword: (into: Language) => emails.resetPassword(into, sample),
    invitation: (into: Language) => emails.invitation(into, sample),
    accessGranted: (into: Language) => emails.accessGranted(into, sample),
    testEmail: (into: Language) => emails.testEmail(into, sample),
  }
  return Object.entries(kinds).flatMap(([kind, write]) => {
    const english = write('en')
    const other = write(language)
    return [
      [`email.${kind}.subject`, english.subject, other.subject],
      [`email.${kind}.text`, english.text, other.text],
    ] as [string, string, string][]
  })
}

const header = [
  'Screen',
  'Key',
  'English',
  `${languageName} (current)`,
  `${languageName} (your correction)`,
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
        { value: translated.get(key) ?? '(missing)', wrap: true },
        null,
        null,
      ]),
  ),
  ...emailRows().map(([key, english, other]) => [
    { value: 'Emails the server sends' },
    { value: key },
    { value: english, wrap: true },
    { value: other, wrap: true },
    null,
    null,
  ]),
]

const instructions = [
  [{ value: 'How to review', fontWeight: 'bold' as const }],
  [
    {
      value: `The "Texts" sheet lists every text of Event Planner in English and ${languageName}, grouped by the screen where it appears.`,
    },
  ],
  [
    {
      value: `Write a better ${languageName} wording in "${languageName} (your correction)" only where the current one should change; leave the rest empty.`,
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
  process.argv[3] ?? path.join(here, `../../docs/${file}`),
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
