import { AxeBuilder } from '@axe-core/playwright'
import { expect, test, type Download, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { readSheet } from 'read-excel-file/node'
import writeXlsxFile from 'write-excel-file/node'
import { startInDemo } from './helpers.ts'

const GUESTS = '/events/evt-1/guests'
const WEDDING_FILE = 'Maya & Daniel’s Wedding - guests'

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
    .getByRole('region', { name: 'Guest figures' })
    .locator('div', { hasText: new RegExp(`^${label}`) })
    .locator('p')
    .nth(1)
}

/** The guest list, whichever way this screen shows it. */
function guestList(page: Page, isMobile: boolean) {
  return isMobile
    ? page.getByRole('list', { name: 'Guests' })
    : page.getByRole('table', { name: 'Guests' })
}

async function addGuest(
  page: Page,
  first: string,
  last: string,
  phone: string,
) {
  await page.getByRole('button', { name: 'Add Guest' }).click()
  const dialog = page.getByRole('dialog', { name: 'Add guest' })
  await dialog.getByLabel(/First name/).fill(first)
  await dialog.getByLabel(/Last name/).fill(last)
  await dialog.getByLabel(/Phone number/).fill(phone)
  await dialog.getByRole('button', { name: 'Add Guest' }).click()
  await expect(page.getByText('The guest was added.')).toBeVisible()
}

async function download(page: Page, action: () => Promise<void>) {
  const [file] = await Promise.all([page.waitForEvent('download'), action()])
  return file
}

async function csvRows(file: Download) {
  const text = await readFile(await file.path(), 'utf8')
  return text.replace(/^﻿/, '').trim().split('\r\n')
}

test('a guest can be added, found, edited and deleted, and the Dashboard follows', async ({
  page,
  isMobile,
}) => {
  await page.goto(GUESTS)
  const total = Number(await figure(page, 'Total Guests').textContent())

  await addGuest(page, 'Zohar', 'Newcomer', '050-555-0199')
  await expect(figure(page, 'Total Guests')).toHaveText(String(total + 1))

  await page
    .getByRole('searchbox', { name: 'Search guests' })
    .fill('0505550199')
  const list = guestList(page, isMobile)
  await expect(list.getByText('Zohar Newcomer', { exact: true })).toBeVisible()
  await expect(list.getByText('Not Sent')).toBeVisible()

  await list.getByRole('button', { name: 'Edit Zohar Newcomer' }).click()
  const edit = page.getByRole('dialog', { name: 'Edit guest' })
  await edit.getByLabel(/Last name/).fill('Renamed')
  await edit.getByRole('button', { name: 'Save Changes' }).click()
  await expect(list.getByText('Zohar Renamed', { exact: true })).toBeVisible()

  await page.reload()
  await expect(
    guestList(page, isMobile).getByText('Zohar Renamed', { exact: true }),
  ).toBeVisible()

  await page.goto('/events/evt-1/dashboard')
  await expect(
    page
      .getByRole('region', { name: 'Key figures' })
      .locator('div', { hasText: /^Total Guests/ })
      .locator('p')
      .nth(1),
  ).toHaveText(String(total + 1))

  await page.goto(`${GUESTS}?q=0505550199`)
  await page
    .getByRole('button', { name: 'More actions for Zohar Renamed' })
    .click()
  await page.getByRole('menuitem', { name: 'Delete' }).click()
  await page
    .getByRole('dialog', { name: 'Delete guest' })
    .getByRole('button', { name: 'Delete' })
    .click()
  await expect(page.getByText('No guests match')).toBeVisible()
  await expect(figure(page, 'Total Guests')).toHaveText(String(total))
})

