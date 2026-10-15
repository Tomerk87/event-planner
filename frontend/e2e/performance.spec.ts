import { expect, test, type Page } from '@playwright/test'
import { createEventByApi, signUpByApi } from './realApi.ts'

/**
 * The performance check of PLAN.md Phase 17, on a real account: an event of
 * 3,000 guests (its largest size) and 300 tables, with most guests answered
 * and seated. Passes when Guests, Dashboard and Event Layout each show their
 * content within 2 seconds, and 100 RSVP answers sent at once are all kept.
 *
 * Not part of `npm run test:e2e`; run it with `npm run test:performance`.
 */

const GUESTS = 3000
const TABLES = 300
const SIMULTANEOUS = 100
const LIMIT_MS = 2000

const phone = (index: number) => `05${String(index).padStart(8, '0')}`

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]!
}

/** Milliseconds from asking for the page until its content is shown. */
async function timeToShow(
  page: Page,
  path: string,
  shown: (page: Page) => Promise<void>,
): Promise<number> {
  const times: number[] = []
  for (let run = 0; run < 3; run += 1) {
    const started = Date.now()
    await page.goto(path)
    await shown(page)
    times.push(Date.now() - started)
  }
  return median(times)
}

test.setTimeout(240_000)

test(`an event of ${GUESTS} guests stays fast, and ${SIMULTANEOUS} answers at once are all kept`, async ({
  page,
}, testInfo) => {
  await signUpByApi(page, 'Pat Performance')
  const event = await createEventByApi(page, {
    name: 'Stadium Gala',
    maxAttendees: GUESTS,
    defaultAllowedAttendees: 1,
  })
  const api = (path: string) => `/api/events/${event.id}${path}`

  const imported = await page.request.post(api('/guests/import'), {
    data: {
      guests: Array.from({ length: GUESTS }, (_, index) => ({
        firstName: `Guest${index}`,
        lastName: `Family${index % 97}`,
        phone: phone(index),
        allowedAttendees: 1,
        group: `Group ${index % 20}`,
      })),
    },
    timeout: 120_000,
  })
  expect(imported.ok(), await imported.text()).toBe(true)
  const tables: { id: string }[] = []
  for (let number = 1; number <= TABLES; number += 1) {
    const response = await page.request.post(api('/tables'), {
      data: { number, capacity: 10, shape: 'CIRCLE' },
    })
    tables.push((await response.json()) as { id: string })
  }

  // Most guests answer, one after another, and the approved are seated.
  const guests = (await (await page.request.get(api('/guests'))).json()) as {
    id: string
    phone: string
  }[]
  const answered = guests.slice(SIMULTANEOUS)
  for (const [index, guest] of answered.entries()) {
    const status = index % 10 === 0 ? 'DECLINED' : 'APPROVED'
    await page.request.post(`/api/public/rsvp/${event.rsvpSlug}`, {
      data: { name: 'Guest', phone: guest.phone, status, attendees: 1 },
    })
    if (status === 'APPROVED') {
      await page.request.put(api(`/guests/${guest.id}/table`), {
        data: { tableId: tables[Math.floor(index / 10) % TABLES]!.id },
      })
    }
  }

  // The first hundred answer at the same moment.
  const started = Date.now()
  const answers = await Promise.all(
    guests.slice(0, SIMULTANEOUS).map((guest) =>
      page.request.post(`/api/public/rsvp/${event.rsvpSlug}`, {
        data: {
          name: 'Guest',
          phone: guest.phone,
          status: 'APPROVED',
          attendees: 1,
        },
      }),
    ),
  )
  const simultaneousMs = Date.now() - started
  expect(answers.map((answer) => answer.status())).toEqual(
    Array(SIMULTANEOUS).fill(200),
  )
  const dashboard = (await (
    await page.request.get(api('/dashboard'))
  ).json()) as {
    metrics: { confirmedAttendees: number; rsvpApproved: number }
  }
  const approved =
    answered.filter((_, index) => index % 10 !== 0).length + SIMULTANEOUS
  expect(dashboard.metrics.rsvpApproved).toBe(approved)
  expect(dashboard.metrics.confirmedAttendees).toBe(approved)

  // API answers, the median of five.
  const apiTimes: Record<string, number> = {}
  for (const path of ['/guests', '/dashboard', '/tables']) {
    const times: number[] = []
    for (let run = 0; run < 5; run += 1) {
      const begun = Date.now()
      expect((await page.request.get(api(path))).ok()).toBe(true)
      times.push(Date.now() - begun)
    }
    apiTimes[path] = median(times)
  }

  // Pages, from navigation until their content shows.
  const pageTimes = {
    guests: await timeToShow(page, `/events/${event.id}/guests`, (shown) =>
      expect(
        shown.getByRole('table', { name: 'Guests' }).getByRole('row').nth(1),
      ).toBeVisible({ timeout: 30_000 }),
    ),
    dashboard: await timeToShow(
      page,
      `/events/${event.id}/dashboard`,
      (shown) =>
        expect(shown.getByRole('region', { name: 'Key figures' })).toBeVisible({
          timeout: 30_000,
        }),
    ),
    layout: await timeToShow(page, `/events/${event.id}/layout`, (shown) =>
      expect(
        shown.getByRole('table', { name: 'Tables' }).getByRole('row').nth(1),
      ).toBeVisible({ timeout: 30_000 }),
    ),
  }

  const report = { apiTimes, pageTimes, simultaneousMs }
  console.log(JSON.stringify(report, null, 2))
  await testInfo.attach('timings', {
    body: JSON.stringify(report, null, 2),
    contentType: 'application/json',
  })
  for (const [name, ms] of Object.entries(pageTimes)) {
    expect(ms, `${name} page`).toBeLessThan(LIMIT_MS)
  }
})
