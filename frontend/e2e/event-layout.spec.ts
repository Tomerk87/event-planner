import { AxeBuilder } from '@axe-core/playwright'
import { expect, test, type Download, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { readSheet } from 'read-excel-file/node'
import { startInDemo } from './helpers.ts'

const LAYOUT = '/events/evt-1/layout'
const WEDDING_FILE = 'Maya & Daniel’s Wedding - seating'
const HEADINGS =
  'First Name,Last Name,Invitation Name,Phone,Number of Attendees,Table Number'

test.beforeEach(async ({ page }) => {
  await startInDemo(page)
})

async function expectNoViolations(page: Page) {
  const results = await new AxeBuilder({ page }).analyze()
  expect(
    results.violations.map((violation) => ({
      rule: violation.id,
      elements: violation.nodes.map((node) => node.target.join(' ')),
    })),
  ).toEqual([])
}

async function expectNoSidewaysScroll(page: Page, where: string) {
  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            document.documentElement.scrollWidth -
            document.documentElement.clientWidth,
        ),
      { message: `horizontal overflow at ${where}` },
    )
    .toBe(0)
}

function figure(page: Page, label: string) {
  return page
    .getByRole('region', { name: 'Seating figures' })
    .locator('div', { hasText: new RegExp(`^${label}`) })
    .locator('p')
    .nth(1)
}

/** The tables, whichever way this screen shows them. */
function tableList(page: Page, isMobile: boolean) {
  return isMobile
    ? page.getByRole('list', { name: 'Tables' })
    : page.getByRole('table', { name: 'Tables' })
}

/** One table's row on desktop, or its card on a phone. */
function entry(page: Page, isMobile: boolean, number: number) {
  return isMobile
    ? page
        .getByRole('list', { name: 'Tables' })
        .getByRole('listitem')
        .filter({ hasText: new RegExp(`^Table ${number}\\D`) })
    : page
        .getByRole('table', { name: 'Tables' })
        .getByRole('row')
        .filter({
          has: page.getByRole('button', { name: String(number), exact: true }),
        })
}

async function download(page: Page, action: () => Promise<void>) {
  const [file] = await Promise.all([page.waitForEvent('download'), action()])
  return file
}

async function csvRows(file: Download) {
  const text = await readFile(await file.path(), 'utf8')
  return text.replace(/^﻿/, '').trim().split('\r\n')
}

async function exportAs(page: Page, item: string) {
  return download(page, async () => {
    await page.getByRole('button', { name: 'Export Tables' }).click()
    await page.getByRole('menuitem', { name: item }).click()
  })
}

test('a table can be added, edited and deleted, and the change survives a reload', async ({
  page,
  isMobile,
}) => {
  await page.goto(`${LAYOUT}?size=25`)
  await expect(figure(page, 'Total Tables')).toHaveText('18')

  await page.getByRole('button', { name: 'Add Table' }).click()
  const add = page.getByRole('dialog', { name: 'Add Table' })
  await expect(add.getByLabel(/Table Number/)).toHaveValue('19')
  await add.getByLabel(/Table Number/).fill('4')
  await add.getByRole('button', { name: 'Add Table' }).click()
  await expect(add.getByText('Table number 4 is already in use.')).toBeVisible()
  await add.getByLabel(/Table Number/).fill('30')
  await add.getByLabel(/Capacity/).fill('6')
  await add.getByRole('button', { name: 'Add Table' }).click()

  await expect(page.getByText('Table 30 was added.')).toBeVisible()
  await expect(figure(page, 'Total Tables')).toHaveText('19')
  await expect(entry(page, isMobile, 30)).toContainText('Ready')

  await page.reload()
  await expect(entry(page, isMobile, 30)).toBeVisible()

  await entry(page, isMobile, 30)
    .getByRole('button', { name: 'More actions for Table 30' })
    .click()
  await page.getByRole('menuitem', { name: 'Edit Table' }).click()
  const edit = page.getByRole('dialog', { name: 'Edit Table 30' })
  await edit.getByLabel(/Capacity/).fill('2')
  await edit.getByRole('button', { name: 'Save Changes' }).click()
  await expect(page.getByText('Table 30 was saved.')).toBeVisible()
  await expect(entry(page, isMobile, 30)).toContainText('Almost Full')

  await entry(page, isMobile, 30)
    .getByRole('button', { name: 'More actions for Table 30' })
    .click()
  await page.getByRole('menuitem', { name: 'Delete Table' }).click()
  await page
    .getByRole('dialog', { name: 'Delete Table 30' })
    .getByRole('button', { name: 'Delete Table' })
    .click()

  await expect(page.getByText('Table 30 was deleted.')).toBeVisible()
  await expect(figure(page, 'Total Tables')).toHaveText('18')
  await expect(entry(page, isMobile, 30)).toHaveCount(0)
})

