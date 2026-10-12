import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import type { ReactNode } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { routes } from '../app/routes.tsx'
import type { Services } from '../services/contracts/index.ts'
import {
  createMockServices,
  type MockOptions,
} from '../services/mock/mockServices.ts'
import { createMemoryPersistence } from '../services/mock/persistence.ts'
import { ServicesContext } from '../services/servicesContext.ts'
import { ToastProvider } from '../shared/ui/ToastProvider.tsx'

/** The moment the demo dataset is generated at in tests. */
export const TEST_NOW = new Date('2026-10-12T09:00:00.000Z')

/** Events of the demo dataset, by the signed-in user's role and state. */
export const DEMO_EVENTS = {
  owner: 'evt-1',
  hebrew: 'evt-2',
  admin: 'evt-3',
  viewer: 'evt-4',
  past: 'evt-5',
} as const

export function createTestServices(
  options: Partial<MockOptions> = {},
): Services {
  return createMockServices({
    persistence: createMemoryPersistence(),
    now: () => TEST_NOW,
    ...options,
  })
}

export function AppProviders({
  services,
  children,
}: {
  services: Services
  children: ReactNode
}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return (
    <QueryClientProvider client={queryClient}>
      <ServicesContext.Provider value={services}>
        <ToastProvider>{children}</ToastProvider>
      </ServicesContext.Provider>
    </QueryClientProvider>
  )
}

/** Renders the application's real route table at an address, on demo data. */
export function renderApp(
  path: string,
  services: Services = createTestServices(),
) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  const view = render(
    <AppProviders services={services}>
      <RouterProvider router={router} />
    </AppProviders>,
  )
  return { ...view, router, services }
}