test('filters, sorting and paging are kept in the address across a reload', async ({
  page,
  isMobile,
}) => {
  await page.goto(GUESTS)
  await page.getByLabel('RSVP status').selectOption('APPROVED')
  await page.getByLabel('Rows per page').selectOption('25')
  await page.getByRole('button', { name: 'Next page' }).click()
  await expect(page.getByText(/^26–50 of \d+ guests$/)).toBeVisible()

  await page.reload()

  await expect(page.getByText(/^26–50 of \d+ guests$/)).toBeVisible()
  await expect(page.getByLabel('RSVP status')).toHaveValue('APPROVED')
  await expect(guestList(page, isMobile).getByText('Approved')).toHaveCount(25)

  await page.getByRole('button', { name: 'Clear filters' }).click()
  await expect(page.getByLabel('RSVP status')).toHaveValue('ALL')
})

test('the column choice is remembered, and Name and Phone cannot be hidden', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'the column chooser belongs to the desktop table')
  await page.goto(GUESTS)
  const table = page.getByRole('table', { name: 'Guests' })

  await page.getByRole('button', { name: 'Choose columns' }).click()
  const chooser = page.getByRole('group', { name: 'Choose columns' })
  await expect(
    chooser.getByRole('checkbox', { name: 'Name (always shown)' }),
  ).toBeDisabled()
  await chooser.getByRole('checkbox', { name: 'Invitation Name' }).uncheck()
  await chooser.getByRole('checkbox', { name: 'Expected attendees' }).uncheck()
  await page.keyboard.press('Escape')
  await expect(
    page.getByRole('button', { name: 'Choose columns' }),
  ).toBeFocused()
  await expect(
    table.getByRole('columnheader', { name: 'Expected attendees' }),
  ).toHaveCount(0)

  await page.reload()
  await expect(
    table.getByRole('columnheader', { name: /^Confirmed/ }),
  ).toBeVisible()
  await expect(
    table.getByRole('columnheader', { name: 'Expected attendees' }),
  ).toHaveCount(0)
  await expect(
    table.getByRole('columnheader', { name: 'Invitation Name' }),
  ).toHaveCount(0)

  await page.goto('/events/evt-3/guests')
  await expect(
    page
      .getByRole('table', { name: 'Guests' })
      .getByRole('columnheader', { name: 'Expected attendees' }),
  ).toHaveCount(0)
})

test('selected guests can be exported and deleted together', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'selection belongs to the desktop table')
  await page.goto(GUESTS)
  const total = Number(await figure(page, 'Total Guests').textContent())
  const boxes = page
    .getByRole('table', { name: 'Guests' })
    .locator('tbody')
    .getByRole('checkbox')
  await boxes.nth(0).check()
  await boxes.nth(1).check()
  const bar = page.getByRole('region', { name: 'Selected guests' })
  await expect(bar.getByText('2 selected')).toBeVisible()

  const file = await download(page, async () => {
    await bar.getByRole('button', { name: 'Export selected' }).click()
    await page.getByRole('menuitem', { name: 'CSV file (.csv)' }).click()
  })
  expect(await csvRows(file)).toHaveLength(3)

  await bar.getByRole('button', { name: 'Delete selected' }).click()
  await page
    .getByRole('dialog', { name: 'Delete guests' })
    .getByRole('button', { name: 'Delete' })
    .click()

  await expect(page.getByText('2 guests were deleted.')).toBeVisible()
  await expect(figure(page, 'Total Guests')).toHaveText(String(total - 2))
  await expect(bar).toHaveCount(0)
})

