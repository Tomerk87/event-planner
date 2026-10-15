import { Injectable } from '@nestjs/common'
import { randomBytes } from 'node:crypto'
import { EventAccessService } from '../access/event-access.service.ts'
import {
  defaultMessageTemplate,
  defaultRsvpSettings,
} from '../domain/defaults.ts'
import { isEventPast } from '../domain/eventTime.ts'
import {
  assertMaxAttendeesCoversConfirmed,
  assertStartsInFuture,
  validateCoverImage,
  validateEventInput,
  type EventInput,
} from '../domain/events.ts'
import type { Event, User } from '../domain/models.ts'
import { effectiveRole } from '../domain/permissions.ts'
import { calendarStartOf } from '../domain/rsvpSettings.ts'
import type { EventRole } from '../domain/roles.ts'
import { PrismaService } from '../prisma/prisma.service.ts'
import { rsvpSettingsData, toEvent } from '../prisma/mappers.ts'
import { ImageStorage, imageUrl } from '../storage/image-storage.ts'

export interface EventAccessInfo {
  event: Event
  role: EventRole
  isPast: boolean
}

export interface EventSummary extends EventAccessInfo {
  confirmedAttendees: number
}

/** The identifier in an event's public RSVP address; long enough not to guess. */
function newRsvpSlug(): string {
  return randomBytes(9).toString('base64url')
}

