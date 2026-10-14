import { Injectable } from '@nestjs/common'
import { DomainError } from '../domain/errors.ts'
import { isEventPast } from '../domain/eventTime.ts'
import type { User } from '../domain/models.ts'
import {
  assertCan,
  effectiveRole,
  type Actor,
  type EventAction,
} from '../domain/permissions.ts'
import type { EventRole } from '../domain/roles.ts'
import type { Event as EventRow } from '../generated/prisma/client.ts'
import { PrismaService } from '../prisma/prisma.service.ts'

export interface EventContext {
  event: EventRow
  actor: Actor
  /** Effective role: a Super User counts as Owner. */
  role: EventRole
  isPast: boolean
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Whether an identifier from an address can be looked up at all. */
export function isUuid(value: string): boolean {
  return UUID.test(value)
}

/**
 * Resolves who the user is in an event and checks an action against the
 * role matrix and the past-event rule, on every event-scoped request. An
 * event the user cannot reach is reported as not found, never as forbidden,
 * so its existence is not revealed.
 */
@Injectable()
export class EventAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async contextFor(
    eventId: string,
    user: User,
    now: Date = new Date(),
  ): Promise<EventContext> {
    if (!isUuid(eventId)) {
      throw new DomainError('NOT_FOUND', { entity: 'event' })
    }
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: { memberships: { where: { userId: user.id } } },
    })
    if (!event) {
      throw new DomainError('NOT_FOUND', { entity: 'event' })
    }
    const { memberships, ...row } = event
    const actor: Actor = {
      userId: user.id,
      isSuperUser: user.isSuperUser,
      role: memberships[0]?.role ?? null,
    }
    const role = effectiveRole(actor)
    if (role === null) {
      throw new DomainError('NOT_FOUND', { entity: 'event' })
    }
    return {
      event: row,
      actor,
      role,
      isPast: isEventPast({ startsAt: row.startsAt.toISOString() }, now),
    }
  }

  async authorize(
    eventId: string,
    user: User,
    action: EventAction,
  ): Promise<EventContext> {
    const context = await this.contextFor(eventId, user)
    assertCan(action, context.actor, { isPastEvent: context.isPast })
    return context
  }
}
