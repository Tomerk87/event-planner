import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common'
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger'
import { CurrentUser } from '../auth/current-user.ts'
import { SESSION_COOKIE } from '../auth/session-token.ts'
import type { User } from '../domain/models.ts'
import {
  ConvertUnknownDto,
  GuestDto,
  MergeUnknownDto,
  UnknownRsvpDto,
} from './guests.dto.ts'
import { UnknownGuestsService } from './unknown-guests.service.ts'

@ApiTags('unknown guests')
@ApiCookieAuth(SESSION_COOKIE)
@Controller('events/:eventId/unknown-guests')
export class UnknownGuestsController {
  constructor(private readonly unknown: UnknownGuestsService) {}

  @Get()
  list(
    @Param('eventId') eventId: string,
    @CurrentUser() user: User,
  ): Promise<UnknownRsvpDto[]> {
    return this.unknown.list(eventId, user)
  }

  @Get('rejected')
  listRejected(
    @Param('eventId') eventId: string,
    @CurrentUser() user: User,
  ): Promise<UnknownRsvpDto[]> {
    return this.unknown.listRejected(eventId, user)
  }

  @Post(':unknownId/convert')
  convert(
    @Param('eventId') eventId: string,
    @Param('unknownId') unknownId: string,
    @Body() body: ConvertUnknownDto,
    @CurrentUser() user: User,
  ): Promise<GuestDto> {
    return this.unknown.convertToGuest(eventId, unknownId, body, user)
  }

  @Post(':unknownId/merge')
  merge(
    @Param('eventId') eventId: string,
    @Param('unknownId') unknownId: string,
    @Body() body: MergeUnknownDto,
    @CurrentUser() user: User,
  ): Promise<GuestDto> {
    return this.unknown.mergeIntoGuest(eventId, unknownId, body.guestId, user)
  }

  @Post(':unknownId/reject')
  @HttpCode(204)
  reject(
    @Param('eventId') eventId: string,
    @Param('unknownId') unknownId: string,
    @CurrentUser() user: User,
  ): Promise<void> {
    return this.unknown.reject(eventId, unknownId, user)
  }

  @Post(':unknownId/restore')
  @HttpCode(200)
  restore(
    @Param('eventId') eventId: string,
    @Param('unknownId') unknownId: string,
    @CurrentUser() user: User,
  ): Promise<UnknownRsvpDto> {
    return this.unknown.restore(eventId, unknownId, user)
  }
}
