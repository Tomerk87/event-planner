import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common'
import { ApiCookieAuth, ApiQuery, ApiTags } from '@nestjs/swagger'
import { CurrentUser } from '../auth/current-user.ts'
import { SESSION_COOKIE } from '../auth/session-token.ts'
import type { User } from '../domain/models.ts'
import {
  DefaultTemplateDto,
  MessagePreviewDto,
  MessageTemplateDto,
  MessageValuesDto,
  SendResultDto,
  SentMessageDto,
  TemplateInputDto,
} from './messages.dto.ts'
import { MessagesService } from './messages.service.ts'

@ApiTags('messages')
@ApiCookieAuth(SESSION_COOKIE)
@Controller('events/:eventId/messages')
export class MessagesController {
  constructor(private readonly messages: MessagesService) {}

  @Get('template')
  getTemplate(
    @Param('eventId') eventId: string,
    @CurrentUser() user: User,
  ): Promise<MessageTemplateDto> {
    return this.messages.getTemplate(eventId, user)
  }

  @Put('template')
  updateTemplate(
    @Param('eventId') eventId: string,
    @Body() body: TemplateInputDto,
    @CurrentUser() user: User,
  ): Promise<MessageTemplateDto> {
    return this.messages.updateTemplate(eventId, body.body, user)
  }

  /** The template a new event starts with, in the event's RSVP language. */
  @Get('template/default')
  async getDefaultTemplate(
    @Param('eventId') eventId: string,
    @CurrentUser() user: User,
  ): Promise<DefaultTemplateDto> {
    return { body: await this.messages.getDefaultTemplate(eventId, user) }
  }

  /** What each variable stands for; for a made-up guest when guestId is left out. */
  @ApiQuery({ name: 'guestId', required: false })
  @Get('values')
  getValues(
    @Param('eventId') eventId: string,
    @Query('guestId') guestId: string | undefined,
    @CurrentUser() user: User,
  ): Promise<MessageValuesDto> {
    return this.messages.getValues(eventId, guestId || null, user)
  }

  @Get('preview/:guestId')
  preview(
    @Param('eventId') eventId: string,
    @Param('guestId') guestId: string,
    @CurrentUser() user: User,
  ): Promise<MessagePreviewDto> {
    return this.messages.preview(eventId, guestId, user)
  }

  /**
   * Records that a send was started and adds one to the guest's counter.
   * This is an initiation, not a confirmed delivery: whether the message
   * was then sent from WhatsApp cannot be known.
   */
  @Post('sends/:guestId')
  send(
    @Param('eventId') eventId: string,
    @Param('guestId') guestId: string,
    @CurrentUser() user: User,
  ): Promise<SendResultDto> {
    return this.messages.send(eventId, guestId, user)
  }

  /** Newest first. */
  @Get('sends')
  listSends(
    @Param('eventId') eventId: string,
    @CurrentUser() user: User,
  ): Promise<SentMessageDto[]> {
    return this.messages.listSends(eventId, user)
  }
}
