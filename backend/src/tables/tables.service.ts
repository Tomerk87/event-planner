import { Injectable } from '@nestjs/common'
import { EventAccessService, isUuid } from '../access/event-access.service.ts'
import { DomainError } from '../domain/errors.ts'
import {
  buildSeatingDetailRows,
  buildSeatingExportTable,
  type SeatingExportColumn,
} from '../domain/exports.ts'
import type { EventTable, User } from '../domain/models.ts'
import {
  tableOccupancy,
  validateTableInput,
  type TableInput,
} from '../domain/seating.ts'
import { lockEvent, type Tx } from '../guests/event-guests.ts'
import { writeSpreadsheet, type FileFormat } from '../guests/guest-files.ts'
import { PrismaService } from '../prisma/prisma.service.ts'
import { toGuest, toTable } from '../prisma/mappers.ts'

export interface TableWithOccupancy {
  table: EventTable
  /** Confirmed attendees seated at the table. */
  assigned: number
  /** Negative when the table is over capacity. */
  available: number
}

export interface SeatingExportRequest {
  format: FileFormat
  /** Headings in the person's interface language. */
  headings: Record<SeatingExportColumn, string>
  sheetName: string
  rightToLeft: boolean
}

/**
 * The event's tables (PRD section 11). A capacity below the guests already
 * seated is accepted and shown as a conflict; seating a party where it does
 * not fit is refused by the guests' table assignment.
 */
@Injectable()
export class TablesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: EventAccessService,
  ) {}

  /** In table-number order. */
  async list(eventId: string, user: User): Promise<TableWithOccupancy[]> {
    await this.access.authorize(eventId, user, 'VIEW')
    const [tables, guests] = await Promise.all([
      this.prisma.eventTable.findMany({
        where: { eventId },
        orderBy: { number: 'asc' },
      }),
      this.prisma.guest.findMany({
        where: { eventId, deleted: false, tableId: { not: null } },
      }),
    ])
    const seated = guests.map(toGuest)
    return tables.map((row) => {
      const assigned = tableOccupancy(row.id, seated)
      return {
        table: toTable(row),
        assigned,
        available: row.capacity - assigned,
      }
    })
  }

  async create(
    eventId: string,
    input: TableInput,
    user: User,
  ): Promise<EventTable> {
    await this.access.authorize(eventId, user, 'EDIT')
    return this.prisma.$transaction(async (tx) => {
      await lockEvent(tx, eventId)
      const fields = validateTableInput(
        input,
        await this.tablesOf(tx, eventId),
        null,
      )
      return toTable(
        await tx.eventTable.create({ data: { eventId, ...fields } }),
      )
    })
  }

  async update(
    eventId: string,
    tableId: string,
    input: TableInput,
    user: User,
  ): Promise<EventTable> {
    await this.access.authorize(eventId, user, 'EDIT')
    return this.prisma.$transaction(async (tx) => {
      await lockEvent(tx, eventId)
      const tables = await this.tablesOf(tx, eventId)
      this.find(tables, tableId)
      const fields = validateTableInput(input, tables, tableId)
      return toTable(
        await tx.eventTable.update({ where: { id: tableId }, data: fields }),
      )
    })
  }

  /** Deletes the table and unassigns its guests; guests are never deleted. */
  async remove(eventId: string, tableId: string, user: User): Promise<void> {
    await this.access.authorize(eventId, user, 'EDIT')
    await this.prisma.$transaction(async (tx) => {
      await lockEvent(tx, eventId)
      this.find(await this.tablesOf(tx, eventId), tableId)
      await tx.guest.updateMany({
        where: { eventId, tableId },
        data: { tableId: null },
      })
      await tx.eventTable.delete({ where: { id: tableId } })
    })
  }

  /** The seating list: one row per seated party, in table order. Viewers may export. */
  async exportSeating(
    eventId: string,
    request: SeatingExportRequest,
    user: User,
  ): Promise<{ bytes: Buffer; contentType: string }> {
    await this.access.authorize(eventId, user, 'EXPORT')
    const [guests, tables] = await Promise.all([
      this.prisma.guest.findMany({ where: { eventId, deleted: false } }),
      this.prisma.eventTable.findMany({ where: { eventId } }),
    ])
    const table = buildSeatingExportTable(
      buildSeatingDetailRows(guests.map(toGuest), tables.map(toTable)),
      request.headings,
    )
    return writeSpreadsheet(table, request.format, request)
  }

  private async tablesOf(tx: Tx, eventId: string): Promise<EventTable[]> {
    return (await tx.eventTable.findMany({ where: { eventId } })).map(toTable)
  }

  private find(tables: readonly EventTable[], tableId: string): EventTable {
    const table = isUuid(tableId)
      ? tables.find((candidate) => candidate.id === tableId)
      : undefined
    if (!table) {
      throw new DomainError('NOT_FOUND', { entity: 'table' })
    }
    return table
  }
}
