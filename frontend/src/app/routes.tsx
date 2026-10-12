import { Navigate, type RouteObject } from 'react-router'
import { DashboardPage } from '../features/dashboard/DashboardPage.tsx'
import { EventLayoutPage } from '../features/event-layout/EventLayoutPage.tsx'
import { EventSettingsPage } from '../features/event-settings/EventSettingsPage.tsx'
import { EventsPage } from '../features/events/EventsPage.tsx'
import { GuestsPage } from '../features/guests/GuestsPage.tsx'
import { MessagesPage } from '../features/messages/MessagesPage.tsx'
import { PermissionsPage } from '../features/permissions/PermissionsPage.tsx'
import { PublicRsvpPage } from '../features/public-rsvp/PublicRsvpPage.tsx'
import { RsvpSettingsPage } from '../features/rsvp-settings/RsvpSettingsPage.tsx'
import { NotFoundPage } from '../shared/NotFoundPage.tsx'
import { RouteError } from '../shared/RouteError.tsx'
import { EventLayout } from './EventLayout.tsx'

export const routes: RouteObject[] = [
  {
    errorElement: <RouteError />,
    children: [
      { path: '/', element: <EventsPage /> },
      {
        path: '/events/:eventId',
        element: <EventLayout />,
        children: [
          { index: true, element: <Navigate to="dashboard" replace /> },
          { path: 'dashboard', element: <DashboardPage /> },
          { path: 'guests', element: <GuestsPage /> },
          { path: 'messages', element: <MessagesPage /> },
          { path: 'rsvp', element: <RsvpSettingsPage /> },
          { path: 'layout', element: <EventLayoutPage /> },
          { path: 'settings', element: <EventSettingsPage /> },
          { path: 'permissions', element: <PermissionsPage /> },
        ],
      },
      { path: '/rsvp/:rsvpId', element: <PublicRsvpPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]
