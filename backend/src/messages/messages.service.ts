import { Inject, Injectable } from '@nestjs/common'
import { EventAccessService, isUuid } from '../access/event-access.service.ts'
import { APP_CONFIG, type AppConfig } from '../config.ts'
import { defaultMessageTemplate } from '../domain/defaults.ts'
import { DomainError } from '../domain/errors.ts'
import { guestFullName } from '../domain/guestList.ts'
import { recordInvitationSent } from '../domain/guests.ts'
import {
  buildWhatsAppUrl,
  renderMessage,
  validateTemplate,
  type MessageValues,
} from '../domain/messages.ts'
import type {
  Event,
  Guest,
  MessageSend,
  MessageTemplate,
  User,
} from '../domain/models.ts'
import {
  activeGuest,
  loadGuests,
  lockEvent,
  saveGuest,
} from '../guests/event-guests.ts'
import { PrismaService } from '../prisma/prisma.service.ts'
import { toEvent, toGuest, toSend } from '../prisma/mappers.ts'
import { messageValuesFor, SAMPLE_GUEST } from './message-values.ts'

export interface MessagePreview {
  message: string
  launchUrl: string
}

export interface SendResult extends MessagePreview {
  guest: Guest
  send: MessageSend
}

export interface SentMessage extends MessageSend {
  guestName: string
  phone: string
  guestActive: boolean
}

/**
 * The event's WhatsApp invitation (PRD section 7): its template, the message
 * for each guest, and the record of each send started from the system. A
 * send is counted when its link is handed over; delivery cannot be known.
 */
@Injectable()
export class MessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: EventAccessService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async getTemplate(eventId: string, user: User): Promise<MessageTemplate> {
    const { event } = await this.access.authorize(eventId, user, 'VIEW')
    return this.templateOf(toEvent(event))
  }

  async updateTemplate(
    eventId: string,
    body: string,
    user: User,
  ): Promise<MessageTemplate> {
    await this.access.authorize(eventId, user, 'EDIT')
    const row = await this.prisma.messageTemplate.upsert({
      where: { eventId },
      create: { eventId, body: validateTemplate(body) },
      update: { body: validateTemplate(body) },
    })
    return { eventId: row.eventId, body: row.body }
  }

  async getDefaultTemplate(eventId: string, user: User): Promise<string> {
    const { event } = await this.access.authorize(eventId, user, 'VIEW')
    return defaultMessageTemplate(toEvent(event)).body
  }

  /** Variable values for a guest, or for a made-up one when guestId is null. */
  async getValues(
    eventId: string,
    guestId: string | null,
    user: User,
  ): Promise<MessageValues> {
    const { event: row } = await this.access.authorize(eventId, user, 'VIEW')
    const event = toEvent(row)
    const guest =
      guestId === null
        ? SAMPLE_GUEST[event.rsvpLanguage]
        : await this.activeGuest(eventId, guestId)
    return messageValuesFor(guest, event, this.config.publicAppUrl)
  }

  async preview(
    eventId: string,
    guestId: string,
    user: User,
  ): Promise<MessagePreview> {
    const { event } = await this.access.authorize(eventId, user, 'VIEW')
    const resolved = toEvent(event)
    const guest = await this.activeGuest(eventId, guestId)
    return this.prepare(resolved, await this.templateOf(resolved), guest)
  }

  /**
   * Records one send and adds one to the guest's counter, together. The
   * counter never decreases (PRD section 6.4).
   */
  async send(
    eventId: string,
    guestId: string,
    user: User,
  ): Promise<SendResult> {
    const { event: row } = await this.access.authorize(
      eventId,
      user,
      'SEND_MESSAGE',
    )
    const event = toEvent(row)
    const template = await this.templateOf(event)
    return this.prisma.$transaction(async (tx) => {
      await lockEvent(tx, eventId)
      const guest = activeGuest(await loadGuests(tx, eventId), guestId)
      const { message, launchUrl } = this.prepare(event, template, guest)
      if (message.trim() === '') {
        throw new DomainError('VALIDATION', { field: 'template' })
      }
      const sentAt = new Date()
      const updated = await saveGuest(
        tx,
        recordInvitationSent(guest, sentAt.toISOString()),
        false,
      )
      const send = await tx.messageSend.create({
        data: { eventId, guestId, sentById: user.id, sentAt, message },
      })
      return { guest: updated, send: toSend(send), message, launchUrl }
    })
  }

  /** Newest first, including sends to guests deleted since. */
  async listSends(eventId: string, user: User): Promise<SentMessage[]> {
    await this.access.authorize(eventId, user, 'VIEW')
    const rows = await this.prisma.messageSend.findMany({
      where: { eventId },
      include: { guest: true },
      orderBy: [{ sentAt: 'desc' }, { id: 'asc' }],
    })
    return rows.map(({ guest, ...send }) => ({
      ...toSend(send),
      guestName: guestFullName(guest),
      phone: guest.phone,
      guestActive: !guest.deleted,
    }))
  }

  private async templateOf(event: Event): Promise<MessageTemplate> {
    const row = await this.prisma.messageTemplate.findUnique({
      where: { eventId: event.id },
    })
    return row
      ? { eventId: row.eventId, body: row.body }
      : defaultMessageTemplate(event)
  }

  private async activeGuest(eventId: string, guestId: string): Promise<Guest> {
    const row = isUuid(guestId)
      ? await this.prisma.guest.findFirst({
          where: { id: guestId, eventId, deleted: false },
        })
      : null
    if (!row) {
      throw new DomainError('NOT_FOUND', { entity: 'guest' })
    }
    return toGuest(row)
  }

  private prepare(
    event: Event,
    template: MessageTemplate,
    guest: Guest,
  ): MessagePreview {
    const message = renderMessage(
      template.body,
      messageValuesFor(guest, event, this.config.publicAppUrl),
    )
    return {
      message,
      launchUrl: buildWhatsAppUrl(guest.normalizedPhone, message),
    }
  }
}
