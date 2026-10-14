import { DomainError } from '../domain/errors.ts'
import type { Guest } from '../domain/models.ts'
import type { PrismaService } from '../prisma/prisma.service.ts'
import { guestData, toGuest } from '../prisma/mappers.ts'

export type Tx = Parameters<Parameters<PrismaService['$transaction']>[0]>[0]

/**
 * Locks the event's row for the rest of the transaction, so changes to its
 * guests are applied one after another and the rules (unique phones, table
 * capacity) are checked against what is really stored.
 */
export async function lockEvent(tx: Tx, eventId: string): Promise<void> {
  await tx.$queryRaw`SELECT id FROM "Event" WHERE id = ${eventId}::uuid FOR UPDATE`
}

/** Every guest of the event, deleted ones included (the rules need them). */
export async function loadGuests(tx: Tx, eventId: string): Promise<Guest[]> {
  const rows = await tx.guest.findMany({ where: { eventId } })
  return rows.map(toGuest)
}

export function activeGuest(guests: readonly Guest[], guestId: string): Guest {
  const guest = guests.find((candidate) => candidate.id === guestId)
  if (!guest || guest.deleted) {
    throw new DomainError('NOT_FOUND', { entity: 'guest' })
  }
  return guest
}

/** Writes a guest the rules produced: a new one, or changes to a stored one. */
export async function saveGuest(
  tx: Tx,
  guest: Guest,
  isNew: boolean,
): Promise<Guest> {
  const row = isNew
    ? await tx.guest.create({
        data: { id: guest.id, eventId: guest.eventId, ...guestData(guest) },
      })
    : await tx.guest.update({ where: { id: guest.id }, data: guestData(guest) })
  return toGuest(row)
}
