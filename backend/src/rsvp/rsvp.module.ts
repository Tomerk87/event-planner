import { Module } from '@nestjs/common'
import {
  PublicRsvpController,
  RsvpSettingsController,
} from './rsvp.controller.ts'
import { RsvpService } from './rsvp.service.ts'

@Module({
  controllers: [RsvpSettingsController, PublicRsvpController],
  providers: [RsvpService],
})
export class RsvpModule {}
