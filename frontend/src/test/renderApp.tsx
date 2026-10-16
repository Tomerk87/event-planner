import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import type { ReactNode } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { routes } from '../app/routes.tsx'
import { SessionProvider } from '../app/session/SessionProvider.tsx'
import type { Backend, Services, Session } from '../services/contracts/index.ts'
import { combineBackends } from '../services/createServices.ts'
import {
  createDemoBackend,
  type DemoBackendOptions,
} from '../services/mock/mockBackend.ts'
import {
  createMockServices,
  type MockOptions,
} from '../services/mock/mockServices.ts'
import { createMemoryPersistence } from '../services/mock/persistence.ts'
import { ToastProvider } from '../shared/ui/ToastProvider.tsx'
import { createFakeAccountBackend } from './fakeAccountBackend.ts'

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

export type TestSession = 'demo' | 'none'

/**
 * The application's backend for tests: the demo, and an in-memory stand-in
 * for the real accounts server. By default the demo is already open, so
 * pages inside the application can be rendered directly.
 */
export function createTestBackend(
  options: {
    services?: Services
    session?: TestSession
    demoAvailable?: boolean
    /** Null for a demo-only site, which has no accounts (D102). */
    accounts?: ReturnType<typeof createFakeAccountBackend> | null
  } & Partial<DemoBackendOptions> = {},
): Backend {
  const {
    services,
    session = 'demo',
    demoAvailable = true,
    accounts = createFakeAccountBackend({ now: () => TEST_NOW }),
    ...rest
  } = options
  const demo = createDemoBackend({
    demoPersistence: createMemoryPersistence(),
    sessionPersistence:
      session === 'demo'
        ? createMemoryPersistence<Session>({ workspace: 'demo' })
        : createMemoryPersistence<Session>(),
    now: () => TEST_NOW,
    demoServices: services,
    ...rest,
  })
  return combineBackends(demoAvailable ? demo : null, accounts)
}

export function AppProviders({
  backend,
  children,
}: {
  backend: Backend
  children: ReactNode
}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider backend={backend}>
        <ToastProvider>{children}</ToastProvider>
      </SessionProvider>
    </QueryClientProvider>
  )
}

/**
 * Renders the application's real route table at an address. With no further
 * arguments the visitor is inside the demo; pass `session: 'none'` to start
 * signed out.
 */
export function renderApp(
  path: string,
  services: Services = createTestServices(),
  options: { session?: TestSession; backend?: Backend } = {},
) {
  const backend =
    options.backend ?? createTestBackend({ services, session: options.session })
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  const view = render(
    <AppProviders backend={backend}>
      <RouterProvider router={router} />
    </AppProviders>,
  )
  return { ...view, router, services, backend }
}
