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
import { LanguageDto } from '../auth/auth.dto.ts'
import { CurrentUser } from '../auth/current-user.ts'
import { SESSION_COOKIE } from '../auth/session-token.ts'
import type { User } from '../domain/models.ts'
import {
  EventAccessListDto,
  InvitationDto,
  InviteDto,
  InviteResultDto,
  MemberDto,
  RoleDto,
} from './permissions.dto.ts'
import { PermissionsService } from './permissions.service.ts'

@ApiTags('permissions')
@ApiCookieAuth(SESSION_COOKIE)
@Controller('events/:eventId/permissions')
export class PermissionsController {
  constructor(private readonly permissions: PermissionsService) {}

  @Get()
  list(
    @Param('eventId') eventId: string,
    @CurrentUser() user: User,
  ): Promise<EventAccessListDto> {
    return this.permissions.list(eventId, user)
  }

  /** A member at once for an existing account, a pending invitation otherwise. */
  @Post('invitations')
  invite(
    @Param('eventId') eventId: string,
    @Body() body: InviteDto,
    @CurrentUser() user: User,
  ): Promise<InviteResultDto> {
    return this.permissions.invite(
      eventId,
      body.email,
      body.role,
      user,
      body.language,
    )
  }

  /** Emails a pending invitation again; email on only (D90). */
  @Post('invitations/:invitationId/resend')
  @HttpCode(204)
  resendInvitation(
    @Param('eventId') eventId: string,
    @Param('invitationId') invitationId: string,
    @Body() body: LanguageDto,
    @CurrentUser() user: User,
  ): Promise<void> {
    return this.permissions.resendInvitation(
      eventId,
      invitationId,
      user,
      body.language,
    )
  }

  @Put('members/:userId')
  changeRole(
    @Param('eventId') eventId: string,
    @Param('userId') userId: string,
    @Body() body: RoleDto,
    @CurrentUser() user: User,
  ): Promise<MemberDto> {
    return this.permissions.changeRole(eventId, userId, body.role, user)
  }

  @Delete('members/:userId')
  @HttpCode(204)
  revoke(
    @Param('eventId') eventId: string,
    @Param('userId') userId: string,
    @CurrentUser() user: User,
  ): Promise<void> {
    return this.permissions.revoke(eventId, userId, user)
  }

  @Put('invitations/:invitationId')
  changeInvitationRole(
    @Param('eventId') eventId: string,
    @Param('invitationId') invitationId: string,
    @Body() body: RoleDto,
    @CurrentUser() user: User,
  ): Promise<InvitationDto> {
    return this.permissions.changeInvitationRole(
      eventId,
      invitationId,
      body.role,
      user,
    )
  }

  @Delete('invitations/:invitationId')
  @HttpCode(204)
  cancelInvitation(
    @Param('eventId') eventId: string,
    @Param('invitationId') invitationId: string,
    @CurrentUser() user: User,
  ): Promise<void> {
    return this.permissions.cancelInvitation(eventId, invitationId, user)
  }
}
