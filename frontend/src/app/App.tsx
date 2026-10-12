import { createBrowserRouter, RouterProvider } from 'react-router'
import { ToastProvider } from '../shared/ui/ToastProvider.tsx'
import { routes } from './routes.tsx'

const router = createBrowserRouter(routes)

export function App() {
  return (
    <ToastProvider>
      <RouterProvider router={router} />
    </ToastProvider>
  )
}