test('guests are removed from a table, added to it and moved from another, within its chairs', async ({
  page,
  isMobile,
}) => {
  await page.goto(LAYOUT)
  const assigned = Number(
    await figure(page, 'Assigned Attendees').textContent(),
  )

  await entry(page, isMobile, 3)
    .getByRole('button', { name: 'Manage guests of Table 3' })
    .click()
  const dialog = page.getByRole('dialog', { name: 'Guests of Table 3' })
  const seated = dialog.getByRole('list', {
    name: 'Guest parties at this table',
  })
  const candidates = dialog.getByRole('list', {
    name: 'Guests who can be added',
  })
  await expect(seated.getByRole('listitem')).toHaveCount(2)

  // Three seats are free: a party of four does not fit.
  await expect(
    candidates.getByRole('listitem').filter({ hasText: '4 attendees' }).first(),
  ).toContainText('Does not fit')

  await candidates
    .getByRole('listitem')
    .filter({ hasText: 'No table' })
    .filter({ hasText: '2 attendees' })
    .first()
    .getByRole('button')
    .click()
  await expect(seated.getByRole('listitem')).toHaveCount(3)

  await seated
    .getByRole('listitem')
    .filter({ hasText: '3 attendees' })
    .getByRole('button')
    .click()
  await expect(seated.getByRole('listitem')).toHaveCount(2)

  // A party seated at another table moves here in one step.
  await dialog.getByRole('searchbox').fill('Robin Brooks')
  const moving = candidates.getByRole('listitem').first()
  await expect(moving).toContainText('Table 16')
  await dialog.getByRole('searchbox').fill('')
  await dialog.getByRole('button', { name: 'Done' }).click()

  // Two attendees joined and three left.
  await page.reload()
  await expect(figure(page, 'Assigned Attendees')).toHaveText(
    String(assigned - 1),
  )
})

test('lowering a table’s chairs below its guests is saved and shown as over capacity', async ({
  page,
  isMobile,
}) => {
  await page.goto(LAYOUT)
  const warnings = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: 'Capacity Warnings' }) })
  await expect(
    warnings.getByRole('button', { name: /is over its capacity/ }),
  ).toHaveCount(2)

  await entry(page, isMobile, 1)
    .getByRole('button', { name: 'More actions for Table 1' })
    .click()
  await page.getByRole('menuitem', { name: 'Edit Table' }).click()
  const dialog = page.getByRole('dialog', { name: 'Edit Table 1' })
  await dialog.getByLabel(/Capacity/).fill('7')
  await expect(
    dialog.getByText('Fewer chairs than seated attendees'),
  ).toBeVisible()
  await dialog.getByRole('button', { name: 'Save Changes' }).click()

  await expect(entry(page, isMobile, 1)).toContainText('Over Capacity')
  await expect(
    warnings.getByRole('button', {
      name: 'Table 1 is over its capacity by 3.',
    }),
  ).toBeVisible()

  await page.goto('/events/evt-1/dashboard')
  await expect(page.getByText('Tables over capacity: 3')).toBeVisible()
})

test('the chosen table is shown beside the list on a wide screen', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'a phone opens the table’s guests instead')
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(LAYOUT)
  const panel = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: 'Selected Table' }) })

  await expect(panel).toContainText('Table 16')
  await expect(panel).toContainText('Over Capacity')
  await expectNoSidewaysScroll(page, `${LAYOUT} at 1440px`)

  await page
    .getByRole('table', { name: 'Tables' })
    .getByRole('button', { name: '3', exact: true })
    .click()

  await expect(panel).toContainText('Table 3')
  await expect(panel).toContainText('Assigned Guest Parties (2)')
  await expect(page).toHaveURL(/table=tbl-1-03/)

  // Every column of the list is in view beside the panel.
  const frame = page.getByRole('table', { name: 'Tables' }).locator('..')
  expect(
    await frame.evaluate(
      (element) => element.scrollWidth - element.clientWidth,
    ),
  ).toBe(0)
})

test('the seating list exports to CSV and to Excel, a row per seated party in table order', async ({
  page,
}) => {
  await page.goto(LAYOUT)

  const csv = await exportAs(page, 'CSV file (.csv)')
  expect(csv.suggestedFilename()).toBe(`${WEDDING_FILE}.csv`)
  const lines = await csvRows(csv)
  expect(lines[0]).toBe(HEADINGS)
  expect(lines.length).toBeGreaterThan(18)
  const tableNumbers = lines.slice(1).map((line) => Number(line.split(',')[5]))
  expect(tableNumbers).toEqual([...tableNumbers].sort((a, b) => a - b))
  expect(tableNumbers[0]).toBe(1)
  // Phones are written the way they are dialled locally.
  expect(lines[1]?.split(',')[3]).toMatch(/^000-\d{3}-\d{4}$/)

  const xlsx = await exportAs(page, 'Excel file (.xlsx)')
  expect(xlsx.suggestedFilename()).toBe(`${WEDDING_FILE}.xlsx`)
  const sheet = await readSheet(await xlsx.path())
  expect(sheet).toHaveLength(lines.length)
  expect(sheet[0]?.join(',')).toBe(HEADINGS)
  expect(typeof sheet[1]?.[3]).toBe('string')
  expect(typeof sheet[1]?.[4]).toBe('number')
  expect(sheet[1]?.[5]).toBe(1)
})

