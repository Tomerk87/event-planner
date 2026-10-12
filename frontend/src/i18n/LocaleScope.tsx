import { useMemo, type ReactNode } from 'react'
import { I18nextProvider, useTranslation } from 'react-i18next'
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
  const scoped = useMemo(
    () => i18n.cloneInstance({ lng: language }),
    [i18n, language],
  )

  return (
    <I18nextProvider i18n={scoped}>
      <div lang={language} dir={getDirection(language)}>
        {children}
      </div>
    </I18nextProvider>
  )
}