test('all guests export to CSV and to Excel with every field', async ({
  page,
}) => {
  await page.goto(GUESTS)
  const total = Number(await figure(page, 'Total Guests').textContent())

  const csv = await download(page, async () => {
    await page.getByRole('button', { name: 'Export', exact: true }).click()
    await page.getByRole('menuitem', { name: 'CSV file (.csv)' }).click()
  })
  expect(csv.suggestedFilename()).toBe(`${WEDDING_FILE}.csv`)
  const lines = await csvRows(csv)
  expect(lines[0]).toBe(
    'First name,Last name,Invitation name,Phone,Expected attendees,Confirmed attendees,RSVP status,Invitations sent,Table',
  )
  expect(lines).toHaveLength(total + 1)

  const xlsx = await download(page, async () => {
    await page.getByRole('button', { name: 'Export', exact: true }).click()
    await page.getByRole('menuitem', { name: 'Excel file (.xlsx)' }).click()
  })
  expect(xlsx.suggestedFilename()).toBe(`${WEDDING_FILE}.xlsx`)
  const sheet = await readSheet(await xlsx.path())
  expect(sheet).toHaveLength(total + 1)
  expect(sheet[0]?.[3]).toBe('Phone')
  // Phones stay text, and counts are real numbers.
  expect(typeof sheet[1]?.[3]).toBe('string')
  expect(String(sheet[1]?.[3])).toMatch(/^000-\d{3}-\d{4}$/)
  expect(typeof sheet[1]?.[4]).toBe('number')
})

test('guests are imported from a CSV file, with unusable rows reported', async ({
  page,
}) => {
  await page.goto(GUESTS)
  const total = Number(await figure(page, 'Total Guests').textContent())
  await page.getByRole('button', { name: 'Import Guests' }).click()
  const dialog = page.getByRole('dialog', { name: 'Import guests' })

  await dialog.getByLabel('Choose a CSV or Excel file').setInputFiles({
    name: 'list.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(
      '﻿שם פרטי,שם משפחה,טלפון,מספר מוזמנים\r\nנועה,ייבוא,050-555-0201,2\r\nBad,Row,123,2\r\n"Quoted, Name",Import,050-555-0202,\r\n',
    ),
  })
  await expect(dialog.getByText(/^list\.csv: 4 rows\./)).toBeVisible()
  await expect(dialog.getByLabel(/Phone number/)).toHaveValue('2')
  await dialog.getByRole('button', { name: 'Preview' }).click()
  await expect(dialog.getByText('2 will be imported')).toBeVisible()
  await expect(dialog.getByText('Phone number is not valid')).toBeVisible()
  await dialog.getByRole('button', { name: 'Import 2 guests' }).click()

  await expect(
    dialog.getByText('2 guests added, 0 restored, 1 rows skipped.'),
  ).toBeVisible()
  const skipped = await download(page, () =>
    dialog.getByRole('button', { name: 'Download skipped rows' }).click(),
  )
  expect(await csvRows(skipped)).toHaveLength(2)
  await dialog.getByRole('button', { name: 'Done' }).click()

  await expect(figure(page, 'Total Guests')).toHaveText(String(total + 2))
  await page.getByRole('searchbox', { name: 'Search guests' }).fill('ייבוא')
  await expect(
    page.getByText('נועה ייבוא', { exact: true }).first(),
  ).toBeVisible()
})

test('guests are imported from an Excel file, restoring a phone stored as a number', async ({
  page,
}) => {
  const workbook = await writeXlsxFile([
    [{ value: 'Name' }, { value: 'Mobile' }, { value: 'Guests' }],
    [
      { value: 'Excel Person' },
      { value: 505550301, type: Number },
      { value: 4, type: Number },
    ],
    [{ value: 'Text Phone' }, { value: '050-555-0302' }, null],
  ]).toBuffer()
  await page.goto(GUESTS)
  await page.getByRole('button', { name: 'Import Guests' }).click()
  const dialog = page.getByRole('dialog', { name: 'Import guests' })

  await dialog.getByLabel('Choose a CSV or Excel file').setInputFiles({
    name: 'list.xlsx',
    mimeType:
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: workbook,
  })
  await expect(dialog.getByText(/^list\.xlsx: 3 rows\./)).toBeVisible()
  await dialog.getByRole('button', { name: 'Preview' }).click()
  await expect(dialog.getByText('2 will be imported')).toBeVisible()
  await expect(dialog.getByText('0505550301')).toBeVisible()
  await dialog.getByRole('button', { name: 'Import 2 guests' }).click()
  await expect(dialog.getByText(/^2 guests added/)).toBeVisible()
})

