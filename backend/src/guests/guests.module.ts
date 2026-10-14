import { Module } from '@nestjs/common'
import { GuestFilesService } from './guest-files.service.ts'
import { GuestsController } from './guests.controller.ts'
import { GuestsService } from './guests.service.ts'
import { UnknownGuestsController } from './unknown-guests.controller.ts'
import { UnknownGuestsService } from './unknown-guests.service.ts'

@Module({
  controllers: [GuestsController, UnknownGuestsController],
  providers: [GuestsService, UnknownGuestsService, GuestFilesService],
})
export class GuestsModule {}
