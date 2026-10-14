import { Module } from '@nestjs/common'
import { APP_FILTER, APP_GUARD } from '@nestjs/core'
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler'
import { AccessModule } from './access/access.module.ts'
import { AuthController } from './auth/auth.controller.ts'
import { AuthModule } from './auth/auth.module.ts'
import { DomainErrorFilter } from './common/domain-error.filter.ts'
import { APP_CONFIG, loadConfig, type AppConfig } from './config.ts'
import { EventsModule } from './events/events.module.ts'
import { GuestsModule } from './guests/guests.module.ts'
import { HealthController } from './health/health.controller.ts'
import { PermissionsModule } from './permissions/permissions.module.ts'
import { PrismaModule } from './prisma/prisma.module.ts'
import { StorageModule } from './storage/storage.module.ts'

/** The routes the attempt limit applies to. */
const AUTH_ATTEMPTS = new Set(['signIn', 'signUp'])

@Module({})
export class ConfigModule {
  static forRoot(config: AppConfig) {
    return {
      module: ConfigModule,
      global: true,
      providers: [{ provide: APP_CONFIG, useValue: config }],
      exports: [APP_CONFIG],
    }
  }
}

/** The application, built from a configuration so tests can supply their own. */
export function createAppModule(config: AppConfig = loadConfig()) {
  @Module({
    imports: [
      ConfigModule.forRoot(config),
      // Sign-in and sign-up only: a few attempts a minute from one address.
      ThrottlerModule.forRoot([
        {
          limit: config.authAttemptsPerMinute,
          ttl: 60_000,
          skipIf: (context) =>
            !AUTH_ATTEMPTS.has(context.getHandler().name) ||
            context.getClass() !== AuthController,
        },
      ]),
      PrismaModule,
      StorageModule,
      AccessModule,
      AuthModule,
      EventsModule,
      PermissionsModule,
      GuestsModule,
    ],
    controllers: [HealthController],
    providers: [
      { provide: APP_GUARD, useClass: ThrottlerGuard },
      { provide: APP_FILTER, useClass: DomainErrorFilter },
    ],
  })
  class AppModule {}
  return AppModule
}
