/**
 * Writes a translation review sheet (D74, D103): every text of the
 * application in English and in one other language, side by side, grouped
 * by screen and numbered as in the review PDF, with an empty column for
 * corrections. Includes the emails the server sends.
 *
 *   node scripts/translation-review-sheet.ts <he|pt> [output.xlsx]
 *
 * Default output: ../docs/hebrew-review.xlsx or ../docs/portuguese-review.xlsx.
 */
import path from 'node:path'
import writeExcelFile from 'write-excel-file/node'
import { REVIEWED, reviewedLanguage, reviewRows } from './translationReview.ts'

const language = reviewedLanguage(process.argv[2])
const { name: languageName, file } = REVIEWED[language]
const reviewed = reviewRows(language)

const header = [
  '#',
  'Screen',
  'Key',
  'English',
  `${languageName} (current)`,
  `${languageName} (your correction)`,
  'Comment',
].map((value) => ({ value, fontWeight: 'bold' as const }))

const rows = [
  header,
  ...reviewed.map((row) => [
    { value: row.number },
    { value: row.screen },
    { value: row.key },
    { value: row.english, wrap: true },
    { value: row.current, wrap: true },
    null,
    null,
  ]),
]

const instructions = [
  [{ value: 'How to review', fontWeight: 'bold' as const }],
  [
    {
      value: `The "Texts" sheet lists every text of Event Planner in English and ${languageName}, grouped by the screen where it appears. The numbers in "#" are the same as in the review PDF, which shows each screen.`,
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
  [{ value: `${reviewed.length} texts in all.` }],
]

const output = path.resolve(
  process.argv[3] ?? path.join(import.meta.dirname, `../../docs/${file}.xlsx`),
)
await writeExcelFile([
  {
    data: rows,
    sheet: 'Texts',
    columns: [
      { width: 6 },
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
console.log(`Wrote ${reviewed.length} texts to ${output}`)
