export const LANGUAGES = ['en', 'he'] as const

export type Language = (typeof LANGUAGES)[number]

export type Direction = 'ltr' | 'rtl'

export const DEFAULT_LANGUAGE: Language = 'en'

const RTL_LANGUAGES: readonly Language[] = ['he']

export function isLanguage(value: unknown): value is Language {
  return (LANGUAGES as readonly unknown[]).includes(value)
}

export function getDirection(language: Language): Direction {
  return RTL_LANGUAGES.includes(language) ? 'rtl' : 'ltr'
}
