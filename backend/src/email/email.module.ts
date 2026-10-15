import { Global, Module } from '@nestjs/common'
import { APP_CONFIG, type AppConfig } from '../config.ts'
import { EmailService } from './email.service.ts'
import { createMailer, MAILER } from './mailer.ts'

@Global()
@Module({
  providers: [
    {
      provide: MAILER,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => createMailer(config.email),
    },
    EmailService,
  ],
  exports: [EmailService],
})
export class EmailModule {}
