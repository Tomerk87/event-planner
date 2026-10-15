import { Injectable } from '@nestjs/common'
import { EventAccessService } from '../access/event-access.service.ts'
import { guestFullName } from '../domain/guestList.ts'
import {
  computeDashboardMetrics,
  computeDashboardWarnings,
  deriveRecentActivity,
  type ActivityEntry,
  type DashboardMetrics,
  type DashboardWarnings,
} from '../domain/metrics.ts'
import type { User } from '../domain/models.ts'
import { PrismaService } from '../prisma/prisma.service.ts'
import { toGuest, toSend, toTable } from '../prisma/mappers.ts'

/** The full Recent Guest Activity list; the card shows the newest five (P10). */
const RECENT_ACTIVITY_LIMIT = 50

export type ActivityItem = ActivityEntry & { guestName: string }

export interface Dashboard {
  metrics: DashboardMetrics
  warnings: DashboardWarnings
  recentActivity: ActivityItem[]
}

/**
 * The Dashboard's figures, derived from the stored records each time with
 * the same rules as the demo (PRD section 10), so they always reconcile.
 */
@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: EventAccessService,
  ) {}

  async get(eventId: string, user: User): Promise<Dashboard> {
    const { event } = await this.access.authorize(eventId, user, 'VIEW')
    const [guestRows, tableRows, sendRows] = await Promise.all([
      this.prisma.guest.findMany({ where: { eventId } }),
      this.prisma.eventTable.findMany({ where: { eventId } }),
      this.prisma.messageSend.findMany({ where: { eventId } }),
    ])
    const guests = guestRows.map(toGuest)
    const tables = tableRows.map(toTable)
    const metrics = computeDashboardMetrics(guests, tables)
    const names = new Map(
      guests.map((guest) => [guest.id, guestFullName(guest)]),
    )
    return {
      metrics,
      warnings: computeDashboardWarnings(event, metrics, guests, tables),
      recentActivity: deriveRecentActivity(
        guests,
        sendRows.map(toSend),
        RECENT_ACTIVITY_LIMIT,
      ).map((entry) => ({
        ...entry,
        guestName: names.get(entry.guestId) ?? '',
      })),
    }
  }
}
