import { Navigate, type RouteObject } from 'react-router'
import { NotFoundPage } from '../shared/NotFoundPage.tsx'
import { RouteError } from '../shared/RouteError.tsx'
import { LoadingState } from '../shared/ui/States.tsx'
import { EventLayout } from './EventLayout.tsx'
import { HomeLayout } from './HomeLayout.tsx'
import { RouteFocus } from './RouteFocus.tsx'
import {
  AccountsOnly,
  RequireSession,
  SignedOutOnly,
} from './session/guards.tsx'

// Each page is its own file, downloaded when first opened, so a guest
// answering an RSVP does not download the organizer's pages.
export const routes: RouteObject[] = [
  {
    element: <RouteFocus />,
    errorElement: <RouteError />,
    // Shown while the first page opened is downloaded.
    HydrateFallback: LoadingState,
    children: [
      {
        element: <SignedOutOnly />,
        children: [
          {
            path: '/',
            lazy: async () => ({
              Component: (await import('../features/landing/LandingPage.tsx'))
                .LandingPage,
            }),
          },
          {
            element: <AccountsOnly />,
            children: [
              {
                path: '/signin',
                lazy: async () => ({
                  Component: (await import('../features/auth/SignInPage.tsx'))
                    .SignInPage,
                }),
              },
              {
                path: '/signup',
                lazy: async () => ({
                  Component: (await import('../features/auth/SignUpPage.tsx'))
                    .SignUpPage,
                }),
              },
              {
                path: '/forgot-password',
                lazy: async () => ({
                  Component: (
                    await import('../features/auth/ForgotPasswordPage.tsx')
                  ).ForgotPasswordPage,
                }),
              },
            ],
          },
        ],
      },
      {
        element: <RequireSession />,
        children: [
          {
            element: <HomeLayout />,
            children: [
              {
                path: '/events',
                lazy: async () => ({
                  Component: (await import('../features/events/EventsPage.tsx'))
                    .EventsPage,
                }),
              },
              {
                element: <AccountsOnly />,
                children: [
                  {
                    path: '/system',
                    lazy: async () => ({
                      Component: (
                        await import('../features/system/SystemPage.tsx')
                      ).SystemPage,
                    }),
                  },
                ],
              },
            ],
          },
          {
            path: '/events/:eventId',
            element: <EventLayout />,
            children: [
              { index: true, element: <Navigate to="dashboard" replace /> },
              {
                path: 'dashboard',
                lazy: async () => ({
                  Component: (
                    await import('../features/dashboard/DashboardPage.tsx')
                  ).DashboardPage,
                }),
              },
              {
                path: 'guests',
                lazy: async () => ({
                  Component: (await import('../features/guests/GuestsPage.tsx'))
                    .GuestsPage,
                }),
              },
              {
                path: 'rsvp',
                lazy: async () => ({
                  Component: (
                    await import('../features/rsvp-settings/RsvpSettingsPage.tsx')
                  ).RsvpSettingsPage,
                }),
              },
              {
                path: 'messages',
                lazy: async () => ({
                  Component: (
                    await import('../features/messages/MessagesPage.tsx')
                  ).MessagesPage,
                }),
              },
              {
                path: 'layout',
                lazy: async () => ({
                  Component: (
                    await import('../features/event-layout/EventLayoutPage.tsx')
                  ).EventLayoutPage,
                }),
              },
              {
                path: 'settings',
                lazy: async () => ({
                  Component: (
                    await import('../features/event-settings/EventSettingsPage.tsx')
                  ).EventSettingsPage,
                }),
              },
              {
                path: 'permissions',
                lazy: async () => ({
                  Component: (
                    await import('../features/permissions/PermissionsPage.tsx')
                  ).PermissionsPage,
                }),
              },
            ],
          },
        ],
      },
      {
        path: '/rsvp/:rsvpId',
        lazy: async () => ({
          Component: (
            await import('../features/public-rsvp/PublicRsvpPage.tsx')
          ).PublicRsvpPage,
        }),
      },
      // Email links work signed in or not, on any device (D88).
      {
        element: <AccountsOnly />,
        children: [
          {
            path: '/verify-email',
            lazy: async () => ({
              Component: (await import('../features/auth/VerifyEmailPage.tsx'))
                .VerifyEmailPage,
            }),
          },
          {
            path: '/reset-password',
            lazy: async () => ({
              Component: (
                await import('../features/auth/ResetPasswordPage.tsx')
              ).ResetPasswordPage,
            }),
          },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]
