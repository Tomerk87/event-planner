import { Body, Controller, Get, HttpCode, Inject, Post } from '@nestjs/common'
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger'
import { LanguageDto } from '../auth/auth.dto.ts'
import { CurrentUser } from '../auth/current-user.ts'
import { Public } from '../auth/public.decorator.ts'
import { SESSION_COOKIE } from '../auth/session-token.ts'
import { APP_CONFIG, type AppConfig } from '../config.ts'
import { DomainError } from '../domain/errors.ts'
import type { User } from '../domain/models.ts'
import { EmailService } from '../email/email.service.ts'
import * as emails from '../email/templates.ts'
import {
  EmailStatusDto,
  FeaturesDto,
  TestEmailResultDto,
} from './system.dto.ts'

function assertSuperUser(user: User): void {
  if (!user.isSuperUser) {
    throw new DomainError('FORBIDDEN', { action: 'SYSTEM' })
  }
}

/**
 * The server's own settings. Read-only by design (D91): they and the
 * provider's password live in the server configuration, never in the
 * browser or the database.
 */
@ApiTags('system')
@Controller('system')
export class SystemController {
  constructor(
    private readonly email: EmailService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  @Public()
  @Get('features')
  features(): FeaturesDto {
    return { email: this.email.enabled }
  }

  @ApiCookieAuth(SESSION_COOKIE)
  @Get('email')
  emailStatus(@CurrentUser() user: User): EmailStatusDto {
    assertSuperUser(user)
    const { mode, smtp, from } = this.config.email
    return {
      mode,
      host: smtp?.host ?? null,
      port: smtp?.port ?? null,
      from,
      authenticated: Boolean(smtp?.user && smtp.password),
    }
  }

  /** Sends a test email to the Super User's own address. */
  @ApiCookieAuth(SESSION_COOKIE)
  @HttpCode(200)
  @Post('email/test')
  async testEmail(
    @Body() body: LanguageDto,
    @CurrentUser() user: User,
  ): Promise<TestEmailResultDto> {
    assertSuperUser(user)
    if (!this.email.enabled) {
      return { sent: false }
    }
    if (!this.email.allows('test', user.email)) {
      throw new DomainError('TOO_MANY_REQUESTS')
    }
    const sent = await this.email.send({
      to: user.email,
      ...emails.testEmail(body.language ?? 'en', {
        url: this.email.link('/events'),
      }),
    })
    if (!sent) {
      throw new DomainError('UNAVAILABLE')
    }
    return { sent: true }
  }
}
