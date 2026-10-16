import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { I18nextProvider, useTranslation } from 'react-i18next'
import { LoadingState } from '../shared/ui/States.tsx'
import { isLanguageLoaded, loadLanguage } from './i18n.ts'
import { getDirection, type Language } from './languages.ts'

interface LocaleScopeProps {
  language: Language
  children: ReactNode
}

/**
 * Renders its children in a fixed language and direction, independent of the
 * interface language. Used for guest-facing content, whose language is fixed
 * per event.
 */
export function LocaleScope({ language, children }: LocaleScopeProps) {
  const { i18n } = useTranslation()
  // The language whose download finished, or failed; either way its
  // content can show (in English where its texts are missing).
  const [settled, setSettled] = useState<Language | null>(null)
  // The clone shares the texts store, so texts that arrive later reach it.
  const scoped = useMemo(
    () => i18n.cloneInstance({ lng: language }),
    [i18n, language],
  )

  // The language's texts are downloaded on first use (i18n.ts).
  useEffect(() => {
    if (isLanguageLoaded(language)) {
      return
    }
    let current = true
    void loadLanguage(language)
      .catch(() => undefined)
      .finally(() => {
        if (current) {
          setSettled(language)
        }
      })
    return () => {
      current = false
    }
  }, [language])

  if (!isLanguageLoaded(language) && settled !== language) {
    return <LoadingState />
  }

  return (
    <I18nextProvider i18n={scoped}>
      <div lang={language} dir={getDirection(language)}>
        {children}
      </div>
    </I18nextProvider>
  )
}
