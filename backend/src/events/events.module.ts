import { Module } from '@nestjs/common'
import { EventsController } from './events.controller.ts'
import { EventsService } from './events.service.ts'

@Module({ controllers: [EventsController], providers: [EventsService] })
export class EventsModule {}
