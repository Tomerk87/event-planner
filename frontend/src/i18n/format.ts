import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { DEFAULT_LANGUAGE, isLanguage, type Language } from './languages.ts'

const LOCALES: Record<Language, string> = {
  en: 'en-US',
  he: 'he-IL',
}

export function formatNumber(value: number, language: Language): string {
  return new Intl.NumberFormat(LOCALES[language]).format(value)
}

/** A calendar date such as "Jun 15, 2025", in the given time zone. */
export function formatDate(
  date: Date,
  language: Language,
  timeZone?: string,
): string {
  return new Intl.DateTimeFormat(LOCALES[language], {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone,
  }).format(date)
}

/** A 24-hour time such as "18:30", in the given time zone. */
export function formatTime(
  date: Date,
  language: Language,
  timeZone?: string,
): string {
  return new Intl.DateTimeFormat(LOCALES[language], {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone,
  }).format(date)
}

/** Items joined as a sentence would, such as "1, 3 and 7". */
export function formatList(
  items: readonly string[],
  language: Language,
): string {
  return new Intl.ListFormat(LOCALES[language], {
    style: 'long',
    type: 'conjunction',
  }).format(items)
}

export interface Formatters {
  number: (value: number) => string
  list: (items: readonly string[]) => string
  date: (date: Date, timeZone?: string) => string
  time: (date: Date, timeZone?: string) => string
}

/** Formatters bound to the language of the surrounding translation scope. */
export function useFormatters(): Formatters {
  const { i18n } = useTranslation()
  const language = isLanguage(i18n.language) ? i18n.language : DEFAULT_LANGUAGE

  return useMemo(
    () => ({
      number: (value) => formatNumber(value, language),
      list: (items) => formatList(items, language),
      date: (date, timeZone) => formatDate(date, language, timeZone),
      time: (date, timeZone) => formatTime(date, language, timeZone),
    }),
    [language],
  )
}
