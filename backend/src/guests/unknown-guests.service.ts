import { Injectable } from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import { EventAccessService } from '../access/event-access.service.ts'
import { DomainError } from '../domain/errors.ts'
import { addGuest, type GuestInput } from '../domain/guests.ts'
import type { Guest, UnknownRsvp, User } from '../domain/models.ts'
import { applyRsvp, resolveRsvp } from '../domain/rsvp.ts'
import { PrismaService } from '../prisma/prisma.service.ts'
import { toUnknown } from '../prisma/mappers.ts'
import {
  activeGuest,
  loadGuests,
  lockEvent,
  saveGuest,
  type Tx,
} from './event-guests.ts'

/** RSVPs from phones that matched no guest, for the organizer to review (PRD section 9). */
@Injectable()
export class UnknownGuestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: EventAccessService,
  ) {}

  /** Responses awaiting review, newest first. */
  async list(eventId: string, user: User): Promise<UnknownRsvp[]> {
    await this.access.authorize(eventId, user, 'VIEW')
    const rows = await this.prisma.unknownRsvp.findMany({
      where: { eventId, rejectedAt: null },
      orderBy: { submittedAt: 'desc' },
    })
    return rows.map(toUnknown)
  }

  /** Rejected responses, most recently rejected first. */
  async listRejected(eventId: string, user: User): Promise<UnknownRsvp[]> {
    await this.access.authorize(eventId, user, 'VIEW')
    const rows = await this.prisma.unknownRsvp.findMany({
      where: { eventId, rejectedAt: { not: null } },
      orderBy: { rejectedAt: 'desc' },
    })
    return rows.map(toUnknown)
  }

  /** Adds the responder as a guest, keeping their response. */
  async convertToGuest(
    eventId: string,
    unknownId: string,
    input: Omit<GuestInput, 'phone'>,
    user: User,
  ): Promise<Guest> {
    await this.access.authorize(eventId, user, 'EDIT')
    return this.prisma.$transaction(async (tx) => {
      await lockEvent(tx, eventId)
      const unknown = await this.pending(tx, eventId, unknownId)
      const { guest, restored } = addGuest(
        await loadGuests(tx, eventId),
        eventId,
        { ...input, phone: unknown.phone },
        randomUUID(),
      )
      const saved = await saveGuest(
        tx,
        this.answered(guest, unknown),
        !restored,
      )
      await tx.unknownRsvp.delete({ where: { id: unknown.id } })
      return saved
    })
  }

  /** Applies the response to an existing guest and removes the unknown record. */
  async mergeIntoGuest(
    eventId: string,
    unknownId: string,
    guestId: string,
    user: User,
  ): Promise<Guest> {
    await this.access.authorize(eventId, user, 'EDIT')
    return this.prisma.$transaction(async (tx) => {
      await lockEvent(tx, eventId)
      const unknown = await this.pending(tx, eventId, unknownId)
      const guest = activeGuest(await loadGuests(tx, eventId), guestId)
      const saved = await saveGuest(tx, this.answered(guest, unknown), false)
      await tx.unknownRsvp.delete({ where: { id: unknown.id } })
      return saved
    })
  }

  /** Moves the response out of the review list; it is kept and can be restored. */
  async reject(eventId: string, unknownId: string, user: User): Promise<void> {
    await this.access.authorize(eventId, user, 'EDIT')
    await this.prisma.$transaction(async (tx) => {
      const unknown = await this.pending(tx, eventId, unknownId)
      await tx.unknownRsvp.update({
        where: { id: unknown.id },
        data: { rejectedAt: new Date() },
      })
    })
  }

  async restore(
    eventId: string,
    unknownId: string,
    user: User,
  ): Promise<UnknownRsvp> {
    await this.access.authorize(eventId, user, 'EDIT')
    const unknown = await this.find(this.prisma, eventId, unknownId)
    if (!unknown.rejectedAt) {
      throw new DomainError('NOT_FOUND', { entity: 'unknownRsvp' })
    }
    const restored = await this.prisma.unknownRsvp.update({
      where: { id: unknown.id },
      data: { rejectedAt: null },
    })
    return toUnknown(restored)
  }

  /** The guest with the response applied, and the name the responder typed. */
  private answered(guest: Guest, unknown: UnknownRsvp): Guest {
    return {
      ...applyRsvp(
        guest,
        resolveRsvp(
          unknown.rsvpStatus,
          unknown.confirmedAttendees,
          guest.allowedAttendees,
        ),
        unknown.submittedAt,
      ),
      invitationName: unknown.name,
    }
  }

  private async find(
    client: Tx | PrismaService,
    eventId: string,
    unknownId: string,
  ): Promise<UnknownRsvp> {
    const row = /^[0-9a-f-]{36}$/i.test(unknownId)
      ? await client.unknownRsvp.findFirst({
          where: { id: unknownId, eventId },
        })
      : null
    if (!row) {
      throw new DomainError('NOT_FOUND', { entity: 'unknownRsvp' })
    }
    return toUnknown(row)
  }

  /** A response still awaiting review; a rejected one must be restored first. */
  private async pending(
    tx: Tx,
    eventId: string,
    unknownId: string,
  ): Promise<UnknownRsvp> {
    const unknown = await this.find(tx, eventId, unknownId)
    if (unknown.rejectedAt) {
      throw new DomainError('NOT_FOUND', { entity: 'unknownRsvp' })
    }
    return unknown
  }
}
