/** Hands a generated file to the browser to save. Nothing leaves the device. */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.append(link)
  link.click()
  link.remove()
  // Give the browser a moment to start the download before the data is freed.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** A file name without characters that file systems reject. */
export function safeFileName(name: string): string {
  const cleaned = Array.from(name)
    .map((character) =>
      '\\/:*?"<>|'.includes(character) || character < ' ' ? ' ' : character,
    )
    .join('')
    .replace(/\s+/g, ' ')
    .trim()
  return cleaned === '' ? 'export' : cleaned.slice(0, 80)
}
