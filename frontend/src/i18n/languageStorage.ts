import { isLanguage, type Language } from './languages.ts'

const STORAGE_KEY = 'event-planner.language'

// Storage can be unavailable (private mode, blocked site data); the language
// then simply falls back to the default and is not remembered.
export function readStoredLanguage(): Language | null {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY)
    return isLanguage(value) ? value : null
  } catch {
    return null
  }
}

export function storeLanguage(language: Language): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, language)
  } catch {
    return
  }
}
