import { Injectable } from '@nestjs/common'
import { EventAccessService } from '../access/event-access.service.ts'
import {
  assertLayoutVersion,
  validateLayoutInput,
  type LayoutInput,
} from '../domain/layout.ts'
import type { EventLayout, User } from '../domain/models.ts'
import { lockEvent, type Tx } from '../guests/event-guests.ts'
import { PrismaService } from '../prisma/prisma.service.ts'
import { toTable } from '../prisma/mappers.ts'
import { ImageStorage, imageUrl } from '../storage/image-storage.ts'

/**
 * The event's floor plan (D100): the room, where each table stands, the
 * other objects and the floor picture. It is saved whole, and a save made on
 * an older version than the stored one is refused, so two people editing at
 * once never overwrite each other unnoticed.
 */
@Injectable()
export class LayoutService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: EventAccessService,
    private readonly storage: ImageStorage,
  ) {}

  async get(eventId: string, user: User): Promise<EventLayout> {
    await this.access.authorize(eventId, user, 'VIEW')
    return this.read(this.prisma, eventId)
  }

  /**
   * Saves the plan. The floor picture is kept when its own address comes
   * back, replaced by a new picture, or removed with null.
   */
  async save(
    eventId: string,
    input: LayoutInput,
    user: User,
  ): Promise<EventLayout> {
    await this.access.authorize(eventId, user, 'EDIT')
    let added: string | null = null
    try {
      const { layout, removed } = await this.prisma.$transaction(async (tx) => {
        await lockEvent(tx, eventId)
        const event = await tx.event.findUniqueOrThrow({
          where: { id: eventId },
        })
        assertLayoutVersion(input.version, event.layoutVersion)
        const currentKey = event.floorImageKey
        const keep =
          currentKey !== null && input.floorImage === imageUrl(currentKey)
        const tables = (
          await tx.eventTable.findMany({ where: { eventId } })
        ).map(toTable)
        const fields = validateLayoutInput(
          { ...input, floorImage: keep ? null : input.floorImage },
          tables,
        )
        if (!keep && fields.floorImage !== null) {
          added = await this.storage.saveDataUrl(fields.floorImage)
        }
        const nextKey = keep ? currentKey : added

        await tx.event.update({
          where: { id: eventId },
          data: {
            roomWidth: fields.roomWidth,
            roomDepth: fields.roomDepth,
            floorImageKey: nextKey,
            floorImageTransparency: fields.floorImageTransparency,
            floorImageZoom: fields.floorImageZoom,
            floorImageRotation: fields.floorImageRotation,
            layoutVersion: event.layoutVersion + 1,
          },
        })
        await tx.eventTable.updateMany({
          where: { eventId },
          data: { x: null, y: null, rotation: 0 },
        })
        for (const placement of fields.placements) {
          await tx.eventTable.update({
            where: { id: placement.tableId },
            data: {
              x: placement.x,
              y: placement.y,
              rotation: placement.rotation,
            },
          })
        }
        await tx.venueObject.deleteMany({ where: { eventId } })
        await tx.venueObject.createMany({
          data: fields.objects.map((object, position) => ({
            ...object,
            eventId,
            position,
          })),
        })
        return {
          layout: await this.read(tx, eventId),
          removed: currentKey !== nextKey ? currentKey : null,
        }
      })
      await this.storage.remove(removed)
      return layout
    } catch (error) {
      // The save did not happen, so a picture stored for it is not needed.
      await this.storage.remove(added)
      throw error
    }
  }

  private async read(
    db: Tx | PrismaService,
    eventId: string,
  ): Promise<EventLayout> {
    const [event, tables, objects] = await Promise.all([
      db.event.findUniqueOrThrow({ where: { id: eventId } }),
      db.eventTable.findMany({
        where: { eventId, x: { not: null } },
        orderBy: { number: 'asc' },
      }),
      db.venueObject.findMany({
        where: { eventId },
        orderBy: { position: 'asc' },
      }),
    ])
    return {
      eventId,
      roomWidth: event.roomWidth,
      roomDepth: event.roomDepth,
      floorImage: event.floorImageKey ? imageUrl(event.floorImageKey) : null,
      floorImageTransparency: event.floorImageTransparency,
      floorImageZoom: event.floorImageZoom,
      floorImageRotation: event.floorImageRotation,
      placements: tables.map((table) => ({
        tableId: table.id,
        x: table.x!,
        y: table.y!,
        rotation: table.rotation,
      })),
      objects: objects.map((object) => ({
        id: object.id,
        kind: object.kind,
        x: object.x,
        y: object.y,
        width: object.width,
        height: object.height,
        rotation: object.rotation,
        label: object.label,
      })),
      version: event.layoutVersion,
    }
  }
}
