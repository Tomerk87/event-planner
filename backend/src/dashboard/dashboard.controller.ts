import { Controller, Get, Param } from '@nestjs/common'
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger'
import { CurrentUser } from '../auth/current-user.ts'
import { SESSION_COOKIE } from '../auth/session-token.ts'
import type { User } from '../domain/models.ts'
import { DashboardDto } from './dashboard.dto.ts'
import { DashboardService } from './dashboard.service.ts'

@ApiTags('dashboard')
@ApiCookieAuth(SESSION_COOKIE)
@Controller('events/:eventId/dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  /** Figures, warnings and recent activity, derived from the stored records. */
  @Get()
  get(
    @Param('eventId') eventId: string,
    @CurrentUser() user: User,
  ): Promise<DashboardDto> {
    return this.dashboard.get(eventId, user)
  }
}
