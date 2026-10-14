import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import {
  ApiBody,
  ApiConsumes,
  ApiCookieAuth,
  ApiProduces,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger'
import type { Response } from 'express'
import { CurrentUser } from '../auth/current-user.ts'
import { SESSION_COOKIE } from '../auth/session-token.ts'
import type { GuestExportLabels } from '../domain/exports.ts'
import {
  DEFAULT_GUEST_SORT,
  GUEST_SORT_KEYS,
  NO_GUEST_FILTERS,
  type GuestFilters,
  type GuestSortKey,
} from '../domain/guestList.ts'
import { RSVP_STATUSES, type RsvpStatus, type User } from '../domain/models.ts'
import { DEFAULT_PAGE_SIZE } from '../domain/paging.ts'
import { MAX_FILE_BYTES } from './guest-files.ts'
import { GuestFilesService } from './guest-files.service.ts'
import {
  AssignTableDto,
  ExportGuestsDto,
  GuestDto,
  GuestIdsDto,
  GuestInputDto,
  GuestPageDto,
  GuestRsvpDto,
  ImportGuestsDto,
  ImportOutcomeDto,
  SetGroupDto,
  SpreadsheetRowsDto,
} from './guests.dto.ts'
import { GuestsService } from './guests.service.ts'

/** The parts of an upload that reading a spreadsheet needs. */
interface UploadedSpreadsheet {
  originalname: string
  size: number
  buffer: Buffer
}

function isStatus(value: string | undefined): value is RsvpStatus {
  return (RSVP_STATUSES as readonly string[]).includes(value ?? '')
}

@ApiTags('guests')
@ApiCookieAuth(SESSION_COOKIE)
@Controller('events/:eventId/guests')
export class GuestsController {
  constructor(
    private readonly guests: GuestsService,
    private readonly files: GuestFilesService,
  ) {}

  /** Every active guest (the frontend filters and pages them itself). */
  @Get()
  list(
    @Param('eventId') eventId: string,
    @CurrentUser() user: User,
  ): Promise<GuestDto[]> {
    return this.guests.list(eventId, user)
  }

  /** Search, filters, sorting and paging, with the Guests page's rules. */
  @ApiQuery({ name: 'q', required: false })
  @ApiQuery({ name: 'rsvp', required: false, enum: RSVP_STATUSES })
  @ApiQuery({ name: 'invitation', required: false, enum: ['SENT', 'NOT_SENT'] })
  @ApiQuery({
    name: 'table',
    required: false,
    description: 'A table id, or NONE',
  })
  @ApiQuery({
    name: 'group',
    required: false,
    description: 'A group name; empty for no group',
  })
  @ApiQuery({
    name: 'sort',
    required: false,
    description: 'A sort key, - first for descending',
  })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'size', required: false })
  @ApiQuery({ name: 'locale', required: false, enum: ['en', 'he'] })
  @Get('search')
  search(
    @Param('eventId') eventId: string,
    @CurrentUser() user: User,
    @Query() query: Record<string, string | undefined>,
  ): Promise<GuestPageDto> {
    const filters: GuestFilters = {
      ...NO_GUEST_FILTERS,
      query: query['q'] ?? '',
      rsvp: isStatus(query['rsvp']) ? query['rsvp'] : 'ALL',
      invitation:
        query['invitation'] === 'SENT' || query['invitation'] === 'NOT_SENT'
          ? query['invitation']
          : 'ALL',
      table: query['table'] || 'ALL',
      group: query['group'] ?? null,
    }
    const sortParam = query['sort'] ?? ''
    const descending = sortParam.startsWith('-')
    const key = descending ? sortParam.slice(1) : sortParam
    const sort = (GUEST_SORT_KEYS as readonly string[]).includes(key)
      ? {
          key: key as GuestSortKey,
          direction: descending ? ('desc' as const) : ('asc' as const),
        }
      : DEFAULT_GUEST_SORT
    return this.guests.search(eventId, user, {
      filters,
      sort,
      page: Number(query['page'] ?? 1),
      size: Math.min(
        100,
        Number(query['size'] ?? DEFAULT_PAGE_SIZE) || DEFAULT_PAGE_SIZE,
      ),
      locale: query['locale'] === 'he' ? 'he' : 'en',
    })
  }

  @Post()
  create(
    @Param('eventId') eventId: string,
    @Body() body: GuestInputDto,
    @CurrentUser() user: User,
  ): Promise<GuestDto> {
    return this.guests.create(eventId, body, user)
  }

  @Put(':guestId')
  update(
    @Param('eventId') eventId: string,
    @Param('guestId') guestId: string,
    @Body() body: GuestInputDto,
    @CurrentUser() user: User,
  ): Promise<GuestDto> {
    return this.guests.update(eventId, guestId, body, user)
  }

  @Delete(':guestId')
  @HttpCode(204)
  remove(
    @Param('eventId') eventId: string,
    @Param('guestId') guestId: string,
    @CurrentUser() user: User,
  ): Promise<void> {
    return this.guests.remove(eventId, guestId, user)
  }

  @Post('delete')
  @HttpCode(204)
  removeMany(
    @Param('eventId') eventId: string,
    @Body() body: GuestIdsDto,
    @CurrentUser() user: User,
  ): Promise<void> {
    return this.guests.removeMany(eventId, body.guestIds, user)
  }

  @Put(':guestId/rsvp')
  setRsvp(
    @Param('eventId') eventId: string,
    @Param('guestId') guestId: string,
    @Body() body: GuestRsvpDto,
    @CurrentUser() user: User,
  ): Promise<GuestDto> {
    return this.guests.setRsvp(eventId, guestId, body, user)
  }

  @Put(':guestId/table')
  assignTable(
    @Param('eventId') eventId: string,
    @Param('guestId') guestId: string,
    @Body() body: AssignTableDto,
    @CurrentUser() user: User,
  ): Promise<GuestDto> {
    return this.guests.assignTable(eventId, guestId, body.tableId, user)
  }

  @Post('group')
  @HttpCode(204)
  setGroup(
    @Param('eventId') eventId: string,
    @Body() body: SetGroupDto,
    @CurrentUser() user: User,
  ): Promise<void> {
    return this.guests.setGroup(eventId, body.guestIds, body.group, user)
  }

  /** Reads an uploaded CSV or Excel file into rows; nothing is saved. */
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @Post('import/read')
  @HttpCode(200)
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_FILE_BYTES, files: 1 } }),
  )
  async readFile(
    @Param('eventId') eventId: string,
    @UploadedFile() file: UploadedSpreadsheet | undefined,
    @CurrentUser() user: User,
  ): Promise<SpreadsheetRowsDto> {
    return { rows: await this.files.read(eventId, file, user) }
  }

  /** Adds the rows chosen in the import dialog; all of them or none. */
  @Post('import')
  importMany(
    @Param('eventId') eventId: string,
    @Body() body: ImportGuestsDto,
    @CurrentUser() user: User,
  ): Promise<ImportOutcomeDto> {
    return this.guests.importMany(eventId, body.guests, user)
  }

  /** The guest list as a CSV or Excel file, with every field. */
  @ApiProduces(
    'text/csv',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  )
  @Post('export')
  @HttpCode(200)
  async export(
    @Param('eventId') eventId: string,
    @Body() body: ExportGuestsDto,
    @CurrentUser() user: User,
    @Res() response: Response,
  ): Promise<void> {
    const file = await this.files.export(
      eventId,
      {
        format: body.format,
        guestIds: body.guestIds,
        labels: body.labels as GuestExportLabels,
        sheetName: body.sheetName,
        rightToLeft: body.rightToLeft,
      },
      user,
    )
    response
      .type(file.contentType)
      .setHeader(
        'Content-Disposition',
        `attachment; filename="guests.${body.format}"`,
      )
      .send(file.bytes)
  }
}
