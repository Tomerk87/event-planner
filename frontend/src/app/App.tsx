import { createBrowserRouter, RouterProvider } from 'react-router'
import { routes } from './routes.tsx'

const router = createBrowserRouter(routes)

export function App() {
  return <RouterProvider router={router} />
}
