import type { EventRole } from '../domain/roles.ts'
import type { PrismaService } from '../prisma/prisma.service.ts'

type Transaction = Parameters<Parameters<PrismaService['$transaction']>[0]>[0]

/** A notice for one account about one event (D95). */
export interface Notice {
  userId: string
  kind: 'ACCESS_GRANTED' | 'ROLE_CHANGED' | 'ACCESS_REMOVED'
  event: { id: string; name: string }
  actorName?: string | null
  role?: EventRole | null
}

/**
 * Records notices inside the transaction that made the change, so a notice
 * exists exactly when the change does.
 */
export async function notify(
  tx: Transaction,
  notices: Notice[],
): Promise<void> {
  if (notices.length === 0) {
    return
  }
  await tx.notification.createMany({
    data: notices.map((notice) => ({
      userId: notice.userId,
      kind: notice.kind,
      eventId: notice.event.id,
      eventName: notice.event.name,
      actorName: notice.actorName ?? null,
      role: notice.role ?? null,
    })),
  })
}

/**
 * Tells the event's Owners and Admins that an answer from a phone not on
 * the guest list waits for review. One unread notice per event is enough:
 * a further answer moves it to the top instead of adding another.
 */
export async function notifyUnknownRsvp(
  tx: Transaction,
  event: { id: string; name: string },
): Promise<void> {
  const managers = await tx.eventMembership.findMany({
    where: { eventId: event.id, role: { in: ['OWNER', 'ADMIN'] } },
    select: { userId: true },
  })
  for (const { userId } of managers) {
    const unread = await tx.notification.findFirst({
      where: {
        userId,
        eventId: event.id,
        kind: 'UNKNOWN_RSVP',
        readAt: null,
      },
      select: { id: true },
    })
    if (unread) {
      await tx.notification.update({
        where: { id: unread.id },
        data: { createdAt: new Date(), eventName: event.name },
      })
    } else {
      await tx.notification.create({
        data: {
          userId,
          kind: 'UNKNOWN_RSVP',
          eventId: event.id,
          eventName: event.name,
        },
      })
    }
  }
}
