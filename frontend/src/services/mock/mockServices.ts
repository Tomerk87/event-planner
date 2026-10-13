import { DomainError } from '../../domain/errors.ts'
import { isEventPast } from '../../domain/eventTime.ts'
import {
  assertStartsInFuture,
  EVENT_LIMITS,
  validateEventInput,
} from '../../domain/events.ts'
import {
  addGuest,
  editGuest,
  recordInvitationSent,
  softDeleteGuest,
} from '../../domain/guests.ts'
import { renderMessage } from '../../domain/messages.ts'
import {
  computeDashboardMetrics,
  computeDashboardWarnings,
  deriveRecentActivity,
} from '../../domain/metrics.ts'
import type {
  Event,
  EventTable,
  Guest,
  Id,
  RsvpSettings,
  UnknownRsvp,
  User,
} from '../../domain/models.ts'
import {
  assertCan,
  assertCanChangeMembership,
  effectiveRole,
  type Actor,
  type EventAction,
} from '../../domain/permissions.ts'
import { normalizePhone } from '../../domain/phone.ts'
import type { EventRole } from '../../domain/roles.ts'
import {
  applyRsvp,
  resolveRsvp,
  validatePublicRsvpInput,
} from '../../domain/rsvp.ts'
import {
  assertCanAssign,
  tableOccupancy,
  validateTableInput,
} from '../../domain/seating.ts'
import type {
  EventAccessInfo,
  Member,
  RsvpSettingsInput,
  Services,
} from '../contracts/index.ts'
import { defaultMessageTemplate, defaultRsvpSettings } from './defaults.ts'
import { generateDemoState } from './generator.ts'
import { messageValuesFor } from './messageValues.ts'
import {
  createMemoryPersistence,
  type DemoPersistence,
  type Persistence,
} from './persistence.ts'
import { DATASET_VERSION, isUsableStoredDemo, type DemoState } from './state.ts'

const MAX_MESSAGE_LENGTH = 500
const RECENT_ACTIVITY_LIMIT = 50

export interface MockOptions {
  persistence: DemoPersistence
  now?: () => Date
  /** Simulated response time of every operation. */
  delayMs?: number
  /** Operations (for example "guests.list") that fail with UNAVAILABLE. */
  failOperations?: ReadonlySet<string>
  /** Origin used to build the public RSVP address in messages. */
  baseUrl?: string
  /**
   * The signed-in account, for a workspace shared by several accounts. The
   * demo has a single built-in user and leaves this out.
   */
  actingUserId?: Id
  /** The data a new workspace starts with; the generated demo by default. */
  seed?: (now: Date) => DemoState
  /** Whether the demo-only controls (simulated role, reset) are offered. */
  demoControls?: boolean
  /** Version stamp of the stored data; the demo dataset's by default. */
  dataVersion?: number
  /** Where display choices are kept; in memory only when left out. */
  preferencesPersistence?: Persistence<StoredPreferences>
}

/** Display choices as stored in the browser. */
export interface StoredPreferences {
  guestColumns?: string[]
}

function readPreferences(stored: unknown): StoredPreferences {
  if (typeof stored !== 'object' || stored === null) {
    return {}
  }
  const { guestColumns } = stored as { guestColumns?: unknown }
  return Array.isArray(guestColumns) &&
    guestColumns.every((column) => typeof column === 'string')
    ? { guestColumns }
    : {}
}

interface EventContext {
  event: Event
  actor: Actor
  role: EventRole
  isPast: boolean
}

/**
 * The browser-local data provider behind Demo Mode. It applies the same
 * domain rules the backend will enforce, keeps its data in the visitor's own
 * browser, and has no external effects: nothing is sent, opened or uploaded.
 */
