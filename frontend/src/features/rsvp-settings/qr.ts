import qrcode from 'qrcode-generator'
import { downloadBlob } from '../../shared/download.ts'

/** Empty modules kept around the code so that scanners can find it. */
const QUIET_ZONE = 4

export interface QrDrawing {
  /** Modules along one side, including the quiet zone. */
  size: number
  /** The dark modules, as an SVG path of unit squares. */
  path: string
}

/** The QR code of a text, such as the public RSVP address. */
export function drawQr(text: string): QrDrawing {
  const qr = qrcode(0, 'M')
  qr.addData(text)
  qr.make()
  const count = qr.getModuleCount()
  let path = ''
  for (let row = 0; row < count; row += 1) {
    for (let column = 0; column < count; column += 1) {
      if (qr.isDark(row, column)) {
        path += `M${column + QUIET_ZONE} ${row + QUIET_ZONE}h1v1h-1z`
      }
    }
  }
  return { size: count + QUIET_ZONE * 2, path }
}

/** Saves the code as a picture large enough to print. */
export function downloadQr(drawing: QrDrawing, fileName: string): void {
  const scale = Math.ceil(1024 / drawing.size)
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = drawing.size * scale
  const context = canvas.getContext('2d')
  if (!context) {
    return
  }
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.fillStyle = '#000000'
  context.scale(scale, scale)
  context.fill(new Path2D(drawing.path))
  canvas.toBlob((blob) => {
    if (blob) {
      downloadBlob(blob, fileName)
    }
  }, 'image/png')
}
