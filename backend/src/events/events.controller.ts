import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
} from '@nestjs/common'
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger'
import { CurrentUser } from '../auth/current-user.ts'
import { SESSION_COOKIE } from '../auth/session-token.ts'
import type { User } from '../domain/models.ts'
import {
  DuplicateEventDto,
  EventAccessInfoDto,
  EventDto,
  EventInputDto,
  EventSummaryDto,
} from './events.dto.ts'
import { EventsService } from './events.service.ts'

@ApiTags('events')
@ApiCookieAuth(SESSION_COOKIE)
@Controller('events')
export class EventsController {
  constructor(private readonly events: EventsService) {}

  @Get()
  list(@CurrentUser() user: User): Promise<EventSummaryDto[]> {
    return this.events.list(user)
  }

  @Get(':eventId')
  get(
    @Param('eventId') eventId: string,
    @CurrentUser() user: User,
  ): Promise<EventAccessInfoDto> {
    return this.events.get(eventId, user)
  }

  @Post()
  create(
    @Body() body: EventInputDto,
    @CurrentUser() user: User,
  ): Promise<EventDto> {
    return this.events.create(body, user)
  }

  @Put(':eventId')
  update(
    @Param('eventId') eventId: string,
    @Body() body: EventInputDto,
    @CurrentUser() user: User,
  ): Promise<EventDto> {
    return this.events.update(eventId, body, user)
  }

  @Post(':eventId/duplicate')
  duplicate(
    @Param('eventId') eventId: string,
    @Body() body: DuplicateEventDto,
    @CurrentUser() user: User,
  ): Promise<EventDto> {
    return this.events.duplicate(eventId, body, user)
  }

  @Delete(':eventId')
  @HttpCode(204)
  remove(
    @Param('eventId') eventId: string,
    @CurrentUser() user: User,
  ): Promise<void> {
    return this.events.remove(eventId, user)
  }
}
