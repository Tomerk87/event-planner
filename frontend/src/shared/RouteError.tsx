import { Link } from 'react-router'

export function RouteError() {
  return (
    <main role="alert">
      <h1>Something went wrong</h1>
      <p>This page could not be displayed.</p>
      <Link to="/">Back to My Events</Link>
    </main>
  )
}
