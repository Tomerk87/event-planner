import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
} from '@nestjs/common'
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger'
import { CurrentUser } from '../auth/current-user.ts'
import { Public } from '../auth/public.decorator.ts'
import { SESSION_COOKIE } from '../auth/session-token.ts'
import type { User } from '../domain/models.ts'
import {
  PublicRsvpInputDto,
  PublicRsvpResultDto,
  PublicRsvpViewDto,
  RsvpSettingsDto,
  RsvpSettingsInputDto,
} from './rsvp.dto.ts'
import { RsvpService } from './rsvp.service.ts'

@ApiTags('rsvp')
@ApiCookieAuth(SESSION_COOKIE)
@Controller('events/:eventId/rsvp-settings')
export class RsvpSettingsController {
  constructor(private readonly rsvp: RsvpService) {}

  @Get()
  get(
    @Param('eventId') eventId: string,
    @CurrentUser() user: User,
  ): Promise<RsvpSettingsDto> {
    return this.rsvp.getSettings(eventId, user)
  }

  @Put()
  update(
    @Param('eventId') eventId: string,
    @Body() body: RsvpSettingsInputDto,
    @CurrentUser() user: User,
  ): Promise<RsvpSettingsDto> {
    return this.rsvp.updateSettings(eventId, body, user)
  }
}

/**
 * The one public RSVP link of an event, shared by every guest. No account is
 * needed; submissions are limited per address and per phone (decision D2).
 */
@ApiTags('public rsvp')
@Public()
@Controller('public/rsvp/:slug')
export class PublicRsvpController {
  constructor(private readonly rsvp: RsvpService) {}

  @Get()
  get(@Param('slug') slug: string): Promise<PublicRsvpViewDto> {
    return this.rsvp.getPublicEvent(slug)
  }

  @Post()
  @HttpCode(200)
  submit(
    @Param('slug') slug: string,
    @Body() body: PublicRsvpInputDto,
  ): Promise<PublicRsvpResultDto> {
    return this.rsvp.submit(slug, body)
  }
}
