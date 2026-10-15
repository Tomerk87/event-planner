import { Injectable } from '@nestjs/common'
import { isUuid } from '../access/event-access.service.ts'
import { DomainError } from '../domain/errors.ts'
import type { AccountNotification, User } from '../domain/models.ts'
import { PrismaService } from '../prisma/prisma.service.ts'

/** How long a notice is kept (D95). */
const KEEP_DAYS = 90
/** The most recent notices listed under the bell. */
const LIST_SIZE = 30
const DAY_MS = 24 * 60 * 60 * 1000

export interface NotificationList {
  items: AccountNotification[]
  /** Unread notices, including any beyond the listed ones. */
  unread: number
}

/** The signed-in account's own notices (D95); nobody sees another's. */
@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(user: User, now: Date = new Date()): Promise<NotificationList> {
    // Old notices go when the list is next read; nothing needs a timer.
    await this.prisma.notification.deleteMany({
      where: {
        userId: user.id,
        createdAt: { lt: new Date(now.getTime() - KEEP_DAYS * DAY_MS) },
      },
    })
    const [rows, unread] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        take: LIST_SIZE,
      }),
      this.prisma.notification.count({
        where: { userId: user.id, readAt: null },
      }),
    ])
    return {
      items: rows.map((row) => ({
        id: row.id,
        kind: row.kind,
        eventId: row.eventId,
        eventName: row.eventName,
        actorName: row.actorName,
        role: row.role,
        createdAt: row.createdAt.toISOString(),
        read: row.readAt !== null,
      })),
      unread,
    }
  }

  /** Marks one notice read, or every notice when no id is given. */
  async markRead(user: User, id?: string): Promise<void> {
    if (id !== undefined && !isUuid(id)) {
      throw new DomainError('NOT_FOUND', { entity: 'notification' })
    }
    const result = await this.prisma.notification.updateMany({
      where: {
        userId: user.id,
        readAt: null,
        ...(id === undefined ? {} : { id }),
      },
      data: { readAt: new Date() },
    })
    if (id !== undefined && result.count === 0) {
      const exists = await this.prisma.notification.count({
        where: { id, userId: user.id },
      })
      if (exists === 0) {
        throw new DomainError('NOT_FOUND', { entity: 'notification' })
      }
    }
  }
}
