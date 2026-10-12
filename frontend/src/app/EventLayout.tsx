import { NavLink, Outlet } from 'react-router'

const eventNavItems = [
  { to: 'dashboard', label: 'Dashboard' },
  { to: 'guests', label: 'Guests' },
  { to: 'messages', label: 'Messages' },
  { to: 'rsvp', label: 'RSVP' },
  { to: 'layout', label: 'Event Layout' },
  { to: 'settings', label: 'Event Settings' },
  { to: 'permissions', label: 'Permissions' },
]

export function EventLayout() {
  return (
    <>
      <nav aria-label="Event">
        <ul>
          {eventNavItems.map((item) => (
            <li key={item.to}>
              <NavLink to={item.to}>{item.label}</NavLink>
            </li>
          ))}
          <li>
            <NavLink to="/">Back to My Events</NavLink>
          </li>
        </ul>
      </nav>
      <Outlet />
    </>
  )
}
