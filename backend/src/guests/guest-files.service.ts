import { Injectable } from '@nestjs/common'
import { EventAccessService } from '../access/event-access.service.ts'
import { DomainError } from '../domain/errors.ts'
import {
  buildGuestExportRows,
  buildGuestExportTable,
  type GuestExportLabels,
} from '../domain/exports.ts'
import { MAX_IMPORT_ROWS } from '../domain/guestImport.ts'
import type { User } from '../domain/models.ts'
import { PrismaService } from '../prisma/prisma.service.ts'
import { toGuest, toTable } from '../prisma/mappers.ts'
import {
  readSpreadsheet,
  writeSpreadsheet,
  type FileFormat,
} from './guest-files.ts'

export interface ExportRequest {
  format: FileFormat
  /** Only these guests; every active guest when left out. */
  guestIds?: string[]
  /** Headings and status names in the person's interface language. */
  labels: GuestExportLabels
  sheetName: string
  rightToLeft: boolean
}

/** Guest files: reading an uploaded list, and writing the guest export. */
@Injectable()
export class GuestFilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: EventAccessService,
  ) {}

  /**
   * Reads an uploaded file into rows for the import dialog's column matching
   * and preview. Nothing is saved; the chosen rows are sent to the import.
   */
  async read(
    eventId: string,
    file: { originalname: string; size: number; buffer: Buffer } | undefined,
    user: User,
  ): Promise<string[][]> {
    await this.access.authorize(eventId, user, 'EDIT')
    if (!file) {
      throw new DomainError('VALIDATION', { field: 'file' })
    }
    const rows = await readSpreadsheet(file)
    // The heading row is not a guest.
    if (rows.length - 1 > MAX_IMPORT_ROWS) {
      throw new DomainError('VALIDATION', {
        field: 'rows',
        max: MAX_IMPORT_ROWS,
      })
    }
    return rows
  }

  /** The guest export, with every field; Viewers may export too. */
  async export(
    eventId: string,
    request: ExportRequest,
    user: User,
  ): Promise<{ bytes: Buffer; contentType: string }> {
    await this.access.authorize(eventId, user, 'EXPORT')
    const [guests, tables] = await Promise.all([
      this.prisma.guest.findMany({
        where: {
          eventId,
          deleted: false,
          ...(request.guestIds ? { id: { in: request.guestIds } } : {}),
        },
      }),
      this.prisma.eventTable.findMany({ where: { eventId } }),
    ])
    const table = buildGuestExportTable(
      buildGuestExportRows(guests.map(toGuest), tables.map(toTable)),
      request.labels,
    )
    return writeSpreadsheet(table, request.format, request)
  }
}
