/**
 * Opens an address outside the application, in a new tab or the matching
 * app. Call it directly from a click, or the browser may block it.
 */
export function openExternal(url: string): void {
  window.open(url, '_blank', 'noopener,noreferrer')
}
