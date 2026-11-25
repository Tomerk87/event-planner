/**
 * Writes a translation review PDF: every text of the application in English
 * (the source) and in one other language, numbered as in the review sheet,
 * grouped by screen, with a picture of each screen and email in both. The translator
 * reads the PDF and writes corrections in the sheet.
 *
 *   node scripts/translation-review-pdf.ts <he|pt> [app address] [output.pdf]
 *
 * Needs the application running (`npm run dev`, default
 * http://localhost:5173). The pictures come from the demo; the System page,
 * for Super Users only, is listed without one.
 * Default output: ../docs/hebrew-review.pdf or ../docs/portuguese-review.pdf.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { chromium, type Browser, type Page } from '@playwright/test'
import {
  EMAILS,
  EMAILS_TITLE,
  emailSample,
  REVIEWED,
  reviewedLanguage,
  reviewRows,
  sampleEmails,
  type ReviewRow,
} from './translationReview.ts'

const language = reviewedLanguage(process.argv[2])
const app = (process.argv[3] ?? 'http://localhost:5173').replace(/\/+$/, '')
const { name: languageName, file } = REVIEWED[language]
const output = path.resolve(
  process.argv[4] ?? path.join(import.meta.dirname, `../../docs/${file}.pdf`),
)
const version = readFileSync(
  path.join(import.meta.dirname, '../VERSION'),
  'utf8',
).trim()

/** The pages each group of texts is seen on; `{slug}` is the demo's RSVP link. */
const PAGES: Record<string, { address: string; demo: boolean }[]> = {
  landing: [{ address: '/', demo: false }],
  auth: [
    { address: '/signin', demo: false },
    { address: '/signup', demo: false },
    { address: '/forgot-password', demo: false },
  ],
  notFound: [{ address: '/no-such-page', demo: false }],
  events: [{ address: '/events', demo: true }],
  dashboard: [{ address: '/events/evt-1/dashboard', demo: true }],
  guests: [{ address: '/events/evt-1/guests', demo: true }],
  messages: [{ address: '/events/evt-1/messages', demo: true }],
  rsvpSettings: [{ address: '/events/evt-1/rsvp', demo: true }],
  publicRsvp: [{ address: '/rsvp/{slug}', demo: true }],
  layout: [
    { address: '/events/evt-1/layout', demo: true },
    { address: '/events/evt-1/layout?view=tables', demo: true },
  ],
  settings: [{ address: '/events/evt-1/settings', demo: true }],
  permissions: [{ address: '/events/evt-1/permissions', demo: true }],
}

/** The tallest part of a page shown, in CSS pixels. */
const MAX_HEIGHT = 2200
const WIDTH = 1280

const pictureOf = (shot: Buffer) =>
  `data:image/jpeg;base64,${shot.toString('base64')}`

/** English, the source, then the language under review. */
type Shown = 'en' | typeof language
const SHOWN: Shown[] = ['en', language]
const label = (into: Shown) =>
  into === 'en' ? 'English (source)' : `${languageName} (current)`
const direction = (into: Shown) => (into === 'he' ? 'rtl' : 'ltr')

/** A picture of a screen or an email, and the language it is in. */
interface Picture {
  in: Shown
  src: string
}

const LOCALES: Record<Shown, string> = { en: 'en-US', he: 'he-IL', pt: 'pt-BR' }

async function newPage(
  browser: Browser,
  into: Shown,
  demo: boolean,
): Promise<Page> {
  const context = await browser.newContext({
    viewport: { width: WIDTH, height: 800 },
    deviceScaleFactor: 1.5,
    locale: LOCALES[into],
  })
  await context.addInitScript(
    ([chosen, inDemo]) => {
      window.localStorage.setItem('event-planner.language', chosen)
      if (
        inDemo &&
        window.localStorage.getItem('event-planner.session') === null
      ) {
        window.localStorage.setItem(
          'event-planner.session',
          JSON.stringify({ workspace: 'demo' }),
        )
      }
    },
    [into, demo] as const,
  )
  return context.newPage()
}

/** The demo's RSVP link of its first event, read from its stored data. */
async function demoSlug(page: Page): Promise<string> {
  await page.goto(`${app}/events`)
  await page.getByRole('heading', { level: 1 }).waitFor()
  const slug = await page.evaluate(() => {
    const stored = JSON.parse(
      window.localStorage.getItem('event-planner.demo') ?? '{}',
    ) as { state?: { events?: { id: string; rsvpSlug: string }[] } }
    return stored.state?.events?.find((event) => event.id === 'evt-1')?.rsvpSlug
  })
  if (!slug) {
    throw new Error('The demo has no RSVP link for evt-1')
  }
  return slug
}

