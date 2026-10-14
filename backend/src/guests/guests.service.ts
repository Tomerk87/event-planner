import { Injectable } from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import { EventAccessService } from '../access/event-access.service.ts'
import { DomainError } from '../domain/errors.ts'
import {
  addGuest,
  editGuest,
  resolveGroup,
  softDeleteGuest,
  type GuestInput,
} from '../domain/guests.ts'
import { MAX_IMPORT_ROWS } from '../domain/guestImport.ts'
import {
  DEFAULT_GUEST_SORT,
  filterGuests,
  sortGuests,
  type GuestFilters,
  type GuestSort,
} from '../domain/guestList.ts'
import type { Guest, RsvpStatus, User } from '../domain/models.ts'
import { paginate, type Page } from '../domain/paging.ts'
import { applyRsvp, resolveRsvp } from '../domain/rsvp.ts'
import { assertCanAssign } from '../domain/seating.ts'
import { PrismaService } from '../prisma/prisma.service.ts'
import { toGuest, toTable } from '../prisma/mappers.ts'
import {
  activeGuest,
  loadGuests,
  lockEvent,
  saveGuest,
} from './event-guests.ts'

export interface ImportOutcome {
  created: number
  restored: number
}

/**
 * The guest list of an event, with the rules of PRD section 6: phones unique
 * per event, soft deletion, restoring a deleted guest re-added with the same
 * phone, and seats only for Approved guests within a table's capacity.
 */
@Injectable()
export class GuestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: EventAccessService,
  ) {}

  /** Active guests only. */
  async list(eventId: string, user: User): Promise<Guest[]> {
    await this.access.authorize(eventId, user, 'VIEW')
    const rows = await this.prisma.guest.findMany({
      where: { eventId, deleted: false },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    })
    return rows.map(toGuest)
  }

  /** A filtered, sorted page of the active guests, as the Guests page shows. */
  async search(
    eventId: string,
    user: User,
    query: {
      filters: GuestFilters
      sort: GuestSort
      page: number
      size: number
      locale: string
    },
  ): Promise<Page<Guest>> {
    await this.access.authorize(eventId, user, 'VIEW')
    const [rows, tables] = await Promise.all([
      this.prisma.guest.findMany({ where: { eventId, deleted: false } }),
      this.prisma.eventTable.findMany({ where: { eventId } }),
    ])
    const matching = sortGuests(
      filterGuests(rows.map(toGuest), query.filters, query.locale),
      query.sort ?? DEFAULT_GUEST_SORT,
      tables.map(toTable),
      query.locale,
    )
    return paginate(matching, query.page, query.size)
  }

  /** Adds a guest, or restores a soft-deleted one with the same phone. */
  async create(eventId: string, input: GuestInput, user: User): Promise<Guest> {
    await this.access.authorize(eventId, user, 'EDIT')
    return this.prisma.$transaction(async (tx) => {
      await lockEvent(tx, eventId)
      const guests = await loadGuests(tx, eventId)
      const { guest, restored } = addGuest(guests, eventId, input, randomUUID())
      return saveGuest(tx, guest, !restored)
    })
  }

  async update(
    eventId: string,
    guestId: string,
    input: GuestInput,
    user: User,
  ): Promise<Guest> {
    await this.access.authorize(eventId, user, 'EDIT')
    return this.prisma.$transaction(async (tx) => {
      await lockEvent(tx, eventId)
      const guests = await loadGuests(tx, eventId)
      const guest = editGuest(guests, activeGuest(guests, guestId), input)
      return saveGuest(tx, guest, false)
    })
  }

  /** Soft-deletes; the guest's seats are freed. */
  async remove(eventId: string, guestId: string, user: User): Promise<void> {
    await this.removeMany(eventId, [guestId], user)
  }

  /** Soft-deletes several guests; all of them or none. */
  async removeMany(
    eventId: string,
    guestIds: readonly string[],
    user: User,
  ): Promise<void> {
    await this.access.authorize(eventId, user, 'EDIT')
    await this.prisma.$transaction(async (tx) => {
      await lockEvent(tx, eventId)
      const guests = await loadGuests(tx, eventId)
      for (const guestId of new Set(guestIds)) {
        await saveGuest(
          tx,
          softDeleteGuest(activeGuest(guests, guestId)),
          false,
        )
      }
    })
  }

  /** The organizer's own change of a guest's RSVP; same rules as the public form. */
  async setRsvp(
    eventId: string,
    guestId: string,
    input: { status: RsvpStatus; attendees: number | null },
    user: User,
  ): Promise<Guest> {
    await this.access.authorize(eventId, user, 'EDIT')
    return this.prisma.$transaction(async (tx) => {
      await lockEvent(tx, eventId)
      const guest = activeGuest(await loadGuests(tx, eventId), guestId)
      const updated = applyRsvp(
        guest,
        resolveRsvp(input.status, input.attendees, guest.allowedAttendees),
        new Date().toISOString(),
      )
      return saveGuest(tx, updated, false)
    })
  }

  async assignTable(
    eventId: string,
    guestId: string,
    tableId: string | null,
    user: User,
  ): Promise<Guest> {
    await this.access.authorize(eventId, user, 'EDIT')
    return this.prisma.$transaction(async (tx) => {
      await lockEvent(tx, eventId)
      const guests = await loadGuests(tx, eventId)
      const guest = activeGuest(guests, guestId)
      const table =
        tableId === null
          ? null
          : await tx.eventTable.findFirst({ where: { id: tableId, eventId } })
      if (tableId !== null && !table) {
        throw new DomainError('NOT_FOUND', { entity: 'table' })
      }
      assertCanAssign(guest, table && toTable(table), guests)
      return saveGuest(tx, { ...guest, tableId }, false)
    })
  }

  /** Moves the guests to one group, replacing any they had; null clears it. */
  async setGroup(
    eventId: string,
    guestIds: readonly string[],
    group: string | null,
    user: User,
  ): Promise<void> {
    await this.access.authorize(eventId, user, 'EDIT')
    await this.prisma.$transaction(async (tx) => {
      await lockEvent(tx, eventId)
      const guests = await loadGuests(tx, eventId)
      const ids = [...new Set(guestIds)]
      ids.forEach((guestId) => activeGuest(guests, guestId))
      const resolved = resolveGroup(guests, eventId, group)
      await tx.guest.updateMany({
        where: { eventId, id: { in: ids } },
        data: { group: resolved },
      })
    })
  }

  /**
   * Adds many guests with the same rules as one at a time. If any entry is
   * invalid, nothing is saved.
   */
  async importMany(
    eventId: string,
    inputs: readonly GuestInput[],
    user: User,
  ): Promise<ImportOutcome> {
    await this.access.authorize(eventId, user, 'EDIT')
    if (inputs.length > MAX_IMPORT_ROWS) {
      throw new DomainError('VALIDATION', {
        field: 'rows',
        max: MAX_IMPORT_ROWS,
      })
    }
    return this.prisma.$transaction(
      async (tx) => {
        await lockEvent(tx, eventId)
        let guests = await loadGuests(tx, eventId)
        let created = 0
        let restored = 0
        for (const input of inputs) {
          const result = addGuest(guests, eventId, input, randomUUID())
          await saveGuest(tx, result.guest, !result.restored)
          if (result.restored) {
            restored += 1
            guests = guests.map((guest) =>
              guest.id === result.guest.id ? result.guest : guest,
            )
          } else {
            created += 1
            guests = [...guests, result.guest]
          }
        }
        return { created, restored }
      },
      { timeout: 60_000 },
    )
  }
}
