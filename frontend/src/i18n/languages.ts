export const LANGUAGES = ['en', 'he', 'pt'] as const

export type Language = (typeof LANGUAGES)[number]

export type Direction = 'ltr' | 'rtl'

export const DEFAULT_LANGUAGE: Language = 'en'

const RTL_LANGUAGES: readonly Language[] = ['he']

/** The locale each language formats dates, numbers and lists in. */
export const LOCALES: Record<Language, string> = {
  en: 'en-US',
  he: 'he-IL',
  pt: 'pt-BR',
}

export function isLanguage(value: unknown): value is Language {
  return (LANGUAGES as readonly unknown[]).includes(value)
}

export function getDirection(language: Language): Direction {
  return RTL_LANGUAGES.includes(language) ? 'rtl' : 'ltr'
}

/**
 * The language a first visit opens in, from the browser's preferred
 * languages ("pt-BR" and "pt" give Portuguese, "he" and the older "iw"
 * Hebrew); English when none of them is offered.
 */
export function detectLanguage(preferred: readonly string[]): Language {
  for (const tag of preferred) {
    const base = tag.toLowerCase().split('-')[0]
    const language = base === 'iw' ? 'he' : base
    if (isLanguage(language)) {
      return language
    }
  }
  return DEFAULT_LANGUAGE
}
