import { Global, Module } from '@nestjs/common'
import { EventAccessService } from './event-access.service.ts'

@Global()
@Module({ providers: [EventAccessService], exports: [EventAccessService] })
export class AccessModule {}
