import '@testing-library/jest-dom/vitest'
import { cleanup, configure } from '@testing-library/react'
import { afterEach, vi } from 'vitest'
import { changeLanguage, initI18n, loadLanguage } from '../i18n/i18n.ts'
import { installMatchMedia, resetViewportWidth } from './matchMedia.ts'

await initI18n()
// Every language's texts are here from the start, as after a visitor's first
// switch, so a page in another language renders at once.
await Promise.all([loadLanguage('he'), loadLanguage('pt')])
installMatchMedia()
// Pages load on first visit (routes.tsx); a busy test run can take more than
// the default second to load one.
configure({ asyncUtilTimeout: 3000 })

// jsdom does not implement the modal methods of <dialog>.
HTMLDialogElement.prototype.showModal = function showModal() {
  this.setAttribute('open', '')
}
HTMLDialogElement.prototype.close = function close() {
  this.removeAttribute('open')
  this.dispatchEvent(new Event('close'))
}

afterEach(async () => {
  cleanup()
  resetViewportWidth()
  document.title = ''
  vi.restoreAllMocks()
  await changeLanguage('en')
  window.localStorage.clear()
})
