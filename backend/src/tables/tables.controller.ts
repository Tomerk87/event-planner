import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Res,
} from '@nestjs/common'
import { ApiCookieAuth, ApiProduces, ApiTags } from '@nestjs/swagger'
import type { Response } from 'express'
import { CurrentUser } from '../auth/current-user.ts'
import { SESSION_COOKIE } from '../auth/session-token.ts'
import type { User } from '../domain/models.ts'
import {
  ExportSeatingDto,
  TableDto,
  TableInputDto,
  TableWithOccupancyDto,
} from './tables.dto.ts'
import { TablesService } from './tables.service.ts'

@ApiTags('tables')
@ApiCookieAuth(SESSION_COOKIE)
@Controller('events/:eventId/tables')
export class TablesController {
  constructor(private readonly tables: TablesService) {}

  @Get()
  list(
    @Param('eventId') eventId: string,
    @CurrentUser() user: User,
  ): Promise<TableWithOccupancyDto[]> {
    return this.tables.list(eventId, user)
  }

  @Post()
  create(
    @Param('eventId') eventId: string,
    @Body() body: TableInputDto,
    @CurrentUser() user: User,
  ): Promise<TableDto> {
    return this.tables.create(eventId, body, user)
  }

  @Put(':tableId')
  update(
    @Param('eventId') eventId: string,
    @Param('tableId') tableId: string,
    @Body() body: TableInputDto,
    @CurrentUser() user: User,
  ): Promise<TableDto> {
    return this.tables.update(eventId, tableId, body, user)
  }

  /** Deletes the table and unassigns its guests. */
  @Delete(':tableId')
  @HttpCode(204)
  remove(
    @Param('eventId') eventId: string,
    @Param('tableId') tableId: string,
    @CurrentUser() user: User,
  ): Promise<void> {
    return this.tables.remove(eventId, tableId, user)
  }

  /** The seating list as a CSV or Excel file: one row per seated party. */
  @ApiProduces(
    'text/csv',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  )
  @Post('export')
  @HttpCode(200)
  async export(
    @Param('eventId') eventId: string,
    @Body() body: ExportSeatingDto,
    @CurrentUser() user: User,
    @Res() response: Response,
  ): Promise<void> {
    const file = await this.tables.exportSeating(eventId, body, user)
    response
      .type(file.contentType)
      .setHeader(
        'Content-Disposition',
        `attachment; filename="seating.${body.format}"`,
      )
      .send(file.bytes)
  }
}
