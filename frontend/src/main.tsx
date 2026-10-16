import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/base.css'
import { App } from './app/App.tsx'
import { initI18n } from './i18n/i18n.ts'

initI18n()

// After a deploy, a tab opened before it asks for page files the server no
// longer has (routes.tsx loads pages on first visit): load the new version.
window.addEventListener('vite:preloadError', () => window.location.reload())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
