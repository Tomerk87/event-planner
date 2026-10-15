import { Navigate, type RouteObject } from 'react-router'
import { DashboardPage } from '../features/dashboard/DashboardPage.tsx'
import { EventLayoutPage } from '../features/event-layout/EventLayoutPage.tsx'
import { EventSettingsPage } from '../features/event-settings/EventSettingsPage.tsx'
import { ForgotPasswordPage } from '../features/auth/ForgotPasswordPage.tsx'
import { ResetPasswordPage } from '../features/auth/ResetPasswordPage.tsx'
import { SignInPage } from '../features/auth/SignInPage.tsx'
import { SignUpPage } from '../features/auth/SignUpPage.tsx'
import { VerifyEmailPage } from '../features/auth/VerifyEmailPage.tsx'
import { EventsPage } from '../features/events/EventsPage.tsx'
import { GuestsPage } from '../features/guests/GuestsPage.tsx'
import { LandingPage } from '../features/landing/LandingPage.tsx'
import { MessagesPage } from '../features/messages/MessagesPage.tsx'
import { PermissionsPage } from '../features/permissions/PermissionsPage.tsx'
import { PublicRsvpPage } from '../features/public-rsvp/PublicRsvpPage.tsx'
import { RsvpSettingsPage } from '../features/rsvp-settings/RsvpSettingsPage.tsx'
import { SystemPage } from '../features/system/SystemPage.tsx'
import { NotFoundPage } from '../shared/NotFoundPage.tsx'
import { RouteError } from '../shared/RouteError.tsx'
import { EventLayout } from './EventLayout.tsx'
import { HomeLayout } from './HomeLayout.tsx'
import { RouteFocus } from './RouteFocus.tsx'
import { RequireSession, SignedOutOnly } from './session/guards.tsx'

export const routes: RouteObject[] = [
  {
    element: <RouteFocus />,
    errorElement: <RouteError />,
    children: [
      {
        element: <SignedOutOnly />,
        children: [
          { path: '/', element: <LandingPage /> },
          { path: '/signin', element: <SignInPage /> },
          { path: '/signup', element: <SignUpPage /> },
          { path: '/forgot-password', element: <ForgotPasswordPage /> },
        ],
      },
      {
        element: <RequireSession />,
        children: [
          {
            element: <HomeLayout />,
            children: [
              { path: '/events', element: <EventsPage /> },
              { path: '/system', element: <SystemPage /> },
            ],
          },
          {
            path: '/events/:eventId',
            element: <EventLayout />,
            children: [
              { index: true, element: <Navigate to="dashboard" replace /> },
              { path: 'dashboard', element: <DashboardPage /> },
              { path: 'guests', element: <GuestsPage /> },
              { path: 'rsvp', element: <RsvpSettingsPage /> },
              { path: 'messages', element: <MessagesPage /> },
              { path: 'layout', element: <EventLayoutPage /> },
              { path: 'settings', element: <EventSettingsPage /> },
              { path: 'permissions', element: <PermissionsPage /> },
            ],
          },
        ],
      },
      { path: '/rsvp/:rsvpId', element: <PublicRsvpPage /> },
      // Email links work signed in or not, on any device (D88).
      { path: '/verify-email', element: <VerifyEmailPage /> },
      { path: '/reset-password', element: <ResetPasswordPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]