async function shoot(page: Page, address: string): Promise<string> {
  await page.goto(`${app}${address}`)
  await page.getByRole('heading', { level: 1 }).first().waitFor()
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(600)
  const height = await page.evaluate(() => document.body.scrollHeight)
  const shot = await page.screenshot({
    type: 'jpeg',
    quality: 70,
    fullPage: true,
    clip: { x: 0, y: 0, width: WIDTH, height: Math.min(height, MAX_HEIGHT) },
  })
  return pictureOf(shot)
}

/** Each email as it looks, in English and in the language under review. */
async function emailPictures(browser: Browser): Promise<Picture[]> {
  const page = await newPage(browser, 'en', false)
  await page.setViewportSize({ width: 720, height: 600 })
  const pictures: Picture[] = []
  for (const write of Object.values(sampleEmails(emailSample(language)))) {
    for (const into of SHOWN) {
      const email = write(into)
      let html = email.html
      for (const image of email.images) {
        html = html.replaceAll(
          `cid:${image.cid}`,
          `data:image/png;base64,${image.png}`,
        )
      }
      await page.setContent(html, { waitUntil: 'load' })
      pictures.push({
        in: into,
        src: pictureOf(
          await page.screenshot({ type: 'jpeg', quality: 75, fullPage: true }),
        ),
      })
    }
  }
  await page.context().close()
  return pictures
}

async function pictures(): Promise<Map<string, Picture[]>> {
  const browser = await chromium.launch()
  try {
    const shots = new Map<string, Picture[]>()
    // One demo and one signed-out visitor per language; each demo has its
    // own sample events, so its own RSVP link.
    const visitors = new Map<
      Shown,
      { demo: Page; signedOut: Page; slug: string }
    >()
    for (const into of SHOWN) {
      const demo = await newPage(browser, into, true)
      visitors.set(into, {
        demo,
        signedOut: await newPage(browser, into, false),
        slug: await demoSlug(demo),
      })
    }
    for (const [group, pages] of Object.entries(PAGES)) {
      const list: Picture[] = []
      for (const { address, demo: inDemo } of pages) {
        for (const into of SHOWN) {
          const visitor = visitors.get(into)!
          const where = address.replace('{slug}', visitor.slug)
          console.log(`  ${into} ${where}`)
          list.push({
            in: into,
            src: await shoot(inDemo ? visitor.demo : visitor.signedOut, where),
          })
        }
      }
      shots.set(group, list)
    }
    console.log('  emails')
    shots.set(EMAILS, await emailPictures(browser))
    return shots
  } finally {
    await browser.close()
  }
}

const escape = (text: string) =>
  text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')

/** "#12–40", or "#12" for one text. */
const range = (first: number, last: number) =>
  first === last ? `#${first}` : `#${first}–${last}`

/** Marks {{name}} and similar, which the application fills in. */
const marked = (text: string) =>
  escape(text).replace(/\{\{[^}]+\}\}/g, (mark) => `<mark>${mark}</mark>`)

function section(
  title: string,
  rows: ReviewRow[],
  shots: Picture[] | undefined,
): string {
  const first = rows[0]!.number
  const last = rows.at(-1)!.number
  const images = (shots ?? [])
    .map(
      (shot) => `<figure class="${shot.in === 'en' ? 'source' : 'current'}">
<figcaption>${escape(label(shot.in))}</figcaption>
<img class="shot" src="${shot.src}" alt="">
</figure>`,
    )
    .join('\n')
  const lines = rows
    .map(
      (row) => `<tr>
  <td class="number">${row.number}</td>
  <td lang="en" dir="ltr">${marked(row.english)}</td>
  <td lang="${language}" dir="${direction(language)}">${marked(row.current)}</td>
</tr>`,
    )
    .join('\n')
  // A screen with pictures starts a page; the short lists between follow on.
  return `<section class="${images ? 'screen' : 'list'}">
<h2>${escape(title)} <span class="range">${range(first, last)}</span></h2>
${images}
<table>
<thead><tr><th class="number">#</th><th>${escape(label('en'))}</th><th dir="${direction(language)}">${escape(label(language))}</th></tr></thead>
<tbody>
${lines}
</tbody>
</table>
</section>`
}

