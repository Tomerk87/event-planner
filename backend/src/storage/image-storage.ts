import { Inject, Injectable } from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { APP_CONFIG, type AppConfig } from '../config.ts'
import { DomainError } from '../domain/errors.ts'

const TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png' } as const
type ImageType = keyof typeof TYPES
const KEY_PATTERN = /^[0-9a-f-]{36}\.(jpg|png)$/

/** Address at which a stored image is served (see FilesController). */
export function imageUrl(key: string): string {
  return `/api/files/${key}`
}

/**
 * Keeps uploaded pictures (event photos, RSVP backgrounds) outside the
 * database. This implementation writes to a local directory, mounted as a
 * persistent volume in production; business code depends only on the key it
 * returns, so object storage can replace it later.
 */
@Injectable()
export class ImageStorage {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  /** Stores a `data:image/...;base64,` picture and returns its key. */
  async saveDataUrl(dataUrl: string): Promise<string> {
    const match = /^data:(image\/(?:jpeg|png));base64,(.+)$/.exec(dataUrl)
    if (!match) {
      throw new DomainError('VALIDATION', { field: 'image' })
    }
    const type = match[1] as ImageType
    const key = `${randomUUID()}.${TYPES[type]}`
    await mkdir(this.directory(), { recursive: true })
    await writeFile(this.pathOf(key), Buffer.from(match[2] ?? '', 'base64'))
    return key
  }

  /** A copy under a new key, so either can be removed on its own. */
  async copy(key: string): Promise<string> {
    const { bytes } = await this.read(key)
    const copy = `${randomUUID()}.${path.extname(key).slice(1)}`
    await writeFile(this.pathOf(copy), bytes)
    return copy
  }

  async read(key: string): Promise<{ bytes: Buffer; contentType: string }> {
    if (!KEY_PATTERN.test(key)) {
      throw new DomainError('NOT_FOUND', { entity: 'file' })
    }
    try {
      const bytes = await readFile(this.pathOf(key))
      return {
        bytes,
        contentType: key.endsWith('.png') ? 'image/png' : 'image/jpeg',
      }
    } catch {
      throw new DomainError('NOT_FOUND', { entity: 'file' })
    }
  }

  async remove(key: string | null): Promise<void> {
    if (key && KEY_PATTERN.test(key)) {
      await rm(this.pathOf(key), { force: true })
    }
  }

  private directory(): string {
    return path.resolve(this.config.uploadDir)
  }

  private pathOf(key: string): string {
    return path.join(this.directory(), key)
  }
}
