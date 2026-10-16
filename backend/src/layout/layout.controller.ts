import { Body, Controller, Get, Param, Put } from '@nestjs/common'
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger'
import { CurrentUser } from '../auth/current-user.ts'
import { SESSION_COOKIE } from '../auth/session-token.ts'
import type { User } from '../domain/models.ts'
import { LayoutDto, LayoutInputDto } from './layout.dto.ts'
import { LayoutService } from './layout.service.ts'

@ApiTags('layout')
@ApiCookieAuth(SESSION_COOKIE)
@Controller('events/:eventId/layout')
export class LayoutController {
  constructor(private readonly layout: LayoutService) {}

  @Get()
  get(
    @Param('eventId') eventId: string,
    @CurrentUser() user: User,
  ): Promise<LayoutDto> {
    return this.layout.get(eventId, user)
  }

  /** Saves the whole plan; 409 LAYOUT_CHANGED when someone saved meanwhile. */
  @Put()
  save(
    @Param('eventId') eventId: string,
    @Body() body: LayoutInputDto,
    @CurrentUser() user: User,
  ): Promise<LayoutDto> {
    return this.layout.save(eventId, body, user)
  }
}
