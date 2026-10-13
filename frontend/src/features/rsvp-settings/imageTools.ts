import { BACKGROUND_IMAGE_MAX_LENGTH } from '../../domain/rsvpSettings.ts'

export const IMAGE_MAX_BYTES = 5 * 1024 * 1024
export const IMAGE_TYPES = ['image/jpeg', 'image/png']

export type ImageProblem = 'type' | 'size' | 'failed'

/** Why a chosen file cannot be used as it is, if it cannot. */
export function checkImageFile(
  file: Pick<File, 'type' | 'size'>,
): ImageProblem | null {
  if (!IMAGE_TYPES.includes(file.type)) {
    return 'type'
  }
  return file.size > IMAGE_MAX_BYTES ? 'size' : null
}

// Tried in order until the picture is small enough to keep.
const ATTEMPTS = [
  { side: 1600, quality: 0.8 },
  { side: 1280, quality: 0.7 },
  { side: 960, quality: 0.6 },
]

/**
 * Reduces a picture to what a phone-sized background needs and returns it as
 * a JPEG data address. The picture is processed in the browser and goes
 * nowhere else. Rejects when it cannot be read or made small enough.
 */
export async function shrinkImage(file: Blob): Promise<string> {
  const bitmap = await createImageBitmap(file)
  try {
    for (const { side, quality } of ATTEMPTS) {
      const scale = Math.min(1, side / Math.max(bitmap.width, bitmap.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(bitmap.width * scale)
      canvas.height = Math.round(bitmap.height * scale)
      const context = canvas.getContext('2d')
      if (!context) {
        break
      }
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
      const data = canvas.toDataURL('image/jpeg', quality)
      if (data.length <= BACKGROUND_IMAGE_MAX_LENGTH) {
        return data
      }
    }
  } finally {
    bitmap.close()
  }
  throw new Error('The image could not be made small enough')
}
