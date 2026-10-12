import { render, screen } from '@testing-library/react'
import { useTranslation } from 'react-i18next'
import { describe, expect, it } from 'vitest'
import { changeLanguage, getCurrentLanguage } from './i18n.ts'
import { readStoredLanguage, storeLanguage } from './languageStorage.ts'
import { getDirection, isLanguage } from './languages.ts'
import { LocaleScope } from './LocaleScope.tsx'
import en from './locales/en.json'
import he from './locales/he.json'

function collectKeys(value: object, prefix = ''): string[] {
  return Object.entries(value).flatMap(([key, child]) =>
    typeof child === 'object' && child !== null
      ? collectKeys(child, `${prefix}${key}.`)
      : [`${prefix}${key}`],
  )
}

function PageTitle() {
  const { t } = useTranslation()
  return <p>{t('pages.guests')}</p>
}

describe('languages', () => {
  it('maps each language to its direction', () => {
    expect(getDirection('en')).toBe('ltr')
    expect(getDirection('he')).toBe('rtl')
  })

  it('recognises only supported languages', () => {
    expect(isLanguage('he')).toBe(true)
    expect(isLanguage('fr')).toBe(false)
    expect(isLanguage(null)).toBe(false)
  })

  it('has the same translation keys in English and Hebrew', () => {
    expect(collectKeys(he).sort()).toEqual(collectKeys(en).sort())
  })
})

describe('interface language', () => {
  it('starts in English, left to right', () => {
    expect(getCurrentLanguage()).toBe('en')
    expect(document.documentElement).toHaveAttribute('lang', 'en')
    expect(document.documentElement).toHaveAttribute('dir', 'ltr')
  })

  it('switches the document to Hebrew, right to left', async () => {
    render(<PageTitle />)
    expect(screen.getByText('Guests')).toBeInTheDocument()

    await changeLanguage('he')

    expect(await screen.findByText('אורחים')).toBeInTheDocument()
    expect(document.documentElement).toHaveAttribute('lang', 'he')
    expect(document.documentElement).toHaveAttribute('dir', 'rtl')
  })

  it('remembers the chosen language', async () => {
    expect(readStoredLanguage()).toBeNull()

    await changeLanguage('he')

    expect(readStoredLanguage()).toBe('he')
  })

  it('ignores an unsupported stored value', () => {
    window.localStorage.setItem('event-planner.language', 'fr')

    expect(readStoredLanguage()).toBeNull()
  })

  it('keeps working when storage is unavailable', () => {
    const getItem = Storage.prototype.getItem
    const setItem = Storage.prototype.setItem
    Storage.prototype.getItem = () => {
      throw new Error('blocked')
    }
    Storage.prototype.setItem = () => {
      throw new Error('blocked')
    }
    try {
      expect(readStoredLanguage()).toBeNull()
      expect(() => storeLanguage('he')).not.toThrow()
    } finally {
      Storage.prototype.getItem = getItem
      Storage.prototype.setItem = setItem
    }
  })
})

describe('LocaleScope', () => {
  it('renders guest-facing content in the event language, not the interface language', () => {
    render(
      <>
        <PageTitle />
        <LocaleScope language="he">
          <PageTitle />
        </LocaleScope>
      </>,
    )

    expect(screen.getByText('Guests')).toBeInTheDocument()
    const scoped = screen.getByText('אורחים')
    expect(scoped.closest('[dir]')).toHaveAttribute('dir', 'rtl')
    expect(scoped.closest('[lang]')).toHaveAttribute('lang', 'he')
    expect(document.documentElement).toHaveAttribute('dir', 'ltr')
  })

  it('stays in its language when the interface language changes', async () => {
    render(
      <LocaleScope language="en">
        <PageTitle />
      </LocaleScope>,
    )

    await changeLanguage('he')

    expect(screen.getByText('Guests')).toBeInTheDocument()
  })
})
