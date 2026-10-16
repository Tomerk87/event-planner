import { AxeBuilder } from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { startInDemo } from './helpers.ts'

/** The Table Arrangement tab of Event Layout (D100). */

const ARRANGEMENT = '/events/evt-1/layout?view=arrangement'

test.beforeEach(async ({ page }) => {
  await startInDemo(page)
})

function plan(page: Page) {
  return page.getByRole('group', { name: /^(Floor plan|תוכנית האולם)$/ })
}

function tableOnPlan(page: Page, number: number) {
  return plan(page).getByRole('button', {
    name: new RegExp(`^Table ${number},`),
  })
}

function selectedCard(page: Page) {
  return page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: 'Selected Table' }) })
}

async function expectNoViolations(page: Page) {
  const results = await new AxeBuilder({ page }).analyze()
  expect(
    results.violations.map((violation) => ({
      rule: violation.id,
      elements: violation.nodes.map((node) => node.target.join(' ')),
    })),
  ).toEqual([])
}

async function expectNoSidewaysScroll(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      ),
    )
    .toBe(0)
}

/** A plain picture with a frame, as a PNG. */
async function floorPicture(page: Page): Promise<Buffer> {
  const bytes = await page.evaluate(async () => {
    const canvas = document.createElement('canvas')
    canvas.width = 800
    canvas.height = 600
    const context = canvas.getContext('2d')!
    context.fillStyle = '#dddddd'
    context.fillRect(0, 0, 800, 600)
    context.strokeStyle = '#333333'
    context.lineWidth = 12
    context.strokeRect(40, 40, 720, 520)
    const blob = await new Promise<Blob>((resolve) =>
      canvas.toBlob((made) => resolve(made!), 'image/png'),
    )
    return Array.from(new Uint8Array(await blob.arrayBuffer()))
  })
  return Buffer.from(bytes)
}

test('a table chosen on the plan shows its guests, and a second click lets go', async ({
  page,
}) => {
  await page.goto(ARRANGEMENT)

  await tableOnPlan(page, 3).click()
  await expect(selectedCard(page)).toContainText('Table 3')
  await expect(selectedCard(page)).toContainText('Assigned Guest Parties (2)')
  await expect(tableOnPlan(page, 3)).toHaveAttribute('aria-pressed', 'true')

  await tableOnPlan(page, 3).click()
  await expect(tableOnPlan(page, 3)).toHaveAttribute('aria-pressed', 'false')
  await expect(selectedCard(page)).toContainText(
    'Select a table on the plan to see its guests here.',
  )
})

test('the plan is dragged around and zoomed', async ({ page }) => {
  await page.goto(ARRANGEMENT)
  const svg = plan(page)
  const whole = await svg.getAttribute('viewBox')

  await page.getByRole('button', { name: 'Zoom in' }).click()
  const zoomed = await svg.getAttribute('viewBox')
  expect(zoomed).not.toBe(whole)

  // A drag that starts on the floor moves the view, not a table.
  await svg.scrollIntoViewIfNeeded()
  const box = (await svg.boundingBox())!
  await page.mouse.move(box.x + 12, box.y + 12)
  await page.mouse.down()
  await page.mouse.move(box.x + 80, box.y + 60, { steps: 6 })
  await page.mouse.up()
  expect(await svg.getAttribute('viewBox')).not.toBe(zoomed)

  await page.getByRole('button', { name: 'Show the whole room' }).click()
  await expect(svg).toHaveAttribute('viewBox', whole!)
})

