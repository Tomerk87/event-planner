import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { readStoredLanguage, storeLanguage } from './languageStorage.ts'
import {
  DEFAULT_LANGUAGE,
  getDirection,
  isLanguage,
  type Language,
} from './languages.ts'
import en from './locales/en.json'
import he from './locales/he.json'

export const resources = {
  en: { translation: en },
  he: { translation: he },
} as const

function applyDocumentLanguage(language: Language): void {
  document.documentElement.lang = language
  document.documentElement.dir = getDirection(language)
}

export function getCurrentLanguage(): Language {
  return isLanguage(i18n.language) ? i18n.language : DEFAULT_LANGUAGE
}

export async function changeLanguage(language: Language): Promise<void> {
  await i18n.changeLanguage(language)
}

export function initI18n(): typeof i18n {
  if (i18n.isInitialized) {
    return i18n
  }

  const language = readStoredLanguage() ?? DEFAULT_LANGUAGE

  void i18n.use(initReactI18next).init({
    resources,
    lng: language,
    fallbackLng: DEFAULT_LANGUAGE,
    supportedLngs: ['en', 'he'],
    interpolation: { escapeValue: false },
    initAsync: false,
  })

  applyDocumentLanguage(language)
  i18n.on('languageChanged', (next) => {
    if (isLanguage(next)) {
      applyDocumentLanguage(next)
      storeLanguage(next)
    }
  })

  return i18n
}