test('a file that is not a spreadsheet is refused', async ({ page }) => {
  await page.goto(GUESTS)
  await page.getByRole('button', { name: 'Import Guests' }).click()
  const dialog = page.getByRole('dialog', { name: 'Import guests' })

  await dialog.getByLabel('Choose a CSV or Excel file').setInputFiles({
    name: 'fake.xlsx',
    mimeType: 'application/octet-stream',
    buffer: Buffer.from('this is not a workbook'),
  })

  await expect(dialog.getByRole('alert')).toContainText('could not be read')
})

test('an unknown response can be rejected, restored and added as a guest', async ({
  page,
  isMobile,
}) => {
  await page.goto(`${GUESTS}?tab=unknown`)
  const pending = isMobile
    ? page.getByRole('list', { name: 'Awaiting review' })
    : page.getByRole('table', { name: 'Awaiting review' })
  await expect(pending.getByRole('button', { name: 'Reject' })).toHaveCount(8)

  await pending.getByRole('button', { name: 'Reject' }).first().click()
  await expect(pending.getByRole('button', { name: 'Reject' })).toHaveCount(7)

  await page.getByRole('tab', { name: /^Rejected/ }).click()
  await expect(page.getByRole('button', { name: 'Restore' })).toHaveCount(2)
  await page.getByRole('button', { name: 'Restore' }).first().click()
  await expect(page.getByRole('button', { name: 'Restore' })).toHaveCount(1)

  await page.getByRole('tab', { name: /^Awaiting review/ }).click()
  await pending.getByRole('button', { name: 'Add as guest' }).first().click()
  await page
    .getByRole('dialog', { name: 'Add as guest' })
    .getByRole('button', { name: 'Add as guest' })
    .click()
  await expect(
    page.getByText('The response was added as a guest.'),
  ).toBeVisible()
  await expect(
    page.getByRole('tab', { name: /^Unknown Guests/ }),
  ).toContainText('7')
})

test('a Viewer can view and export but sees no way to change guests', async ({
  page,
  isMobile,
}) => {
  await page.goto('/events/evt-4/guests')

  await expect(page.getByText('View-only access')).toBeVisible()
  await expect(guestList(page, isMobile)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Add Guest' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /^Edit / })).toHaveCount(0)
  const file = await download(page, async () => {
    await page.getByRole('button', { name: 'Export', exact: true }).click()
    await page.getByRole('menuitem', { name: 'CSV file (.csv)' }).click()
  })
  expect((await csvRows(file)).length).toBeGreaterThan(1)
})

test('a row menu opens above the rows beneath it and can be clicked', async ({
  page,
  isMobile,
}) => {
  await page.goto(GUESTS)
  const list = guestList(page, isMobile)

  await list
    .getByRole('button', { name: /^More actions for/ })
    .first()
    .click()
  await page.getByRole('menuitem', { name: 'Change RSVP' }).click()

  await expect(page.getByRole('dialog', { name: 'Change RSVP' })).toBeVisible()
})

test('the import preview shows each row’s result without scrolling sideways on desktop', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'the preview scrolls inside its frame on a phone')
  await page.goto(GUESTS)
  await page.getByRole('button', { name: 'Import Guests' }).click()
  const dialog = page.getByRole('dialog', { name: 'Import guests' })
  await dialog.getByLabel('Choose a CSV or Excel file').setInputFiles({
    name: 'list.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('First name,Phone\nA,050-555-0401\nB,12\n'),
  })
  await dialog.getByRole('button', { name: 'Preview' }).click()

  await expect(dialog.getByText('Phone number is not valid')).toBeInViewport()
})

