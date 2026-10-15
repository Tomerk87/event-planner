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
import {
  CurrentUserDto,
  EmailLinkDto,
  ForgotPasswordDto,
  LanguageDto,
  ResetPasswordDto,
  SignInDto,
  SignUpDto,
  UserDto,
} from './auth.dto.ts'
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
    return this.begin(
      await this.auth.signUp(body, body.language ?? 'en'),
      response,
    )
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
  async me(@CurrentUser() user: User): Promise<CurrentUserDto> {
    return { ...user, emailVerified: await this.auth.isEmailVerified(user.id) }
  }

  /** Another verification email for the signed-in account (email on only). */
  @ApiCookieAuth(SESSION_COOKIE)
  @HttpCode(204)
  @Post('resend-verification')
  resendVerification(
    @Body() body: LanguageDto,
    @CurrentUser() user: User,
  ): Promise<void> {
    return this.auth.resendVerification(user, body.language ?? 'en')
  }

  /** Opens with the emailed link; the account need not be signed in here. */
  @Public()
  @HttpCode(204)
  @Post('verify-email')
  verifyEmail(@Body() body: EmailLinkDto): Promise<void> {
    return this.auth.verifyEmail(body.token)
  }

  /** Always 204, whether or not the email has an account (email on only). */
  @Public()
  @HttpCode(204)
  @Post('forgot-password')
  forgotPassword(@Body() body: ForgotPasswordDto): Promise<void> {
    return this.auth.forgotPassword(body.email, body.language ?? 'en')
  }

  /** Sets a new password and signs the account out everywhere. */
  @Public()
  @HttpCode(204)
  @Post('reset-password')
  async resetPassword(
    @Body() body: ResetPasswordDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.auth.resetPassword(body.token, body.password)
    response.clearCookie(SESSION_COOKIE, { path: '/' })
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
