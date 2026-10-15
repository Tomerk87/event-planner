import { Module } from '@nestjs/common'
import { NotificationsController } from './notifications.controller.ts'
import { NotificationsService } from './notifications.service.ts'

@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService],
})
export class NotificationsModule {}
