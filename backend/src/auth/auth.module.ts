import { Module } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { AuthController } from './auth.controller.ts'
import { AuthService } from './auth.service.ts'
import { SessionGuard } from './session.guard.ts'

@Module({
  controllers: [AuthController],
  providers: [AuthService, { provide: APP_GUARD, useClass: SessionGuard }],
  exports: [AuthService],
})
export class AuthModule {}
