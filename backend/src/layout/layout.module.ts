import { Module } from '@nestjs/common'
import { LayoutController } from './layout.controller.ts'
import { LayoutService } from './layout.service.ts'

@Module({ controllers: [LayoutController], providers: [LayoutService] })
export class LayoutModule {}
