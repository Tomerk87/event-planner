import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { createBrowserRouter, RouterProvider } from 'react-router'
import type { Backend } from '../services/contracts/index.ts'
import { isDomainError } from '../domain/errors.ts'
import { getCurrentLanguage } from '../i18n/i18n.ts'
import { createServices } from '../services/createServices.ts'
import { parseDemoEnabled } from '../services/providerConfig.ts'
import styles from '../shared/StandalonePage.module.css'
import { Card } from '../shared/ui/Card.tsx'
import { ErrorState } from '../shared/ui/States.tsx'
import { ToastProvider } from '../shared/ui/ToastProvider.tsx'
import { useDocumentTitle } from '../shared/useDocumentTitle.ts'
import { routes } from './routes.tsx'
import { SessionProvider } from './session/SessionProvider.tsx'

const router = createBrowserRouter(routes)

// Mutations invalidate what they affect. Returning to the window reloads
// what is shown, so answers given meanwhile (a guest's RSVP) appear. Only a
// service that could not be reached is tried again, once; a refusal is final.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failures, error) =>
        failures < 1 && isDomainError(error, 'UNAVAILABLE'),
      refetchOnWindowFocus: true,
    },
  },
})

/** The data provider for this deployment, or null if it cannot be created. */
function createAppBackend(): Backend | null {
  try {
    return createServices({
      demoEnabled: parseDemoEnabled(import.meta.env.VITE_DEMO_ENABLED),
      location: window.location,
      storage: window.localStorage,
      language: getCurrentLanguage,
    })
  } catch {
    return null
  }
}

const backend = createAppBackend()

function ProviderUnavailable() {
  const { t } = useTranslation()
  useDocumentTitle(t('unavailable.title'))

  return (
    <main className={styles.page}>
      <div className={styles.panel}>
        <Card>
          <ErrorState
            asPageHeading
            title={t('unavailable.title')}
            description={t('unavailable.body')}
          />
        </Card>
      </div>
    </main>
  )
}

export function App() {
  if (!backend) {
    return <ProviderUnavailable />
  }

  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider backend={backend}>
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </SessionProvider>
    </QueryClientProvider>
  )
}
