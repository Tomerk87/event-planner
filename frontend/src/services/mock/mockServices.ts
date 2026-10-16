import { assertEmail, findAccountByEmail } from '../../domain/accounts.ts'
import { DomainError } from '../../domain/errors.ts'
import { isEventPast } from '../../domain/eventTime.ts'
import {
  buildGuestExportRows,
  buildGuestExportTable,
  buildSeatingDetailRows,
  buildSeatingExportTable,
} from '../../domain/exports.ts'
import {
  assertMaxAttendeesCoversConfirmed,
  assertStartsInFuture,
  EVENT_LIMITS,
  validateCoverImage,
  validateEventInput,
} from '../../domain/events.ts'
import {
  addGuest,
  editGuest,
  recordInvitationSent,
  resolveGroup,
  softDeleteGuest,
} from '../../domain/guests.ts'
import { guestFullName } from '../../domain/guestList.ts'
import {
  assertLayoutVersion,
  emptyLayout,
  validateLayoutInput,
} from '../../domain/layout.ts'
import {
  buildWhatsAppUrl,
  renderMessage,
  validateTemplate,
} from '../../domain/messages.ts'
import {
  computeDashboardMetrics,
  computeDashboardWarnings,
  deriveRecentActivity,
} from '../../domain/metrics.ts'
import type {
  AccountNotification,
  Event,
  EventInvitation,
  EventLayout,
  EventTable,
  Guest,
  Id,
  RsvpSettings,
  UnknownRsvp,
  User,
} from '../../domain/models.ts'
import {
  assertCan,
  assertCanChangeInvitation,
  assertCanChangeMembership,
  effectiveRole,
  type Actor,
  type EventAction,
} from '../../domain/permissions.ts'
import { formatPhone, normalizePhone } from '../../domain/phone.ts'
import { EVENT_ROLES, type EventRole } from '../../domain/roles.ts'
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
  MessagePreview,
  Services,
} from '../contracts/index.ts'
import {
  calendarStartOf,
  DEFAULT_IMAGE_FRAMING,
  validateRsvpSettings,
} from '../../domain/rsvpSettings.ts'
import {
  createPreferencesService,
  type StoredPreferences,
} from '../preferences.ts'
import { readSpreadsheet, spreadsheetBlob } from '../spreadsheets.ts'
import { defaultMessageTemplate, defaultRsvpSettings } from './defaults.ts'
import { generateDemoState } from './generator.ts'
import { messageValuesFor, SAMPLE_GUEST } from './messageValues.ts'
import {
  createMemoryPersistence,
  type DemoPersistence,
  type Persistence,
} from './persistence.ts'
import {
  DATASET_VERSION,
  isUsableStoredDemo,
  withInvitations,
  type DemoState,
} from './state.ts'

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
  // Another tab of this browser saved newer data, such as a guest's RSVP.
  let outdated = false
  persistence.onChange?.(() => {
    outdated = true
  })

  function load(): DemoState {
    const stored = persistence.load()
    if (
      isUsableStoredDemo(stored, {
        requireCurrentUser: actingUserId === undefined,
        version: dataVersion,
      })
    ) {
      // Data saved before guests had groups reads as guests in no group.
      const found = withInvitations(stored.state)
      return {
        ...found,
        guests: found.guests.map((guest) => ({
          ...guest,
          group: guest.group ?? null,
        })),
        // Steps were renamed Stairs: a change of floor level (2026-10-16).
        layouts: found.layouts.map((layout) => ({
          ...layout,
          objects: layout.objects.map((object) =>
            (object.kind as string) === 'STEPS'
              ? { ...object, kind: 'STAIRS' as const }
              : object,
          ),
        })),
        // Settings saved before the calendar entry had its own date and time.
        // Settings saved before the picture could be zoomed and moved show
        // it as before: not enlarged, centred.
        rsvpSettings: found.rsvpSettings.map((stored) => {
          const settings = { ...DEFAULT_IMAGE_FRAMING, ...stored }
          const event = found.events.find(
            (candidate) => candidate.id === settings.eventId,
          )
          return settings.calendar.date !== undefined || !event
            ? settings
            : {
                ...settings,
                calendar: { ...calendarStartOf(event), ...settings.calendar },
              }
        }),
      }
    }
    // Nothing stored is a first visit; anything else is stale or damaged data.
    regenerated = stored !== null
    return save(seed(now()))
  }

  function save(next: DemoState): DemoState {
    persistence.save({ version: dataVersion, state: next })
    return next
  }

  /**
   * The demo's notices (D95), worked out from its data: access to each
   * event the visitor does not own, and answers from unknown phones waiting
   * on the events they manage. A newer unknown answer makes a new notice.
   */
  function demoNotifications(): AccountNotification[] {
    const userId = currentUserId()
    const read = new Set(state.readNotifications ?? [])
    const items: AccountNotification[] = []
    for (const membership of state.memberships) {
      const event = state.events.find(
        (candidate) => candidate.id === membership.eventId,
      )
      if (membership.userId !== userId || !event) {
        continue
      }
      if (membership.role !== 'OWNER') {
        const owner = state.memberships.find(
          (other) => other.eventId === event.id && other.role === 'OWNER',
        )
        const id = `notice-access-${event.id}`
        // Access came well before the event; the demo has no record of when.
        const given = Math.min(
          now().getTime(),
          new Date(event.startsAt).getTime() - 60 * 24 * 60 * 60 * 1000,
        )
        items.push({
          id,
          kind: 'ACCESS_GRANTED',
          eventId: event.id,
          eventName: event.name,
          actorName:
            state.users.find((user) => user.id === owner?.userId)?.name ?? null,
          role: membership.role,
          createdAt: new Date(given).toISOString(),
          read: read.has(id),
        })
      }
      const waiting = state.unknownRsvps
        .filter(
          (answer) => answer.eventId === event.id && answer.rejectedAt === null,
        )
        .map((answer) => answer.submittedAt)
        .sort()
      const latest = waiting.at(-1)
      if (membership.role !== 'VIEWER' && latest) {
        const id = `notice-unknown-${event.id}-${latest}`
        items.push({
          id,
          kind: 'UNKNOWN_RSVP',
          eventId: event.id,
          eventName: event.name,
          actorName: null,
          role: null,
          createdAt: latest,
          read: read.has(id),
        })
      }
    }
    return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
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
    action: () => Result | Promise<Result>,
  ): Promise<Result> {
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    } else {
      await Promise.resolve()
    }
    if (failOperations.has(operation)) {
      throw new DomainError('UNAVAILABLE', { operation })
    }
    if (outdated) {
      outdated = false
      state = load()
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

  /** The saved template filled in for a guest, and the link that sends it. */
  function prepareMessage(event: Event, guest: Guest): MessagePreview {
    const template = state.messageTemplates.find(
      (candidate) => candidate.eventId === event.id,
    )
    const message = renderMessage(
      template?.body ?? '',
      messageValuesFor(guest, event, baseUrl),
    )
    return {
      message,
      launchUrl: buildWhatsAppUrl(guest.normalizedPhone, message),
    }
  }

  function eventTables(eventId: Id): EventTable[] {
    return state.tables.filter((table) => table.eventId === eventId)
  }

  /** The stored plan, or an empty one; only tables that still exist. */
  function layoutOf(eventId: Id): EventLayout {
    const stored =
      state.layouts.find((layout) => layout.eventId === eventId) ??
      emptyLayout(eventId)
    const tables = new Set(eventTables(eventId).map((table) => table.id))
    return {
      ...stored,
      placements: stored.placements.filter((placement) =>
        tables.has(placement.tableId),
      ),
    }
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

  function invitationOf(eventId: Id, invitationId: Id): EventInvitation {
    return (
      state.invitations.find(
        (invitation) =>
          invitation.id === invitationId && invitation.eventId === eventId,
      ) ?? notFound('invitation')
    )
  }

  /** Roles arrive from outside the type system, so they are checked. */
  function assertRole(role: EventRole): void {
    if (!EVENT_ROLES.includes(role)) {
      throw new DomainError('VALIDATION', { field: 'role' })
    }
  }

  return {
    // The demo sends no email (D88): its user counts as verified, and the
    // email actions do not exist here.
    session: {
      getCurrentUser: () => run('session.getCurrentUser', currentUser),
      getEmailVerified: () => run('session.getEmailVerified', () => true),
      resendVerification: () =>
        run('session.resendVerification', () => notFound('email')),
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
          const coverImage = validateCoverImage(input.coverImage ?? null)
          assertStartsInFuture(fields.startsAt, now())
          const id = newId('evt')
          const event: Event = {
            ...fields,
            id,
            coverImage,
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
          const sourceLayout = layoutOf(eventId)
          const copiedId = new Map(
            eventTables(eventId).map((table, index) => [
              table.id,
              tables[index]!.id,
            ]),
          )
          const layout: EventLayout = {
            ...sourceLayout,
            eventId: id,
            placements: sourceLayout.placements.map((placement) => ({
              ...placement,
              tableId: copiedId.get(placement.tableId)!,
            })),
            objects: sourceLayout.objects.map((object) => ({ ...object })),
            version: 0,
          }
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
                // The copy is a new occasion, so its calendar entry follows it.
                calendar: { ...settings.calendar, ...calendarStartOf(event) },
                youtube: { ...settings.youtube },
              },
            ],
            messageTemplates: [
              ...state.messageTemplates,
              { ...template, eventId: id },
            ],
            tables: [...state.tables, ...tables],
            layouts: [...state.layouts, layout],
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
            invitations: kept(state.invitations),
            guests: kept(state.guests),
            unknownRsvps: kept(state.unknownRsvps),
            rsvpSettings: kept(state.rsvpSettings),
            messageTemplates: kept(state.messageTemplates),
            messageSends: kept(state.messageSends),
            tables: kept(state.tables),
            layouts: kept(state.layouts),
          })
        }),

      update: (eventId, input) =>
        run('events.update', () => {
          const { event } = authorize(eventId, 'EDIT')
          const fields = validateEventInput(input)
          const coverImage =
            input.coverImage === undefined
              ? event.coverImage
              : validateCoverImage(input.coverImage)
          // A date in the past would lock the event the moment it is saved.
          assertStartsInFuture(fields.startsAt, now())
          assertMaxAttendeesCoversConfirmed(
            fields.maxAttendees,
            event.maxAttendees,
            computeDashboardMetrics(eventGuests(eventId), [])
              .confirmedAttendees,
          )
          const updated: Event = { ...event, ...fields, coverImage }
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
          const { event } = authorize(eventId, 'EDIT')
          const { guest } = addGuest(state.guests, event, input, newId('gst'))
          commit(replaceGuest(guest))
          return guest
        }),

      update: (eventId, guestId, input) =>
        run('guests.update', () => {
          const { event } = authorize(eventId, 'EDIT')
          const guest = editGuest(
            state.guests,
            activeGuest(eventId, guestId),
            input,
            event.country,
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

      setGroup: (eventId, guestIds, group) =>
        run('guests.setGroup', () => {
          authorize(eventId, 'EDIT')
          const ids = new Set(guestIds)
          ids.forEach((guestId) => activeGuest(eventId, guestId))
          const resolved = resolveGroup(state.guests, eventId, group)
          commit({
            ...state,
            guests: state.guests.map((guest) =>
              ids.has(guest.id) ? { ...guest, group: resolved } : guest,
            ),
          })
        }),

      importMany: (eventId, inputs) =>
        run('guests.importMany', () => {
          const { event } = authorize(eventId, 'EDIT')
          let guests = state.guests
          let created = 0
          let restored = 0
          for (const input of inputs) {
            const result = addGuest(guests, event, input, newId('gst'))
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
          const { event } = authorize(eventId, 'EDIT')
          const unknown = pendingUnknown(eventId, unknownId)
          // The international form reads the same whatever the event's country.
          const { guest } = addGuest(
            state.guests,
            event,
            { ...input, phone: unknown.normalizedPhone },
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
            country: event.country,
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
          const normalizedPhone = normalizePhone(input.phone, event.country)
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
            phone: formatPhone(normalizedPhone),
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
          const updated = { eventId, body: validateTemplate(body) }
          commit({
            ...state,
            messageTemplates: state.messageTemplates.map((template) =>
              template.eventId === eventId ? updated : template,
            ),
          })
          return updated
        }),

      getDefaultTemplate: (eventId) =>
        run('messages.getDefaultTemplate', () => {
          const { event } = authorize(eventId, 'VIEW')
          return defaultMessageTemplate(event).body
        }),

      getValues: (eventId, guestId) =>
        run('messages.getValues', () => {
          const { event } = authorize(eventId, 'VIEW')
          return messageValuesFor(
            guestId === null
              ? SAMPLE_GUEST[event.rsvpLanguage]
              : activeGuest(eventId, guestId),
            event,
            baseUrl,
          )
        }),

      preview: (eventId, guestId) =>
        run('messages.preview', () => {
          const { event } = authorize(eventId, 'VIEW')
          return prepareMessage(event, activeGuest(eventId, guestId))
        }),

      send: (eventId, guestId) =>
        run('messages.send', () => {
          const { event } = authorize(eventId, 'SEND_MESSAGE')
          const guest = activeGuest(eventId, guestId)
          const { message, launchUrl } = prepareMessage(event, guest)
          if (message.trim() === '') {
            throw new DomainError('VALIDATION', { field: 'template' })
          }
          const sentAt = now().toISOString()
          const updated = recordInvitationSent(guest, sentAt)
          const send = { id: newId('snd'), eventId, guestId, sentAt, message }
          commit({
            ...replaceGuest(updated),
            messageSends: [...state.messageSends, send],
          })
          // Counted when the link is handed over: whether WhatsApp's own
          // Send was then pressed cannot be known.
          return { guest: updated, send, launchUrl }
        }),

      listSends: (eventId) =>
        run('messages.listSends', () => {
          authorize(eventId, 'VIEW')
          const guestsById = new Map(
            eventGuests(eventId).map((guest) => [guest.id, guest]),
          )
          return state.messageSends
            .filter((send) => send.eventId === eventId)
            .sort((a, b) => b.sentAt.localeCompare(a.sentAt))
            .map((send) => {
              const guest = guestsById.get(send.guestId)
              return {
                ...send,
                guestName: guest ? guestFullName(guest) : '',
                phone: guest?.phone ?? '',
                guestActive: guest !== undefined && !guest.deleted,
              }
            })
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
            layouts: state.layouts.map((layout) => ({
              ...layout,
              placements: layout.placements.filter(
                (placement) => placement.tableId !== tableId,
              ),
            })),
          })
        }),
    },

    layout: {
      get: (eventId) =>
        run('layout.get', () => {
          authorize(eventId, 'VIEW')
          return layoutOf(eventId)
        }),

      save: (eventId, input) =>
        run('layout.save', () => {
          authorize(eventId, 'EDIT')
          const current = layoutOf(eventId)
          assertLayoutVersion(input.version, current.version)
          // The demo keeps the picture itself, so its address is the picture.
          const saved: EventLayout = {
            eventId,
            ...validateLayoutInput(input, eventTables(eventId)),
            version: current.version + 1,
          }
          commit({
            ...state,
            layouts: [
              ...state.layouts.filter((layout) => layout.eventId !== eventId),
              saved,
            ],
          })
          return saved
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
          return {
            members: state.memberships
              .filter((membership) => membership.eventId === eventId)
              .map((membership) => memberOf(eventId, membership.userId))
              .sort(
                (a, b) =>
                  order[a.role] - order[b.role] ||
                  a.user.name.localeCompare(b.user.name),
              ),
            invitations: state.invitations
              .filter((invitation) => invitation.eventId === eventId)
              .sort((a, b) => a.email.localeCompare(b.email)),
          }
        }),

      invite: (eventId, emailInput, role) =>
        run('permissions.invite', () => {
          const { actor } = authorize(eventId, 'MANAGE_PERMISSIONS')
          const email = assertEmail(emailInput)
          assertRole(role)
          const user = findAccountByEmail(state.users, email)
          if (user) {
            if (
              state.memberships.some(
                (membership) =>
                  membership.eventId === eventId &&
                  membership.userId === user.id,
              )
            ) {
              throw new DomainError('ALREADY_MEMBER')
            }
            assertCanChangeMembership(actor, state.memberships, {
              eventId,
              userId: user.id,
              newRole: role,
            })
            commit({
              ...state,
              memberships: [
                ...state.memberships,
                { eventId, userId: user.id, role },
              ],
            })
            return { kind: 'member', member: memberOf(eventId, user.id) }
          }
          if (
            state.invitations.some(
              (invitation) =>
                invitation.eventId === eventId && invitation.email === email,
            )
          ) {
            throw new DomainError('ALREADY_INVITED')
          }
          assertCanChangeInvitation(actor, { currentRole: null, newRole: role })
          const invitation: EventInvitation = {
            id: newId('inv'),
            eventId,
            email,
            role,
          }
          commit({
            ...state,
            invitations: [...state.invitations, invitation],
          })
          return { kind: 'invitation', invitation }
        }),

      changeRole: (eventId, userId, role) =>
        run('permissions.changeRole', () => {
          const { actor } = authorize(eventId, 'MANAGE_PERMISSIONS')
          assertRole(role)
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

      changeInvitationRole: (eventId, invitationId, role) =>
        run('permissions.changeInvitationRole', () => {
          const { actor } = authorize(eventId, 'MANAGE_PERMISSIONS')
          assertRole(role)
          const current = invitationOf(eventId, invitationId)
          assertCanChangeInvitation(actor, {
            currentRole: current.role,
            newRole: role,
          })
          const changed = { ...current, role }
          commit({
            ...state,
            invitations: state.invitations.map((invitation) =>
              invitation.id === invitationId ? changed : invitation,
            ),
          })
          return changed
        }),

      cancelInvitation: (eventId, invitationId) =>
        run('permissions.cancelInvitation', () => {
          const { actor } = authorize(eventId, 'MANAGE_PERMISSIONS')
          const current = invitationOf(eventId, invitationId)
          assertCanChangeInvitation(actor, {
            currentRole: current.role,
            newRole: null,
          })
          commit({
            ...state,
            invitations: state.invitations.filter(
              (invitation) => invitation.id !== invitationId,
            ),
          })
        }),

      resendInvitation: () =>
        run('permissions.resendInvitation', () => notFound('email')),
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

    files: {
      readGuestFile: (eventId, file) =>
        run('files.readGuestFile', async () => {
          authorize(eventId, 'EDIT')
          return readSpreadsheet(file)
        }),

      exportGuests: (eventId, request) =>
        run('files.exportGuests', () => {
          authorize(eventId, 'EXPORT')
          const ids = new Set(request.guestIds)
          return spreadsheetBlob(
            buildGuestExportTable(
              buildGuestExportRows(
                eventGuests(eventId).filter((guest) => ids.has(guest.id)),
                eventTables(eventId),
              ),
              request.labels,
            ),
            request,
          )
        }),

      exportSeating: (eventId, request) =>
        run('files.exportSeating', () => {
          authorize(eventId, 'EXPORT')
          return spreadsheetBlob(
            buildSeatingExportTable(
              buildSeatingDetailRows(
                eventGuests(eventId),
                eventTables(eventId).filter(
                  (table) =>
                    request.tableIds === undefined ||
                    request.tableIds.includes(table.id),
                ),
              ),
              request.headings,
            ),
            request,
          )
        }),
    },

    system: {
      getEmailStatus: () =>
        run('system.getEmailStatus', () => notFound('system')),
      sendTestEmail: () =>
        run('system.sendTestEmail', () => notFound('system')),
    },

    notifications: {
      list: () =>
        run('notifications.list', () => {
          const items = demoNotifications()
          return {
            items,
            unread: items.filter((item) => !item.read).length,
          }
        }),

      markRead: (id) =>
        run('notifications.markRead', () => {
          const items = demoNotifications()
          if (id !== undefined && !items.some((item) => item.id === id)) {
            notFound('notification')
          }
          const marked = id === undefined ? items.map((item) => item.id) : [id]
          commit({
            ...state,
            readNotifications: [
              ...new Set([...(state.readNotifications ?? []), ...marked]),
            ],
          })
        }),
    },

    preferences: createPreferencesService(preferencesPersistence),

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
              commit(seed(now()))
            }),

          // The demo's clock belongs to its backend, which tells this.
          getEndsAt: () => run('demo.getEndsAt', () => null),

          consumeRegeneratedNotice: () => {
            const result = regenerated
            regenerated = false
            return result
          },
        },
  }
}
