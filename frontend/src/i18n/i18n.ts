import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { readStoredLanguage, storeLanguage } from './languageStorage.ts'
import {
  DEFAULT_LANGUAGE,
  detectLanguage,
  getDirection,
  isLanguage,
  LANGUAGES,
  type Language,
} from './languages.ts'
import en from './locales/en.json'

type Texts = typeof en

/**
 * English is built in, as the fallback for any missing text; every other
 * language is downloaded the first time it is needed, so each added language
 * does not make every visitor's download larger.
 */
const loaders: Record<Exclude<Language, 'en'>, () => Promise<Texts>> = {
  he: async () => (await import('./locales/he.json')).default,
  pt: async () => (await import('./locales/pt.json')).default,
}

function applyDocumentLanguage(language: Language): void {
  document.documentElement.lang = language
  document.documentElement.dir = getDirection(language)
}

export function getCurrentLanguage(): Language {
  return isLanguage(i18n.language) ? i18n.language : DEFAULT_LANGUAGE
}

/** Whether a language's texts are here, so it can be shown right away. */
export function isLanguageLoaded(language: Language): boolean {
  return language === 'en' || i18n.hasResourceBundle(language, 'translation')
}

/** Downloads a language's texts, once. */
export async function loadLanguage(language: Language): Promise<void> {
  if (isLanguageLoaded(language) || language === 'en') {
    return
  }
  const texts = await loaders[language]()
  i18n.addResourceBundle(language, 'translation', texts, true, true)
}

export async function changeLanguage(language: Language): Promise<void> {
  await loadLanguage(language)
  await i18n.changeLanguage(language)
}

/** The language to open in: the one chosen before, or the browser's. */
function startLanguage(): Language {
  return (
    readStoredLanguage() ??
    detectLanguage(
      typeof navigator === 'undefined' ? [] : (navigator.languages ?? []),
    )
  )
}

/**
 * Starts translation in English, then switches to the visitor's language
 * once its texts have arrived. Await the result before the first render to
 * avoid showing English first.
 */
export async function initI18n(): Promise<typeof i18n> {
  if (i18n.isInitialized) {
    return i18n
  }

  void i18n.use(initReactI18next).init({
    resources: { en: { translation: en } },
    lng: DEFAULT_LANGUAGE,
    fallbackLng: DEFAULT_LANGUAGE,
    supportedLngs: [...LANGUAGES],
    interpolation: { escapeValue: false },
    initAsync: false,
  })

  applyDocumentLanguage(DEFAULT_LANGUAGE)
  i18n.on('languageChanged', (next) => {
    if (isLanguage(next)) {
      applyDocumentLanguage(next)
      storeLanguage(next)
    }
  })

  const language = startLanguage()
  if (language !== DEFAULT_LANGUAGE) {
    try {
      await changeLanguage(language)
    } catch {
      // The texts could not be downloaded: stay in English.
    }
  }
  return i18n
}
