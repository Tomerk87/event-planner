import { Module } from '@nestjs/common'
import { MessagesController } from './messages.controller.ts'
import { MessagesService } from './messages.service.ts'

@Module({ controllers: [MessagesController], providers: [MessagesService] })
export class MessagesModule {}
