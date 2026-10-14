import { Module } from '@nestjs/common'
import { PermissionsController } from './permissions.controller.ts'
import { PermissionsService } from './permissions.service.ts'

@Module({
  controllers: [PermissionsController],
  providers: [PermissionsService],
})
export class PermissionsModule {}
