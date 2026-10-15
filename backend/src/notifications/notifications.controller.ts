import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common'
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger'
import { CurrentUser } from '../auth/current-user.ts'
import { SESSION_COOKIE } from '../auth/session-token.ts'
import type { User } from '../domain/models.ts'
import { MarkReadDto, NotificationListDto } from './notifications.dto.ts'
import { NotificationsService } from './notifications.service.ts'

/** The signed-in account's notices, under the bell (D95). */
@ApiTags('notifications')
@ApiCookieAuth(SESSION_COOKIE)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  /** The most recent notices, newest first, and how many are unread. */
  @Get()
  list(@CurrentUser() user: User): Promise<NotificationListDto> {
    return this.notifications.list(user)
  }

  @HttpCode(204)
  @Post('read')
  markRead(
    @CurrentUser() user: User,
    @Body() body: MarkReadDto,
  ): Promise<void> {
    return this.notifications.markRead(user, body.id)
  }
}
