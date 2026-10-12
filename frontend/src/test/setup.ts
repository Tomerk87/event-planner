import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'
import { changeLanguage, initI18n } from '../i18n/i18n.ts'
import { installMatchMedia, resetViewportWidth } from './matchMedia.ts'

initI18n()
installMatchMedia()

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
