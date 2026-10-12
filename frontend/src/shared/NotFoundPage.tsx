import { Link } from 'react-router'

export function NotFoundPage() {
  return (
    <main>
      <h1>Page not found</h1>
      <p>The address you opened does not match any page.</p>
      <Link to="/">Back to My Events</Link>
    </main>
  )
}
