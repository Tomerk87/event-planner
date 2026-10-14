import { Controller, Get, Header, Param, Res } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import type { Response } from 'express'
import { Public } from '../auth/public.decorator.ts'
import { ImageStorage } from './image-storage.ts'

@ApiTags('files')
@Controller('files')
export class FilesController {
  constructor(private readonly storage: ImageStorage) {}

  /**
   * Serves a stored picture. Public, because the RSVP background is shown to
   * guests without an account; keys are random and never listed.
   */
  @Public()
  @Get(':key')
  @Header('Cache-Control', 'public, max-age=31536000, immutable')
  @Header('X-Content-Type-Options', 'nosniff')
  async get(
    @Param('key') key: string,
    @Res() response: Response,
  ): Promise<void> {
    const { bytes, contentType } = await this.storage.read(key)
    response.type(contentType).send(bytes)
  }
}
