import { expect, test, type Page } from '@playwright/test'
import { chooseOption, startInDemo } from './helpers.ts'

/**
 * Brazilian Portuguese and Brazil's sample events (D103): a visitor whose
 * browser prefers Portuguese gets the application and the demo in Portuguese,
 * with Brazilian events and phone numbers, and every page fits a phone.
 */

test.use({ locale: 'pt-BR' })

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

test('a first visit in Portuguese opens in Portuguese, and Try Demo gives Brazil’s events', async ({
  page,
}) => {
  await page.goto('/')
  await expect(
    page.getByRole('heading', { level: 1, name: /Planeje cada convidado/ }),
  ).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('lang', 'pt')

  await page
    .getByRole('main')
    .getByRole('button', { name: 'Experimentar demo' })
    .first()
    .click()
  await expect(page).toHaveURL(/\/events$/)
  await expect(
    page.getByRole('heading', {
      level: 2,
      name: 'Casamento de Mariana & Rafael',
    }),
  ).toBeVisible()

  await page.goto('/events/evt-1/guests')
  await expect(
    page.getByRole('heading', { level: 1, name: 'Convidados' }),
  ).toBeVisible()
  await expect(page.getByText(/^\+55 00 9\d{4}-\d{4}$/).first()).toBeVisible()
})

test('a guest of a Brazilian event answers in Portuguese with a local number, from a browser in English', async ({
  page,
  browser,
}, testInfo) => {
  await startInDemo(page)
  await page.goto('/events/evt-1/guests')
  await page
    .getByRole('button', { name: 'Adicionar convidado' })
    .first()
    .click()
  const dialog = page.getByRole('dialog', { name: 'Adicionar convidado' })
  await dialog.getByLabel(/^Nome/).fill('Joana')
  await dialog.getByLabel(/^Telefone/).fill('(11) 98765-4321')
  await expect(
    dialog.getByText(/Um número brasileiro com DDD, como \(11\) 91234-5678/),
  ).toBeVisible()
  await dialog.getByRole('button', { name: 'Adicionar convidado' }).click()
  await expect(page.getByText('O convidado foi adicionado.')).toBeVisible()
  await page.getByRole('searchbox', { name: 'Buscar convidados' }).fill('Joana')
  await expect(page.getByText('+55 11 98765-4321').first()).toBeVisible()

  await page.goto('/events/evt-1/rsvp')
  const link = new URL(
    await page.getByLabel('Link de confirmação', { exact: true }).inputValue(),
  )

  // Another phone, with its browser in English and no demo of its own.
  const { baseURL, ...device } = testInfo.project.use
  const guest = await browser.newContext({
    ...device,
    baseURL,
    locale: 'en-US',
  })
  const guestPage = await guest.newPage()
  await guestPage.goto(link.pathname)
  await expect(guestPage.getByRole('button', { name: 'Eu vou!' })).toBeVisible()
  await expect(
    guestPage.getByText(
      'De fora do Brasil, comece com + e o código do seu país.',
    ),
  ).toBeVisible()

  await guestPage.getByRole('button', { name: 'Idioma' }).click()
  await guestPage.getByRole('menuitem', { name: 'English' }).click()
  await guestPage.getByRole('textbox', { name: 'Full Name' }).fill('Joana')
  await guestPage
    .getByRole('textbox', { name: 'Phone Number' })
    .fill('11 98765-4321')
  await chooseOption(
    guestPage.getByRole('combobox', { name: 'Number of Attendees' }),
    '2',
  )
  await guestPage.getByRole('button', { name: "I'll be there!" }).click()
  await expect(guestPage.getByText('Attendees confirmed: 2')).toBeVisible()
  await guest.close()
})

const pages = [
  ['Meus eventos', '/events'],
  ['Painel', '/events/evt-1/dashboard'],
  ['Convidados', '/events/evt-1/guests'],
  ['Mesas', '/events/evt-1/layout'],
  ['Mensagens', '/events/evt-1/messages'],
  ['RSVP', '/events/evt-1/rsvp'],
  ['Configurações', '/events/evt-1/settings'],
  ['Permissões', '/events/evt-1/permissions'],
] as const

for (const width of [360, 1280]) {
  test.describe(`every page in Portuguese at ${width}px`, () => {
    test.use({ viewport: { width, height: 800 } })

    test.beforeEach(async ({ page }) => {
      await startInDemo(page)
    })

    for (const [name, path] of pages) {
      test(`${name} fits without scrolling sideways`, async ({ page }) => {
        await page.goto(path)
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

        await expectNoSidewaysScroll(page, `${path} at ${width}px`)
      })
    }
  })
}