function documentHtml(
  rows: ReviewRow[],
  shots: Map<string, Picture[]>,
): string {
  const groups = [...new Set(rows.map((row) => row.group))]
  const sections = groups.map((group) => {
    const inGroup = rows.filter((row) => row.group === group)
    return {
      group,
      title: group === EMAILS ? EMAILS_TITLE : inGroup[0]!.screen,
      rows: inGroup,
    }
  })
  const date = new Date().toISOString().slice(0, 10)
  const contents = sections
    .map(
      ({ title, rows: inGroup }) =>
        `<li><span>${escape(title)}</span><span>${range(inGroup[0]!.number, inGroup.at(-1)!.number)}</span></li>`,
    )
    .join('\n')
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<style>
  @page { size: A4; margin: 16mm 14mm 18mm; }
  body { font-family: -apple-system, "Segoe UI", Arial, "Arial Hebrew", sans-serif; font-size: 10pt; color: #1f2333; line-height: 1.4; }
  h1 { font-size: 22pt; margin: 0 0 6mm; }
  h2 { font-size: 14pt; margin: 0 0 4mm; padding-block-end: 2mm; border-bottom: 2px solid #4f46e5; display: flex; justify-content: space-between; align-items: baseline; }
  .range { font-size: 9pt; font-weight: normal; color: #6b7080; }
  section.screen, .cover + section { break-before: page; }
  section.list { margin-block-start: 9mm; }
  section.list h2 { break-after: avoid; }
  th[dir="rtl"] { text-align: right; }
  .cover p { font-size: 11pt; margin: 0 0 3mm; }
  .cover ol { padding-inline-start: 5mm; }
  .cover li { margin-block-end: 2mm; font-size: 11pt; }
  .meta { color: #6b7080; }
  .contents { list-style: none; padding: 0; columns: 2; column-gap: 10mm; }
  .contents li { display: flex; justify-content: space-between; gap: 4mm; border-bottom: 1px dotted #c7cad6; padding: 1mm 0; break-inside: avoid; font-size: 9.5pt; }
  figure { margin: 0 0 5mm; break-inside: avoid; }
  figcaption { font-size: 9pt; font-weight: bold; margin: 0 0 1.5mm; padding: 0.8mm 2.5mm; border-radius: 1mm; display: inline-block; }
  figure.source figcaption { background: #e7e9f2; color: #1f2333; }
  figure.current figcaption { background: #4f46e5; color: #ffffff; }
  .shot { display: block; width: 100%; border: 1px solid #d5d8e3; border-radius: 2mm; }
  table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  th { background: #eef0fb; text-align: start; padding: 1.5mm 2mm; font-size: 9pt; }
  td { border-top: 1px solid #e3e5ee; padding: 1.5mm 2mm; vertical-align: top; white-space: pre-wrap; overflow-wrap: anywhere; }
  tr { break-inside: avoid; }
  .number { width: 11mm; color: #6b7080; font-variant-numeric: tabular-nums; }
  td[dir="rtl"] { text-align: right; }
  mark { background: #fff1c2; color: inherit; border-radius: 1mm; padding: 0 0.5mm; }
</style>
</head>
<body>
<div class="cover">
<h1>Event Planner — ${escape(languageName)} translation review</h1>
<p class="meta">${date} · frontend version ${escape(version)} · ${rows.length} texts</p>
<p>This document lists every text of Event Planner in English and ${escape(languageName)}, screen by screen, in the order a person meets them. <b>English is the source:</b> it is the meaning each ${escape(languageName)} text must carry. Each screen starts with two pictures of it, first in English (source), then in ${escape(languageName)} (current), followed by its texts in both languages. Texts used on many screens (buttons, messages, errors) come first.</p>
<ol>
<li>Read each screen's texts and compare the ${escape(languageName)} with the English source. The English pictures show where and how each text is used.</li>
<li>Write corrections in the spreadsheet <b>${escape(file)}.xlsx</b>, in the column "${escape(languageName)} (your correction)", on the line with the same <b>#</b> number. Leave the lines that are fine empty.</li>
<li>Use the "Comment" column for anything else, such as a term to use everywhere.</li>
<li>Marks such as <mark>{{name}}</mark> or <mark>{{count}}</mark> are filled in by the application (a name, a number). Keep them, unchanged, in your correction.</li>
<li>The pictures use fictional sample data. Names of people, events and places in them are not part of the review.</li>
</ol>
<h2>Contents</h2>
<ul class="contents">
${contents}
</ul>
</div>
${sections.map(({ group, title, rows: inGroup }) => section(title, inGroup, shots.get(group))).join('\n')}
</body>
</html>`
}

console.log(`Pictures of ${app} in ${languageName}:`)
const rows = reviewRows(language)
const html = documentHtml(rows, await pictures())

const browser = await chromium.launch()
try {
  const page = await browser.newPage()
  await page.setContent(html, { waitUntil: 'load' })
  await page.pdf({
    path: output,
    format: 'A4',
    printBackground: true,
    preferCSSPageSize: true,
    displayHeaderFooter: true,
    headerTemplate: '<span></span>',
    footerTemplate: `<div style="width: 100%; font-size: 8px; color: #6b7080; padding: 0 14mm; display: flex; justify-content: space-between;"><span>Event Planner — ${escape(languageName)} translation review</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`,
  })
} finally {
  await browser.close()
}
console.log(`Wrote ${rows.length} texts to ${output}`)