for (const [path, notice] of [
  ['/events/evt-4/layout', 'View-only access'],
  ['/events/evt-5/layout', 'This event has ended'],
] as const) {
  test(`${notice}: tables can be viewed and exported but not changed`, async ({
    page,
    isMobile,
  }) => {
    await page.goto(path)

    await expect(page.getByText(notice)).toBeVisible()
    await expect(tableList(page, isMobile)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Add Table' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /^Edit / })).toHaveCount(0)
    await expect(
      page.getByRole('button', { name: /^More actions for/ }),
    ).toHaveCount(0)

    await page.getByRole('button', { name: 'View guests of Table 1' }).click()
    const dialog = page.getByRole('dialog', { name: 'Guests of Table 1' })
    await expect(dialog.getByRole('listitem').first()).toBeVisible()
    await expect(dialog.getByRole('button', { name: /^Remove/ })).toHaveCount(0)
    await expect(dialog.getByRole('searchbox')).toHaveCount(0)
    await dialog.getByRole('button', { name: 'Done' }).click()

    const file = await exportAs(page, 'CSV file (.csv)')
    expect((await csvRows(file)).length).toBeGreaterThan(1)
  })
}

test('the Table Arrangement view is marked Soon and cannot be opened', async ({
  page,
}) => {
  await page.goto(LAYOUT)

  const tab = page.getByRole('tab', { name: /Table Arrangement/ })
  await expect(tab).toContainText('Soon')
  await expect(tab).toBeDisabled()
  await expect(page.getByRole('tab', { name: 'Tables' })).toHaveAttribute(
    'aria-selected',
    'true',
  )
})

test('search, shape and sorting are kept in the address', async ({
  page,
  isMobile,
}) => {
  await page.goto(`${LAYOUT}?q=1&shape=SQUARE&sort=-number`)

  const list = tableList(page, isMobile)
  await expect(page.getByRole('searchbox')).toHaveValue('1')
  await expect(list).toContainText('16')
  await expect(list).toContainText('12')
  await expect(
    isMobile ? list.getByRole('listitem') : list.locator('tbody tr'),
  ).toHaveCount(2)
  await expect(
    (isMobile ? list.getByRole('listitem') : list.locator('tbody tr')).first(),
  ).toContainText('16')
})

for (const language of ['en', 'he'] as const) {
  test.describe(`event layout in ${language}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.addInitScript((value) => {
        window.localStorage.setItem('event-planner.language', value)
      }, language)
    })

    test('the page and its dialogs have no accessibility violations and fit the screen', async ({
      page,
      isMobile,
    }) => {
      await page.goto(LAYOUT)
      await expect(
        page.getByRole('main').locator('table, ul[aria-label]').first(),
      ).toBeVisible()
      await expect(page.locator('html')).toHaveAttribute(
        'dir',
        language === 'he' ? 'rtl' : 'ltr',
      )
      await expectNoViolations(page)
      await expectNoSidewaysScroll(page, LAYOUT)

      // Add Table, with its errors shown.
      const header = page.locator('header').filter({ has: page.locator('h1') })
      await header.locator('button').first().click()
      const form = page.getByRole('dialog')
      await form.locator('input').first().fill('1')
      await form.locator('button[type="submit"]').click()
      await expect(form.locator('[aria-invalid="true"]')).toHaveCount(1)
      await expectNoViolations(page)
      await page.keyboard.press('Escape')

      // The row menu's first action, Edit Table.
      await page
        .getByRole('main')
        .locator('table, ul[aria-label]')
        .first()
        .locator('button[aria-haspopup="menu"]')
        .first()
        .click()
      await expect(page.getByRole('menu')).toBeVisible()
      await page.getByRole('menuitem').first().click()
      await expect(page.getByRole('dialog')).toBeVisible()
      await expectNoViolations(page)
      await page.keyboard.press('Escape')

      await page
        .locator(
          isMobile
            ? 'ul[aria-label] li button[aria-label]:not([aria-haspopup])'
            : 'tbody tr:first-child td:last-child button:not([aria-haspopup])',
        )
        .first()
        .click()
      await expect(
        page.getByRole('dialog').getByRole('searchbox'),
      ).toBeVisible()
      await expectNoViolations(page)
      await page.keyboard.press('Escape')

      if (!isMobile) {
        await page.setViewportSize({ width: 1440, height: 900 })
        await expectNoViolations(page)
        await expectNoSidewaysScroll(page, `${LAYOUT} at 1440px`)
      }
      await page.setViewportSize({ width: 320, height: 640 })
      await expectNoSidewaysScroll(page, `${LAYOUT} at 320px`)
    })
  })
}
