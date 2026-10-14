import { Module } from '@nestjs/common'
import { TablesController } from './tables.controller.ts'
import { TablesService } from './tables.service.ts'

@Module({ controllers: [TablesController], providers: [TablesService] })
export class TablesModule {}
