import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { createBrowserRouter, RouterProvider } from 'react-router'
import type { Backend } from '../services/contracts/index.ts'
import { createServices } from '../services/createServices.ts'
import { parseDataProvider } from '../services/providerConfig.ts'
import styles from '../shared/StandalonePage.module.css'
import { Card } from '../shared/ui/Card.tsx'
import { ErrorState } from '../shared/ui/States.tsx'
import { ToastProvider } from '../shared/ui/ToastProvider.tsx'
import { useDocumentTitle } from '../shared/useDocumentTitle.ts'
import { routes } from './routes.tsx'
import { SessionProvider } from './session/SessionProvider.tsx'

const router = createBrowserRouter(routes)

// Data is local and changes only through mutations, which invalidate what
// they affect, so nothing is retried or refetched on its own.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false, refetchOnWindowFocus: false },
  },
})

/** The data provider for this deployment, or null if it cannot be created. */
function createAppBackend(): Backend | null {
  try {
    return createServices(
      parseDataProvider(import.meta.env.VITE_DATA_PROVIDER),
      window.location,
      window.localStorage,
    )
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