test('an Owner places, moves and adds, lays a floor picture, and the plan survives a reload', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'the layout is edited on a larger screen')
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto(ARRANGEMENT)
  await page.getByRole('button', { name: 'Edit Layout' }).click()
  await expect(page.getByText('Edit Mode')).toBeVisible()

  // Dragged in from the tables not on the plan, both in view.
  await plan(page).evaluate((element) =>
    element.scrollIntoView({ block: 'center' }),
  )
  const box = (await plan(page).boundingBox())!
  await page
    .getByRole('button', { name: 'Place Table 18 on the plan' })
    .dragTo(plan(page), {
      targetPosition: { x: box.width * 0.8, y: box.height * 0.75 },
    })
  await expect(tableOnPlan(page, 18)).toBeVisible()
  await expect(page.getByText('Every table is on the plan.')).toBeVisible()

  // Moved with the mouse, to the right and down.
  await tableOnPlan(page, 1).click()
  const left = Number(await page.getByLabel('From the left (m)').inputValue())
  const top = Number(await page.getByLabel('From the top (m)').inputValue())
  const table = (await tableOnPlan(page, 1).boundingBox())!
  const start = {
    x: table.x + table.width / 2,
    y: table.y + table.height / 2,
  }
  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  await page.mouse.move(start.x + 40, start.y + 30, { steps: 8 })
  await page.mouse.up()
  expect(
    Number(await page.getByLabel('From the left (m)').inputValue()),
  ).toBeGreaterThan(left)
  expect(
    Number(await page.getByLabel('From the top (m)').inputValue()),
  ).toBeGreaterThan(top)

  await page.getByRole('button', { name: 'Add Plant' }).click()
  await page.getByLabel('Label').fill('Olive tree')

  // The floor picture, from the room's settings.
  await page.getByRole('button', { name: 'Room and Picture' }).click()
  await page.getByTestId('floor-picture-file').setInputFiles({
    name: 'floor.png',
    mimeType: 'image/png',
    buffer: await floorPicture(page),
  })
  await expect(
    page.getByRole('button', { name: 'Replace Picture' }),
  ).toBeVisible()
  await page.getByLabel('Transparency').fill('20')
  await page.getByLabel('Zoom', { exact: true }).fill('150')
  await page.getByLabel('Rotate').fill('-10')

  await page.getByRole('button', { name: 'Save Layout' }).click()
  await expect(page.getByText('The floor plan was saved.')).toBeVisible()

  await page.reload()
  const image = plan(page).locator('image')
  await expect(image).toHaveAttribute('opacity', '0.8')
  await expect(image).toHaveAttribute(
    'transform',
    /rotate\(-10\) scale\(1\.5\)/,
  )
  await expect(tableOnPlan(page, 18)).toBeVisible()
  await expect(
    plan(page).getByRole('img', { name: 'Olive tree' }),
  ).toBeVisible()
})

test('leaving with unsaved changes asks first', async ({ page, isMobile }) => {
  test.skip(isMobile, 'the layout is edited on a larger screen')
  await page.goto(ARRANGEMENT)
  await page.getByRole('button', { name: 'Edit Layout' }).click()
  await tableOnPlan(page, 4).focus()
  await page.keyboard.press('ArrowRight')

  await page.getByRole('tab', { name: 'Tables' }).click()

  await expect(
    page.getByRole('dialog', { name: 'Leave without saving?' }),
  ).toBeVisible()
})

test('a phone shows the plan only, with fullscreen and the tapped table below it', async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, 'the phone layout')
  await page.goto(ARRANGEMENT)

  await expect(page.getByText('View Mode')).toBeVisible()
  await expect(
    page.getByText('Edit the layout on a larger screen.'),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: 'Edit Layout' })).toHaveCount(0)

  await tableOnPlan(page, 4).tap()
  await expect(selectedCard(page)).toContainText('Table 4')

  await page.getByRole('button', { name: 'Fullscreen' }).click()
  const frame = plan(page).locator('..')
  await expect
    .poll(async () => (await frame.boundingBox())?.height ?? 0)
    .toBeGreaterThan(page.viewportSize()!.height * 0.9)
  await page.getByRole('button', { name: 'Exit fullscreen' }).click()
  await expectNoSidewaysScroll(page)
})

for (const language of ['en', 'he'] as const) {
  test(`the tab has no accessibility violations and fits the screen in ${language}`, async ({
    page,
    isMobile,
  }) => {
    await page.addInitScript((value) => {
      window.localStorage.setItem('event-planner.language', value)
    }, language)
    await page.goto(ARRANGEMENT)
    await expect(plan(page)).toBeVisible()
    // The plan is never mirrored.
    await expect(plan(page).locator('..')).toHaveAttribute('dir', 'ltr')

    await expectNoViolations(page)
    await expectNoSidewaysScroll(page)

    if (!isMobile) {
      await page
        .getByRole('button', {
          name: language === 'he' ? 'עריכת הסידור' : 'Edit Layout',
        })
        .click()
      await plan(page)
        .getByRole('button', { name: /^(Table|שולחן) 1,/ })
        .click()
      await expectNoViolations(page)
      await page.setViewportSize({ width: 1440, height: 900 })
      await expectNoSidewaysScroll(page)
    }
  })
}
