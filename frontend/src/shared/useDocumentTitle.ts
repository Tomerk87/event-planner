import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

/** Sets the browser tab title to "<page> · <application name>". */
export function useDocumentTitle(pageTitle: string): void {
  const { t } = useTranslation()
  const appName = t('app.name')

  useEffect(() => {
    document.title = `${pageTitle} · ${appName}`
  }, [pageTitle, appName])
}
