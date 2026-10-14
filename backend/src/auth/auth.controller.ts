import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Post,
  Req,
  Res,
} from '@nestjs/common'
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger'
import type { Response } from 'express'
import { APP_CONFIG, type AppConfig } from '../config.ts'
import type { User } from '../domain/models.ts'
import { SignInDto, SignUpDto, UserDto } from './auth.dto.ts'
import { AuthService, type StartedSession } from './auth.service.ts'
import { CurrentUser, type AuthenticatedRequest } from './current-user.ts'
import { Public } from './public.decorator.ts'
import { SESSION_COOKIE, sessionCookieOptions } from './session-token.ts'

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  @Public()
  @Post('sign-up')
  async signUp(
    @Body() body: SignUpDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<UserDto> {
    return this.begin(await this.auth.signUp(body), response)
  }

  @Public()
  @HttpCode(200)
  @Post('sign-in')
  async signIn(
    @Body() body: SignInDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<UserDto> {
    return this.begin(await this.auth.signIn(body), response)
  }

  @ApiCookieAuth(SESSION_COOKIE)
  @HttpCode(204)
  @Post('sign-out')
  async signOut(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.auth.signOut(request.sessionId)
    response.clearCookie(SESSION_COOKIE, { path: '/' })
  }

  /** The signed-in user (the frontend's session.getCurrentUser). */
  @ApiCookieAuth(SESSION_COOKIE)
  @Get('me')
  me(@CurrentUser() user: User): UserDto {
    return user
  }

  private begin(session: StartedSession, response: Response): UserDto {
    response.cookie(
      SESSION_COOKIE,
      session.token,
      sessionCookieOptions(this.config.production, session.expiresAt),
    )
    return session.user
  }
}
