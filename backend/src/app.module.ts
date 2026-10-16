import { Module } from '@nestjs/common'
import { APP_FILTER, APP_GUARD } from '@nestjs/core'
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler'
import { AccessModule } from './access/access.module.ts'
import { AuthController } from './auth/auth.controller.ts'
import { AuthModule } from './auth/auth.module.ts'
import { DomainErrorFilter } from './common/domain-error.filter.ts'
import { APP_CONFIG, loadConfig, type AppConfig } from './config.ts'
import { DashboardModule } from './dashboard/dashboard.module.ts'
import { EmailModule } from './email/email.module.ts'
import { EventsModule } from './events/events.module.ts'
import { GuestsModule } from './guests/guests.module.ts'
import { HealthController } from './health/health.controller.ts'
import { LayoutModule } from './layout/layout.module.ts'
import { MessagesModule } from './messages/messages.module.ts'
import { NotificationsModule } from './notifications/notifications.module.ts'
import { PermissionsModule } from './permissions/permissions.module.ts'
import { PrismaModule } from './prisma/prisma.module.ts'
import { PublicRsvpController } from './rsvp/rsvp.controller.ts'
import { RsvpModule } from './rsvp/rsvp.module.ts'
import { StorageModule } from './storage/storage.module.ts'
import { SystemController } from './system/system.controller.ts'
import { TablesModule } from './tables/tables.module.ts'

/** The routes the attempt limit applies to. */
const AUTH_ATTEMPTS = new Set([
  'signIn',
  'signUp',
  'verifyEmail',
  'forgotPassword',
  'resetPassword',
  'resendVerification',
])

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
      ThrottlerModule.forRoot([
        // Sign-in, sign-up and the email links: a few attempts a minute from
        // one address.
        {
          limit: config.authAttemptsPerMinute,
          ttl: 60_000,
          skipIf: (context) =>
            !AUTH_ATTEMPTS.has(context.getHandler().name) ||
            context.getClass() !== AuthController,
        },
        // Public RSVP answers from one address (D2); the per-phone limit is
        // in RsvpService.
        {
          name: 'rsvp',
          limit: config.rsvpLimits.perIp,
          ttl: config.rsvpLimits.windowMinutes * 60_000,
          skipIf: (context) =>
            context.getHandler().name !== 'submit' ||
            context.getClass() !== PublicRsvpController,
        },
      ]),
      PrismaModule,
      EmailModule,
      StorageModule,
      AccessModule,
      AuthModule,
      EventsModule,
      PermissionsModule,
      GuestsModule,
      MessagesModule,
      RsvpModule,
      TablesModule,
      LayoutModule,
      DashboardModule,
      NotificationsModule,
    ],
    controllers: [HealthController, SystemController],
    providers: [
      { provide: APP_GUARD, useClass: ThrottlerGuard },
      { provide: APP_FILTER, useClass: DomainErrorFilter },
    ],
  })
  class AppModule {}
  return AppModule
}