test('the table can be used from the keyboard', async ({ page, isMobile }) => {
  test.skip(isMobile, 'the table is the desktop presentation')
  await page.goto(GUESTS)
  const table = page.getByRole('table', { name: 'Guests' })
  const sort = table
    .getByRole('columnheader', { name: /^Phone/ })
    .getByRole('button')

  await sort.focus()
  await page.keyboard.press('Enter')
  await expect(
    table.getByRole('columnheader', { name: /^Phone/ }),
  ).toHaveAttribute('aria-sort', 'ascending')

  await table.locator('tbody').getByRole('checkbox').first().focus()
  await page.keyboard.press('Space')
  await expect(page.getByText('1 selected')).toBeVisible()

  const more = table.getByRole('button', { name: /^More actions for/ }).first()
  await more.focus()
  await page.keyboard.press('Enter')
  await page.keyboard.press('ArrowDown')
  await expect(page.getByRole('menuitem', { name: 'Delete' })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(more).toBeFocused()
})

for (const language of ['en', 'he'] as const) {
  test.describe(`guests in ${language}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.addInitScript((value) => {
        window.localStorage.setItem('event-planner.language', value)
      }, language)
    })

    test('the list, selection, column chooser, details and dialogs have no accessibility violations', async ({
      page,
      isMobile,
    }) => {
      await page.goto(GUESTS)
      await expect(
        page.getByRole('main').locator('table, ul[aria-label]').first(),
      ).toBeVisible()
      await expect(page.getByRole('searchbox')).toBeVisible()
      await expectNoViolations(page)
      await expectNoSidewaysScroll(page, GUESTS)

      if (!isMobile) {
        await page.locator('tbody').getByRole('checkbox').first().check()
        await page.locator('button[aria-expanded][title]').first().click()
        await expect(page.getByRole('group').last()).toBeVisible()
        await expectNoViolations(page)
        await page.keyboard.press('Escape')

        await page.locator('tbody tr').first().locator('button').first().click()
        await expect(page.getByRole('dialog')).toBeVisible()
        await expectNoViolations(page)
        await page.keyboard.press('Escape')
      }

      await page.locator('button[aria-haspopup="menu"]').last().click()
      await expect(page.getByRole('menu')).toBeVisible()
      await page.getByRole('menuitem').first().click()
      await expect(page.getByRole('dialog')).toBeVisible()
      await expectNoViolations(page)
      await page.keyboard.press('Escape')

      await page.setViewportSize({ width: 320, height: 640 })
      await expectNoSidewaysScroll(page, `${GUESTS} at 320px`)
    })

    test('the add form with errors and each import step have no accessibility violations', async ({
      page,
    }) => {
      await page.goto(GUESTS)
      const header = page.locator('header').filter({ has: page.locator('h1') })
      await header.locator('button').last().click()
      const dialog = page.getByRole('dialog')
      await dialog.locator('button[type="submit"]').click()
      await expect(dialog.locator('[aria-invalid="true"]')).toHaveCount(1)
      await expectNoViolations(page)
      await page.keyboard.press('Escape')

      await header.locator('button').first().click()
      await expect(dialog.locator('input[type="file"]')).toBeAttached()
      await expectNoViolations(page)
      await dialog.locator('input[type="file"]').setInputFiles({
        name: 'list.csv',
        mimeType: 'text/csv',
        buffer: Buffer.from('First name,Phone\nA,050-555-0401\nB,12\n'),
      })
      await expect(dialog.locator('select').first()).toBeVisible()
      await expectNoViolations(page)
      await dialog.locator('button').last().click()
      await expect(dialog.locator('table')).toBeVisible()
      await expectNoViolations(page)
    })

    test('the Unknown Guests tab and its Rejected view have no accessibility violations', async ({
      page,
    }) => {
      await page.goto(`${GUESTS}?tab=unknown`)
      await expect(
        page.getByRole('main').locator('table, ul[aria-label]').first(),
      ).toBeVisible()
      await expectNoViolations(page)
      await expectNoSidewaysScroll(page, 'unknown guests')

      await page.goto(`${GUESTS}?tab=unknown&view=rejected`)
      await expect(
        page.getByRole('main').locator('table, ul[aria-label]').first(),
      ).toBeVisible()
      await expectNoViolations(page)

      await page.setViewportSize({ width: 320, height: 640 })
      await expectNoSidewaysScroll(page, 'unknown guests at 320px')
    })
  })
}
