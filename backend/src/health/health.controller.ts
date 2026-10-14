import { Controller, Get, ServiceUnavailableException } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { Public } from '../auth/public.decorator.ts'
import { PrismaService } from '../prisma/prisma.service.ts'

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  /** Reports whether the API is up and can reach its database. */
  @Public()
  @Get()
  async check(): Promise<{ status: 'ok'; database: 'ok' }> {
    try {
      await this.prisma.$queryRaw`SELECT 1`
    } catch {
      throw new ServiceUnavailableException({
        status: 'error',
        database: 'unreachable',
      })
    }
    return { status: 'ok', database: 'ok' }
  }
}
