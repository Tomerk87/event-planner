import { Inject, Injectable } from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import { EventAccessService } from '../access/event-access.service.ts'
import { APP_CONFIG, type AppConfig } from '../config.ts'
import { defaultRsvpSettings } from '../domain/defaults.ts'
import { DomainError } from '../domain/errors.ts'
import { isEventPast } from '../domain/eventTime.ts'
import { EVENT_LIMITS } from '../domain/events.ts'
import type {
  Event,
  RsvpLanguage,
  RsvpResponse,
  RsvpSettings,
  User,
} from '../domain/models.ts'
import { formatPhone, normalizePhone } from '../domain/phone.ts'
import {
  applyRsvp,
  resolveRsvp,
  validatePublicRsvpInput,
  type PublicRsvpInput,
} from '../domain/rsvp.ts'
import { validateRsvpSettings } from '../domain/rsvpSettings.ts'
import { loadGuests, lockEvent, saveGuest } from '../guests/event-guests.ts'
import { PrismaService } from '../prisma/prisma.service.ts'
import { rsvpSettingsData, toEvent, toRsvpSettings } from '../prisma/mappers.ts'
import { ImageStorage, imageUrl } from '../storage/image-storage.ts'
import { AttemptLimiter } from './attempt-limiter.ts'

export type RsvpSettingsInput = Omit<RsvpSettings, 'eventId'>

/** What the public page needs. Contains no guest records. */
export interface PublicRsvpView {
  title: string
  startsAt: string
  timeZone: string
  location: string | null
  language: RsvpLanguage
  isClosed: boolean
  maxSelectableAttendees: number
  settings: RsvpSettingsInput
}

/** The same for every phone, so it never tells whether the phone is a guest's. */
export interface PublicRsvpResult {
  status: RsvpResponse
  confirmedAttendees: number | null
}

/**
 * The event's RSVP page: the organizer's settings, and the one public link
 * every guest answers through (PRD section 8). A known phone updates its
 * guest; any other is kept as an unknown response for the organizer.
 */
@Injectable()
export class RsvpService {
  private readonly phoneAttempts: AttemptLimiter

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: EventAccessService,
    private readonly storage: ImageStorage,
    @Inject(APP_CONFIG) config: AppConfig,
  ) {
    this.phoneAttempts = new AttemptLimiter(
      config.rsvpLimits.perPhone,
      config.rsvpLimits.windowMinutes * 60_000,
    )
  }

  async getSettings(eventId: string, user: User): Promise<RsvpSettings> {
    const { event } = await this.access.authorize(eventId, user, 'VIEW')
    return this.settingsOf(toEvent(event))
  }

  /**
   * Saves the settings. The background picture is kept when its own address
   * comes back, replaced by a new picture, or removed with null.
   */
  async updateSettings(
    eventId: string,
    input: RsvpSettingsInput,
    user: User,
  ): Promise<RsvpSettings> {
    await this.access.authorize(eventId, user, 'EDIT')
    const stored = await this.prisma.rsvpSettings.findUnique({
      where: { eventId },
    })
    const currentKey = stored?.backgroundImageKey ?? null
    const keep =
      currentKey !== null && input.backgroundImage === imageUrl(currentKey)
    const settings = validateRsvpSettings({
      ...input,
      backgroundImage: keep ? null : input.backgroundImage,
    })
    const nextKey = keep
      ? currentKey
      : settings.backgroundImage
        ? await this.storage.saveDataUrl(settings.backgroundImage)
        : null
    const data = rsvpSettingsData({ eventId, ...settings }, nextKey)
    const row = await this.prisma.rsvpSettings.upsert({
      where: { eventId },
      create: { eventId, ...data },
      update: data,
    })
    if (currentKey !== nextKey) {
      await this.storage.remove(currentKey)
    }
    return toRsvpSettings(row)
  }

  // The public page has no signed-in user, so no role check applies.
  async getPublicEvent(
    slug: string,
    now: Date = new Date(),
  ): Promise<PublicRsvpView> {
    const event = await this.eventBySlug(slug)
    const { eventId: _eventId, ...settings } = await this.settingsOf(event)
    return {
      title: event.rsvpTitle ?? event.name,
      startsAt: event.startsAt,
      timeZone: event.timeZone,
      location: event.location,
      language: event.rsvpLanguage,
      isClosed: isEventPast(event, now),
      maxSelectableAttendees: EVENT_LIMITS.allowedAttendees.max,
      settings,
    }
  }

  /**
   * A guest's answer. Applied with the same rules as an organizer's change:
   * leaving Approved frees the seat, and a larger party stays seated even
   * when the table is then over capacity (a seating conflict to resolve).
   */
  async submit(
    slug: string,
    input: PublicRsvpInput,
    now: Date = new Date(),
  ): Promise<PublicRsvpResult> {
    const event = await this.eventBySlug(slug)
    if (isEventPast(event, now)) {
      throw new DomainError('RSVP_CLOSED')
    }
    const { name } = validatePublicRsvpInput(input)
    const normalizedPhone = normalizePhone(input.phone)
    // Only accepted answers count, so a guest correcting a mistake is not
    // locked out; the address limit covers failed attempts.
    const attemptKey = `${event.id}:${normalizedPhone}`
    if (!this.phoneAttempts.allows(attemptKey)) {
      throw new DomainError('TOO_MANY_REQUESTS')
    }
    const respondedAt = now.toISOString()

    const result = await this.prisma.$transaction(async (tx) => {
      await lockEvent(tx, event.id)
      const guest = (await loadGuests(tx, event.id)).find(
        (candidate) =>
          candidate.normalizedPhone === normalizedPhone && !candidate.deleted,
      )
      if (guest) {
        const outcome = resolveRsvp(
          input.status,
          input.attendees,
          guest.allowedAttendees,
        )
        await saveGuest(
          tx,
          { ...applyRsvp(guest, outcome, respondedAt), invitationName: name },
          false,
        )
        return {
          status: input.status,
          confirmedAttendees: outcome.confirmedAttendees,
        }
      }

      const outcome = resolveRsvp(
        input.status,
        input.attendees,
        event.defaultAllowedAttendees,
      )
      const answer = {
        name,
        phone: formatPhone(normalizedPhone),
        rsvpStatus: input.status,
        confirmedAttendees: outcome.confirmedAttendees,
        submittedAt: now,
        // A new answer from a rejected phone is new information to review.
        rejectedAt: null,
      }
      await tx.unknownRsvp.upsert({
        where: {
          eventId_normalizedPhone: { eventId: event.id, normalizedPhone },
        },
        create: {
          id: randomUUID(),
          eventId: event.id,
          normalizedPhone,
          ...answer,
        },
        update: answer,
      })
      return {
        status: input.status,
        confirmedAttendees: outcome.confirmedAttendees,
      }
    })
    this.phoneAttempts.record(attemptKey)
    return result
  }

  private async eventBySlug(slug: string): Promise<Event> {
    const row = await this.prisma.event.findUnique({
      where: { rsvpSlug: slug },
    })
    if (!row) {
      throw new DomainError('NOT_FOUND', { entity: 'event' })
    }
    return toEvent(row)
  }

  private async settingsOf(event: Event): Promise<RsvpSettings> {
    const row = await this.prisma.rsvpSettings.findUnique({
      where: { eventId: event.id },
    })
    return row ? toRsvpSettings(row) : defaultRsvpSettings(event)
  }
}