export function createMockServices(options: MockOptions): Services {
  const {
    persistence,
    now = () => new Date(),
    delayMs = 0,
    failOperations = new Set<string>(),
    baseUrl = '',
    actingUserId,
    seed = generateDemoState,
    demoControls = true,
    dataVersion = DATASET_VERSION,
    preferencesPersistence = createMemoryPersistence<StoredPreferences>(),
  } = options

  let regenerated = false
  let state = load()

  function load(): DemoState {
    const stored = persistence.load()
    if (
      isUsableStoredDemo(stored, {
        requireCurrentUser: actingUserId === undefined,
        version: dataVersion,
      })
    ) {
      return stored.state
    }
    // Nothing stored is a first visit; anything else is stale or damaged data.
    regenerated = stored !== null
    return save(seed(now()))
  }

  function save(next: DemoState): DemoState {
    persistence.save({ version: dataVersion, state: next })
    return next
  }

  function commit(next: DemoState): void {
    state = save(next)
  }

  function newId(prefix: string): Id {
    const id = `${prefix}-n${state.nextId}`
    state = { ...state, nextId: state.nextId + 1 }
    return id
  }

  async function run<Result>(
    operation: string,
    action: () => Result,
  ): Promise<Result> {
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    } else {
      await Promise.resolve()
    }
    if (failOperations.has(operation)) {
      throw new DomainError('UNAVAILABLE', { operation })
    }
    return action()
  }

  function notFound(entity: string): never {
    throw new DomainError('NOT_FOUND', { entity })
  }

  function currentUserId(): Id {
    return actingUserId ?? state.currentUserId
  }

  function currentUser(): User {
    const id = currentUserId()
    return state.users.find((user) => user.id === id) ?? notFound('user')
  }

  /**
   * Who is acting on an event. A simulated demo role replaces the user's own
   * role only on events they can already reach.
   */
  function actorFor(eventId: Id): Actor {
    const user = currentUser()
    const membership = state.memberships.find(
      (candidate) =>
        candidate.eventId === eventId && candidate.userId === user.id,
    )
    const base: Actor = {
      userId: user.id,
      isSuperUser: user.isSuperUser,
      role: membership?.role ?? null,
    }
    if (state.demoRole === 'SUPER_USER') {
      return { ...base, isSuperUser: true }
    }
    if (state.demoRole !== null && effectiveRole(base) !== null) {
      return { ...base, isSuperUser: false, role: state.demoRole }
    }
    return base
  }

  /** Looks up an event the user can reach; anything else is "not found". */
  function contextFor(eventId: Id): EventContext {
    const event = state.events.find((candidate) => candidate.id === eventId)
    if (!event) {
      return notFound('event')
    }
    const actor = actorFor(eventId)
    const role = effectiveRole(actor)
    if (role === null) {
      return notFound('event')
    }
    return { event, actor, role, isPast: isEventPast(event, now()) }
  }

  function authorize(eventId: Id, action: EventAction): EventContext {
    const context = contextFor(eventId)
    assertCan(action, context.actor, { isPastEvent: context.isPast })
    return context
  }

  function eventGuests(eventId: Id): Guest[] {
    return state.guests.filter((guest) => guest.eventId === eventId)
  }

  function activeGuest(eventId: Id, guestId: Id): Guest {
    return (
      state.guests.find(
        (guest) =>
          guest.id === guestId && guest.eventId === eventId && !guest.deleted,
      ) ?? notFound('guest')
    )
  }

  function eventTables(eventId: Id): EventTable[] {
    return state.tables.filter((table) => table.eventId === eventId)
  }

  function tableOf(eventId: Id, tableId: Id): EventTable {
    return (
      state.tables.find(
        (table) => table.id === tableId && table.eventId === eventId,
      ) ?? notFound('table')
    )
  }

  function unknownOf(eventId: Id, unknownId: Id): UnknownRsvp {
    return (
      state.unknownRsvps.find(
        (unknown) => unknown.id === unknownId && unknown.eventId === eventId,
      ) ?? notFound('unknownRsvp')
    )
  }

  /** A response still awaiting review; a rejected one must be restored first. */
  function pendingUnknown(eventId: Id, unknownId: Id): UnknownRsvp {
    const unknown = unknownOf(eventId, unknownId)
    return unknown.rejectedAt ? notFound('unknownRsvp') : unknown
  }

  function replaceUnknown(unknown: UnknownRsvp): DemoState {
    return {
      ...state,
      unknownRsvps: state.unknownRsvps.map((candidate) =>
        candidate.id === unknown.id ? unknown : candidate,
      ),
    }
  }

  function replaceGuest(guest: Guest): DemoState {
    const exists = state.guests.some((candidate) => candidate.id === guest.id)
    return {
      ...state,
      guests: exists
        ? state.guests.map((candidate) =>
            candidate.id === guest.id ? guest : candidate,
          )
        : [...state.guests, guest],
    }
  }

  function accessInfo(context: EventContext): EventAccessInfo {
    return { event: context.event, role: context.role, isPast: context.isPast }
  }

  function memberOf(eventId: Id, userId: Id): Member {
    const membership = state.memberships.find(
      (candidate) =>
        candidate.eventId === eventId && candidate.userId === userId,
    )
    const user = state.users.find((candidate) => candidate.id === userId)
    if (!membership || !user) {
      return notFound('membership')
    }
    return {
      user,
      role: membership.role,
      isCurrentUser: user.id === currentUserId(),
    }
  }

  function validateRsvpSettings(input: RsvpSettingsInput): RsvpSettingsInput {
    const messages = {
      welcomeMessage: input.welcomeMessage,
      approvedMessage: input.approvedMessage,
      declinedMessage: input.declinedMessage,
      notSureMessage: input.notSureMessage,
    }
    for (const [field, text] of Object.entries(messages)) {
      if (text.length > MAX_MESSAGE_LENGTH) {
        throw new DomainError('VALIDATION', { field, max: MAX_MESSAGE_LENGTH })
      }
    }
    if (
      !Number.isInteger(input.overlayOpacity) ||
      input.overlayOpacity < 0 ||
      input.overlayOpacity > 100
    ) {
      throw new DomainError('VALIDATION', {
        field: 'overlayOpacity',
        min: 0,
        max: 100,
      })
    }
    if (input.youtube.enabled && !/^https?:\/\/\S+$/.test(input.youtube.url)) {
      throw new DomainError('VALIDATION', { field: 'youtubeUrl' })
    }
    return {
      ...messages,
      backgroundImage: input.backgroundImage,
      overlayOpacity: input.overlayOpacity,
      calendar: { ...input.calendar },
      youtube: { ...input.youtube },
    }
  }

  return {
    session: {
      getCurrentUser: () => run('session.getCurrentUser', currentUser),
    },

    events: {
      list: () =>
        run('events.list', () =>
          state.events
            .filter((event) => effectiveRole(actorFor(event.id)) !== null)
            .map((event) => ({
              ...accessInfo(contextFor(event.id)),
              confirmedAttendees: computeDashboardMetrics(
                eventGuests(event.id),
                [],
              ).confirmedAttendees,
            }))
            .sort((a, b) => a.event.startsAt.localeCompare(b.event.startsAt)),
        ),

      get: (eventId) =>
        run('events.get', () => accessInfo(authorize(eventId, 'VIEW'))),

      create: (input) =>
        run('events.create', () => {
          const fields = validateEventInput(input)
          assertStartsInFuture(fields.startsAt, now())
          const id = newId('evt')
          const event: Event = {
            ...fields,
            id,
            coverImage: null,
            rsvpSlug: `${id}-${state.nextId.toString(36)}`,
          }
          commit({
            ...state,
            events: [...state.events, event],
            memberships: [
              ...state.memberships,
              { eventId: id, userId: currentUserId(), role: 'OWNER' },
            ],
            rsvpSettings: [...state.rsvpSettings, defaultRsvpSettings(event)],
            messageTemplates: [
              ...state.messageTemplates,
              defaultMessageTemplate(event),
            ],
          })
          return event
        }),

      duplicate: (eventId, input) =>
        run('events.duplicate', () => {
          const { event: source } = authorize(eventId, 'DUPLICATE_EVENT')
          const fields = validateEventInput({
            ...source,
            name: input.name,
            startsAt: input.startsAt,
          })
          assertStartsInFuture(fields.startsAt, now())
          const id = newId('evt')
          const event: Event = {
            ...fields,
            id,
            coverImage: source.coverImage,
            rsvpSlug: `${id}-${state.nextId.toString(36)}`,
          }
          const settings =
            state.rsvpSettings.find(
              (candidate) => candidate.eventId === eventId,
            ) ?? defaultRsvpSettings(event)
          const template =
            state.messageTemplates.find(
              (candidate) => candidate.eventId === eventId,
            ) ?? defaultMessageTemplate(event)
          const tables = eventTables(eventId).map((table) => ({
            ...table,
            id: newId('tbl'),
            eventId: id,
          }))
          commit({
            ...state,
            events: [...state.events, event],
            memberships: [
              ...state.memberships,
              { eventId: id, userId: currentUserId(), role: 'OWNER' },
            ],
            rsvpSettings: [
              ...state.rsvpSettings,
              {
                ...settings,
                eventId: id,
                calendar: { ...settings.calendar },
                youtube: { ...settings.youtube },
              },
            ],
            messageTemplates: [
              ...state.messageTemplates,
              { ...template, eventId: id },
            ],
            tables: [...state.tables, ...tables],
          })
          return event
        }),

      remove: (eventId) =>
        run('events.remove', () => {
          authorize(eventId, 'DELETE_EVENT')
          const kept = <Item extends { eventId: Id }>(items: Item[]): Item[] =>
            items.filter((item) => item.eventId !== eventId)
          commit({
            ...state,
            events: state.events.filter((event) => event.id !== eventId),
            memberships: kept(state.memberships),
            guests: kept(state.guests),
            unknownRsvps: kept(state.unknownRsvps),
            rsvpSettings: kept(state.rsvpSettings),
            messageTemplates: kept(state.messageTemplates),
            messageSends: kept(state.messageSends),
            tables: kept(state.tables),
          })
        }),

      update: (eventId, input) =>
        run('events.update', () => {
          const { event } = authorize(eventId, 'EDIT')
          const updated: Event = { ...event, ...validateEventInput(input) }
          commit({
            ...state,
            events: state.events.map((candidate) =>
              candidate.id === eventId ? updated : candidate,
            ),
          })
          return updated
        }),
    },

    guests: {
      list: (eventId) =>
        run('guests.list', () => {
          authorize(eventId, 'VIEW')
          return eventGuests(eventId).filter((guest) => !guest.deleted)
        }),

      create: (eventId, input) =>
        run('guests.create', () => {
          authorize(eventId, 'EDIT')
          const { guest } = addGuest(state.guests, eventId, input, newId('gst'))
          commit(replaceGuest(guest))
          return guest
        }),

      update: (eventId, guestId, input) =>
        run('guests.update', () => {
          authorize(eventId, 'EDIT')
          const guest = editGuest(
            state.guests,
            activeGuest(eventId, guestId),
            input,
          )
          commit(replaceGuest(guest))
          return guest
        }),

      remove: (eventId, guestId) =>
        run('guests.remove', () => {
          authorize(eventId, 'EDIT')
          commit(replaceGuest(softDeleteGuest(activeGuest(eventId, guestId))))
        }),

      setRsvp: (eventId, guestId, input) =>
        run('guests.setRsvp', () => {
          authorize(eventId, 'EDIT')
          const guest = activeGuest(eventId, guestId)
          const updated = applyRsvp(
            guest,
            resolveRsvp(input.status, input.attendees, guest.allowedAttendees),
            now().toISOString(),
          )
          commit(replaceGuest(updated))
          return updated
        }),

      assignTable: (eventId, guestId, tableId) =>
        run('guests.assignTable', () => {
          authorize(eventId, 'EDIT')
          const guest = activeGuest(eventId, guestId)
          const table = tableId === null ? null : tableOf(eventId, tableId)
          assertCanAssign(guest, table, state.guests)
          const updated: Guest = { ...guest, tableId }
          commit(replaceGuest(updated))
          return updated
        }),

      removeMany: (eventId, guestIds) =>
        run('guests.removeMany', () => {
          authorize(eventId, 'EDIT')
          const removed = new Map(
            [...new Set(guestIds)].map((guestId) => [
              guestId,
              softDeleteGuest(activeGuest(eventId, guestId)),
            ]),
          )
          commit({
            ...state,
            guests: state.guests.map((guest) => removed.get(guest.id) ?? guest),
          })
        }),

      importMany: (eventId, inputs) =>
        run('guests.importMany', () => {
          authorize(eventId, 'EDIT')
          let guests = state.guests
          let created = 0
          let restored = 0
          for (const input of inputs) {
            const result = addGuest(guests, eventId, input, newId('gst'))
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
          commit({ ...state, guests })
          return { created, restored }
        }),
    },

    unknownGuests: {
      list: (eventId) =>
        run('unknownGuests.list', () => {
          authorize(eventId, 'VIEW')
          return state.unknownRsvps
            .filter(
              (unknown) => unknown.eventId === eventId && !unknown.rejectedAt,
            )
            .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
        }),

      listRejected: (eventId) =>
        run('unknownGuests.listRejected', () => {
          authorize(eventId, 'VIEW')
          return state.unknownRsvps
            .filter(
              (unknown) => unknown.eventId === eventId && unknown.rejectedAt,
            )
            .sort((a, b) =>
              (b.rejectedAt ?? '').localeCompare(a.rejectedAt ?? ''),
            )
        }),

      convertToGuest: (eventId, unknownId, input) =>
        run('unknownGuests.convertToGuest', () => {
          authorize(eventId, 'EDIT')
          const unknown = pendingUnknown(eventId, unknownId)
          const { guest } = addGuest(
            state.guests,
            eventId,
            { ...input, phone: unknown.phone },
            newId('gst'),
          )
          const updated: Guest = {
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
          commit({
            ...replaceGuest(updated),
            unknownRsvps: state.unknownRsvps.filter(
              (candidate) => candidate.id !== unknownId,
            ),
          })
          return updated
        }),

      mergeIntoGuest: (eventId, unknownId, guestId) =>
        run('unknownGuests.mergeIntoGuest', () => {
          authorize(eventId, 'EDIT')
          const unknown = pendingUnknown(eventId, unknownId)
          const guest = activeGuest(eventId, guestId)
          const updated: Guest = {
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
          commit({
            ...replaceGuest(updated),
            unknownRsvps: state.unknownRsvps.filter(
              (candidate) => candidate.id !== unknownId,
            ),
          })
          return updated
        }),

      reject: (eventId, unknownId) =>
        run('unknownGuests.reject', () => {
          authorize(eventId, 'EDIT')
          const unknown = pendingUnknown(eventId, unknownId)
          commit(
            replaceUnknown({ ...unknown, rejectedAt: now().toISOString() }),
          )
        }),

      restore: (eventId, unknownId) =>
        run('unknownGuests.restore', () => {
          authorize(eventId, 'EDIT')
          const unknown = unknownOf(eventId, unknownId)
          if (!unknown.rejectedAt) {
            return notFound('unknownRsvp')
          }
          const restored: UnknownRsvp = { ...unknown, rejectedAt: null }
          commit(replaceUnknown(restored))
          return restored
        }),
    },

    rsvp: {
      getSettings: (eventId) =>
        run('rsvp.getSettings', () => {
          authorize(eventId, 'VIEW')
          return (
            state.rsvpSettings.find(
              (settings) => settings.eventId === eventId,
            ) ?? notFound('rsvpSettings')
          )
        }),

      updateSettings: (eventId, input) =>
        run('rsvp.updateSettings', () => {
          authorize(eventId, 'EDIT')
          const updated: RsvpSettings = {
            eventId,
            ...validateRsvpSettings(input),
          }
          commit({
            ...state,
            rsvpSettings: state.rsvpSettings.map((settings) =>
              settings.eventId === eventId ? updated : settings,
            ),
          })
          return updated
        }),

      // The public page has no signed-in user, so no role check applies.
      getPublicEvent: (rsvpSlug) =>
        run('rsvp.getPublicEvent', () => {
          const event =
            state.events.find((candidate) => candidate.rsvpSlug === rsvpSlug) ??
            notFound('event')
          const { eventId: _eventId, ...settings } =
            state.rsvpSettings.find(
              (candidate) => candidate.eventId === event.id,
            ) ?? defaultRsvpSettings(event)
          return {
            title: event.rsvpTitle ?? event.name,
            startsAt: event.startsAt,
            timeZone: event.timeZone,
            location: event.location,
            language: event.rsvpLanguage,
            isClosed: isEventPast(event, now()),
            maxSelectableAttendees: EVENT_LIMITS.allowedAttendees.max,
            settings,
          }
        }),

      submit: (rsvpSlug, input) =>
        run('rsvp.submit', () => {
          const event =
            state.events.find((candidate) => candidate.rsvpSlug === rsvpSlug) ??
            notFound('event')
          if (isEventPast(event, now())) {
            throw new DomainError('RSVP_CLOSED')
          }
          const { name } = validatePublicRsvpInput(input)
          const normalizedPhone = normalizePhone(input.phone)
          const respondedAt = now().toISOString()
          const guest = state.guests.find(
            (candidate) =>
              candidate.eventId === event.id &&
              candidate.normalizedPhone === normalizedPhone &&
              !candidate.deleted,
          )

          if (guest) {
            const outcome = resolveRsvp(
              input.status,
              input.attendees,
              guest.allowedAttendees,
            )
            commit(
              replaceGuest({
                ...applyRsvp(guest, outcome, respondedAt),
                invitationName: name,
              }),
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
          const existing = state.unknownRsvps.find(
            (candidate) =>
              candidate.eventId === event.id &&
              candidate.normalizedPhone === normalizedPhone,
          )
          const unknown: UnknownRsvp = {
            id: existing?.id ?? newId('unk'),
            eventId: event.id,
            name,
            phone: input.phone.trim(),
            normalizedPhone,
            rsvpStatus: input.status,
            confirmedAttendees: outcome.confirmedAttendees,
            submittedAt: respondedAt,
            // A new answer from a rejected phone is new information to review.
            rejectedAt: null,
          }
          commit({
            ...state,
            unknownRsvps: existing
              ? state.unknownRsvps.map((candidate) =>
                  candidate.id === existing.id ? unknown : candidate,
                )
              : [...state.unknownRsvps, unknown],
          })
          return {
            status: input.status,
            confirmedAttendees: outcome.confirmedAttendees,
          }
        }),
    },

    messages: {
      getTemplate: (eventId) =>
        run('messages.getTemplate', () => {
          authorize(eventId, 'VIEW')
          return (
            state.messageTemplates.find(
              (template) => template.eventId === eventId,
            ) ?? notFound('messageTemplate')
          )
        }),

      updateTemplate: (eventId, body) =>
        run('messages.updateTemplate', () => {
          authorize(eventId, 'EDIT')
          const updated = { eventId, body }
          commit({
            ...state,
            messageTemplates: state.messageTemplates.map((template) =>
              template.eventId === eventId ? updated : template,
            ),
          })
          return updated
        }),

      preview: (eventId, guestId) =>
        run('messages.preview', () => {
          const { event } = authorize(eventId, 'VIEW')
          const template = state.messageTemplates.find(
            (candidate) => candidate.eventId === eventId,
          )
          return renderMessage(
            template?.body ?? '',
            messageValuesFor(activeGuest(eventId, guestId), event, baseUrl),
          )
        }),

      send: (eventId, guestId) =>
        run('messages.send', () => {
          const { event } = authorize(eventId, 'SEND_MESSAGE')
          const guest = activeGuest(eventId, guestId)
          const template = state.messageTemplates.find(
            (candidate) => candidate.eventId === eventId,
          )
          if (!template || template.body.trim() === '') {
            throw new DomainError('VALIDATION', { field: 'template' })
          }
          const sentAt = now().toISOString()
          const updated = recordInvitationSent(guest, sentAt)
          const send = {
            id: newId('snd'),
            eventId,
            guestId,
            sentAt,
            message: renderMessage(
              template.body,
              messageValuesFor(guest, event, baseUrl),
            ),
          }
          commit({
            ...replaceGuest(updated),
            messageSends: [...state.messageSends, send],
          })
          // Simulated: no WhatsApp link is produced, so nothing is opened.
          return { guest: updated, send, launchUrl: null }
        }),

      listSends: (eventId) =>
        run('messages.listSends', () => {
          authorize(eventId, 'VIEW')
          return state.messageSends
            .filter((send) => send.eventId === eventId)
            .sort((a, b) => b.sentAt.localeCompare(a.sentAt))
        }),
    },

    tables: {
      list: (eventId) =>
        run('tables.list', () => {
          authorize(eventId, 'VIEW')
          return eventTables(eventId)
            .sort((a, b) => a.number - b.number)
            .map((table) => {
              const assigned = tableOccupancy(table.id, state.guests)
              return { table, assigned, available: table.capacity - assigned }
            })
        }),

      create: (eventId, input) =>
        run('tables.create', () => {
          authorize(eventId, 'EDIT')
          const table: EventTable = {
            id: newId('tbl'),
            eventId,
            ...validateTableInput(input, eventTables(eventId), null),
          }
          commit({ ...state, tables: [...state.tables, table] })
          return table
        }),

      update: (eventId, tableId, input) =>
        run('tables.update', () => {
          authorize(eventId, 'EDIT')
          const updated: EventTable = {
            ...tableOf(eventId, tableId),
            ...validateTableInput(input, eventTables(eventId), tableId),
          }
          commit({
            ...state,
            tables: state.tables.map((table) =>
              table.id === tableId ? updated : table,
            ),
          })
          return updated
        }),

      remove: (eventId, tableId) =>
        run('tables.remove', () => {
          authorize(eventId, 'EDIT')
          tableOf(eventId, tableId)
          commit({
            ...state,
            tables: state.tables.filter((table) => table.id !== tableId),
            guests: state.guests.map((guest) =>
              guest.tableId === tableId ? { ...guest, tableId: null } : guest,
            ),
          })
        }),
    },

    permissions: {
      list: (eventId) =>
        run('permissions.list', () => {
          authorize(eventId, 'VIEW_PERMISSIONS')
          const order: Record<EventRole, number> = {
            OWNER: 0,
            ADMIN: 1,
            VIEWER: 2,
          }
          return state.memberships
            .filter((membership) => membership.eventId === eventId)
            .map((membership) => memberOf(eventId, membership.userId))
            .sort(
              (a, b) =>
                order[a.role] - order[b.role] ||
                a.user.name.localeCompare(b.user.name),
            )
        }),

      listCandidates: (eventId) =>
        run('permissions.listCandidates', () => {
          authorize(eventId, 'MANAGE_PERMISSIONS')
          const members = new Set(
            state.memberships
              .filter((membership) => membership.eventId === eventId)
              .map((membership) => membership.userId),
          )
          return state.users.filter((user) => !members.has(user.id))
        }),

      grant: (eventId, userId, role) =>
        run('permissions.grant', () => {
          const { actor } = authorize(eventId, 'MANAGE_PERMISSIONS')
          if (!state.users.some((user) => user.id === userId)) {
            return notFound('user')
          }
          if (
            state.memberships.some(
              (membership) =>
                membership.eventId === eventId && membership.userId === userId,
            )
          ) {
            throw new DomainError('ALREADY_MEMBER')
          }
          assertCanChangeMembership(actor, state.memberships, {
            eventId,
            userId,
            newRole: role,
          })
          commit({
            ...state,
            memberships: [...state.memberships, { eventId, userId, role }],
          })
          return memberOf(eventId, userId)
        }),

      changeRole: (eventId, userId, role) =>
        run('permissions.changeRole', () => {
          const { actor } = authorize(eventId, 'MANAGE_PERMISSIONS')
          memberOf(eventId, userId)
          assertCanChangeMembership(actor, state.memberships, {
            eventId,
            userId,
            newRole: role,
          })
          commit({
            ...state,
            memberships: state.memberships.map((membership) =>
              membership.eventId === eventId && membership.userId === userId
                ? { ...membership, role }
                : membership,
            ),
          })
          return memberOf(eventId, userId)
        }),

      revoke: (eventId, userId) =>
        run('permissions.revoke', () => {
          const { actor } = authorize(eventId, 'MANAGE_PERMISSIONS')
          assertCanChangeMembership(actor, state.memberships, {
            eventId,
            userId,
            newRole: null,
          })
          commit({
            ...state,
            memberships: state.memberships.filter(
              (membership) =>
                !(
                  membership.eventId === eventId && membership.userId === userId
                ),
            ),
          })
        }),
    },

    dashboard: {
      get: (eventId) =>
        run('dashboard.get', () => {
          const { event } = authorize(eventId, 'VIEW')
          const guests = eventGuests(eventId)
          const tables = eventTables(eventId)
          const metrics = computeDashboardMetrics(guests, tables)
          const names = new Map(
            guests.map((guest) => [
              guest.id,
              `${guest.firstName} ${guest.lastName}`.trim(),
            ]),
          )
          return {
            metrics,
            warnings: computeDashboardWarnings(event, metrics, guests, tables),
            recentActivity: deriveRecentActivity(
              guests,
              state.messageSends.filter((send) => send.eventId === eventId),
              RECENT_ACTIVITY_LIMIT,
            ).map((entry) => ({
              ...entry,
              guestName: names.get(entry.guestId) ?? '',
            })),
          }
        }),
    },

    // Display choices are this browser's own, so they are read and saved at
    // once, with none of the simulated response time of event data.
    preferences: {
      getGuestColumns: async () =>
        readPreferences(preferencesPersistence.load()).guestColumns ?? null,

      setGuestColumns: async (columns) => {
        preferencesPersistence.save({
          ...readPreferences(preferencesPersistence.load()),
          guestColumns: [...columns],
        })
      },
    },

    demo: !demoControls
      ? null
      : {
          getRole: () => run('demo.getRole', () => state.demoRole),

          setRole: (role) =>
            run('demo.setRole', () => {
              commit({ ...state, demoRole: role })
            }),

          reset: () =>
            run('demo.reset', () => {
              persistence.clear()
              commit(generateDemoState(now()))
            }),

          consumeRegeneratedNotice: () => {
            const result = regenerated
            regenerated = false
            return result
          },
        },
  }
}