@Injectable()
export class EventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: EventAccessService,
    private readonly storage: ImageStorage,
  ) {}

  /** Events the user can reach, soonest first; every event for a Super User. */
  async list(user: User, now: Date = new Date()): Promise<EventSummary[]> {
    const rows = await this.prisma.event.findMany({
      where: user.isSuperUser
        ? {}
        : { memberships: { some: { userId: user.id } } },
      include: { memberships: { where: { userId: user.id } } },
      orderBy: { startsAt: 'asc' },
    })
    const confirmed = await this.prisma.guest.groupBy({
      by: ['eventId'],
      where: {
        eventId: { in: rows.map((row) => row.id) },
        deleted: false,
        rsvpStatus: 'APPROVED',
      },
      _sum: { confirmedAttendees: true },
    })
    const totals = new Map(
      confirmed.map((row) => [row.eventId, row._sum.confirmedAttendees ?? 0]),
    )
    return rows.flatMap(({ memberships, ...row }) => {
      const role = effectiveRole({
        userId: user.id,
        isSuperUser: user.isSuperUser,
        role: memberships[0]?.role ?? null,
      })
      if (role === null) {
        return []
      }
      return [
        {
          event: toEvent(row),
          role,
          isPast: isEventPast({ startsAt: row.startsAt.toISOString() }, now),
          confirmedAttendees: totals.get(row.id) ?? 0,
        },
      ]
    })
  }

  async get(eventId: string, user: User): Promise<EventAccessInfo> {
    const context = await this.access.authorize(eventId, user, 'VIEW')
    return {
      event: toEvent(context.event),
      role: context.role,
      isPast: context.isPast,
    }
  }

  /** Creates an event with default RSVP texts and template; the creator is its Owner. */
  async create(input: EventInput, user: User): Promise<Event> {
    const fields = validateEventInput(input)
    const cover = validateCoverImage(input.coverImage ?? null)
    assertStartsInFuture(fields.startsAt, new Date())
    const coverImageKey = cover ? await this.storage.saveDataUrl(cover) : null
    const row = await this.prisma.$transaction(async (tx) => {
      const created = await tx.event.create({
        data: {
          ...fields,
          startsAt: new Date(fields.startsAt),
          coverImageKey,
          rsvpSlug: newRsvpSlug(),
          memberships: { create: { userId: user.id, role: 'OWNER' } },
        },
      })
      const event = toEvent(created)
      await tx.rsvpSettings.create({
        data: {
          eventId: created.id,
          ...rsvpSettingsData(defaultRsvpSettings(event), null),
        },
      })
      await tx.messageTemplate.create({
        data: { eventId: created.id, body: defaultMessageTemplate(event).body },
      })
      return created
    })
    return toEvent(row)
  }

  async update(eventId: string, input: EventInput, user: User): Promise<Event> {
    const { event } = await this.access.authorize(eventId, user, 'EDIT')
    const fields = validateEventInput(input)
    // A date in the past would lock the event the moment it is saved.
    assertStartsInFuture(fields.startsAt, new Date())
    if (fields.maxAttendees !== event.maxAttendees) {
      const confirmed = await this.prisma.guest.aggregate({
        where: { eventId, rsvpStatus: 'APPROVED', deleted: false },
        _sum: { confirmedAttendees: true },
      })
      assertMaxAttendeesCoversConfirmed(
        fields.maxAttendees,
        event.maxAttendees,
        confirmed._sum.confirmedAttendees ?? 0,
      )
    }
    const coverImageKey = await this.nextCover(
      event.coverImageKey,
      input.coverImage,
    )
    const updated = await this.prisma.event.update({
      where: { id: eventId },
      data: { ...fields, startsAt: new Date(fields.startsAt), coverImageKey },
    })
    if (event.coverImageKey !== coverImageKey) {
      await this.storage.remove(event.coverImageKey)
    }
    return toEvent(updated)
  }

  /**
   * Copies the event's details, RSVP settings, message template and tables
   * (with nobody seated). Guests, responses, sends and other members are not
   * copied; the user duplicating becomes the Owner (PRD section 5.3).
   */
  async duplicate(
    eventId: string,
    input: { name: string; startsAt: string },
    user: User,
  ): Promise<Event> {
    const { event: source } = await this.access.authorize(
      eventId,
      user,
      'DUPLICATE_EVENT',
    )
    const fields = validateEventInput({
      ...toEvent(source),
      name: input.name,
      startsAt: input.startsAt,
    })
    assertStartsInFuture(fields.startsAt, new Date())
    const [settings, template, tables] = await Promise.all([
      this.prisma.rsvpSettings.findUnique({ where: { eventId } }),
      this.prisma.messageTemplate.findUnique({ where: { eventId } }),
      this.prisma.eventTable.findMany({ where: { eventId } }),
    ])
    const coverImageKey = source.coverImageKey
      ? await this.storage.copy(source.coverImageKey)
      : null
    const backgroundImageKey = settings?.backgroundImageKey
      ? await this.storage.copy(settings.backgroundImageKey)
      : null
    const row = await this.prisma.$transaction(async (tx) => {
      const created = await tx.event.create({
        data: {
          ...fields,
          startsAt: new Date(fields.startsAt),
          coverImageKey,
          rsvpSlug: newRsvpSlug(),
          memberships: { create: { userId: user.id, role: 'OWNER' } },
        },
      })
      const event = toEvent(created)
      const defaults = rsvpSettingsData(defaultRsvpSettings(event), null)
      const { eventId: _source, ...copied } = settings ?? {
        eventId,
        ...defaults,
      }
      await tx.rsvpSettings.create({
        data: {
          ...copied,
          eventId: created.id,
          backgroundImageKey,
          // The copy is a new occasion, so its calendar entry follows it.
          calendarDate: calendarStartOf(event).date,
          calendarTime: calendarStartOf(event).time,
        },
      })
      await tx.messageTemplate.create({
        data: {
          eventId: created.id,
          body: template?.body ?? defaultMessageTemplate(event).body,
        },
      })
      await tx.eventTable.createMany({
        data: tables.map(({ number, capacity, shape }) => ({
          eventId: created.id,
          number,
          capacity,
          shape,
        })),
      })
      return created
    })
    return toEvent(row)
  }

  /** Deletes the event and everything in it, including its pictures. */
  async remove(eventId: string, user: User): Promise<void> {
    const { event } = await this.access.authorize(eventId, user, 'DELETE_EVENT')
    const settings = await this.prisma.rsvpSettings.findUnique({
      where: { eventId },
    })
    await this.prisma.$transaction(async (tx) => {
      // Seats first: a guest's table is checked against its event.
      await tx.guest.updateMany({ where: { eventId }, data: { tableId: null } })
      await tx.event.delete({ where: { id: eventId } })
    })
    await this.storage.remove(event.coverImageKey)
    await this.storage.remove(settings?.backgroundImageKey ?? null)
  }

  /**
   * The photo key after an update: unchanged when the value is left out or
   * is the photo's own address, removed for null, a new file for a picture.
   */
  private async nextCover(
    current: string | null,
    value: string | null | undefined,
  ): Promise<string | null> {
    if (value === undefined || (current && value === imageUrl(current))) {
      return current
    }
    const picture = validateCoverImage(value)
    return picture ? this.storage.saveDataUrl(picture) : null
  }
}
