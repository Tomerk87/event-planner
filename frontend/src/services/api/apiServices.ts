import type { EventInput } from '../../domain/events.ts'
import type { GuestInput } from '../../domain/guests.ts'
import type { LayoutInput } from '../../domain/layout.ts'
import type { MessageValues } from '../../domain/messages.ts'
import type {
  Event,
  EventInvitation,
  EventLayout,
  EventTable,
  Guest,
  MessageTemplate,
  RsvpSettings,
  UnknownRsvp,
  User,
} from '../../domain/models.ts'
import type { PublicRsvpInput } from '../../domain/rsvp.ts'
import type { TableInput } from '../../domain/seating.ts'
import type {
  AccountEmailService,
  Dashboard,
  EmailStatus,
  EventAccessInfo,
  EventAccessList,
  EventSummary,
  ImportOutcome,
  InviteResult,
  Member,
  MessagePreview,
  NotificationList,
  PreferencesService,
  PublicRsvpResult,
  PublicRsvpService,
  PublicRsvpView,
  RsvpSettingsInput,
  SendResult,
  SentMessage,
  ServerFeatures,
  Services,
  TableWithOccupancy,
} from '../contracts/index.ts'
import type { Language } from '../../i18n/languages.ts'
import { assertGuestFileSize } from '../spreadsheets.ts'
import type { Http } from './http.ts'

/** `GET /auth/me`: the user, and whether their email is verified. */
type CurrentUser = User & { emailVerified: boolean }

/** A path segment from an identifier, which may come from the address bar. */
const at = (id: string) => encodeURIComponent(id)

/**
 * Only the fields the API accepts: pages pass whole records (an event, a
 * guest) back as input, and the server refuses anything it does not expect.
 */
function eventInput(input: EventInput): EventInput {
  const body: EventInput = {
    name: input.name,
    startsAt: input.startsAt,
    timeZone: input.timeZone,
    maxAttendees: input.maxAttendees,
    defaultAllowedAttendees: input.defaultAllowedAttendees,
    rsvpLanguage: input.rsvpLanguage,
    location: input.location ?? null,
    rsvpTitle: input.rsvpTitle ?? null,
  }
  // Left out, the photo is kept.
  if (input.coverImage !== undefined) {
    body.coverImage = input.coverImage
  }
  return body
}

function guestInput(input: Omit<GuestInput, 'phone'> & { phone?: string }) {
  return {
    firstName: input.firstName,
    lastName: input.lastName,
    ...(input.phone === undefined ? {} : { phone: input.phone }),
    allowedAttendees: input.allowedAttendees,
    group: input.group ?? null,
  }
}

function tableInput(input: TableInput): TableInput {
  return { number: input.number, capacity: input.capacity, shape: input.shape }
}

/** Only the fields the server reads; extra ones are refused. */
function layoutInput(input: LayoutInput): LayoutInput {
  return {
    roomWidth: input.roomWidth,
    roomDepth: input.roomDepth,
    floorImage: input.floorImage,
    floorImageTransparency: input.floorImageTransparency,
    floorImageZoom: input.floorImageZoom,
    floorImageRotation: input.floorImageRotation,
    placements: input.placements.map(({ tableId, x, y, rotation }) => ({
      tableId,
      x,
      y,
      rotation,
    })),
    objects: input.objects.map(
      ({ id, kind, x, y, width, height, rotation, label }) => ({
        id,
        kind,
        x,
        y,
        width,
        height,
        rotation,
        label,
      }),
    ),
    version: input.version,
  }
}

function rsvpSettingsInput(input: RsvpSettingsInput): RsvpSettingsInput {
  return {
    welcomeMessage: input.welcomeMessage,
    approvedMessage: input.approvedMessage,
    declinedMessage: input.declinedMessage,
    notSureMessage: input.notSureMessage,
    backgroundImage: input.backgroundImage,
    overlayOpacity: input.overlayOpacity,
    imageZoom: input.imageZoom,
    imagePositionX: input.imagePositionX,
    imagePositionY: input.imagePositionY,
    calendar: {
      enabled: input.calendar.enabled,
      title: input.calendar.title,
      date: input.calendar.date,
      time: input.calendar.time,
      location: input.calendar.location,
    },
    youtube: { enabled: input.youtube.enabled, url: input.youtube.url },
  }
}

/** The public RSVP page's operations; they need no session. */
export function createPublicRsvpApi(http: Http): PublicRsvpService {
  return {
    getPublicEvent: (slug) =>
      http.get<PublicRsvpView>(`/public/rsvp/${at(slug)}`),
    submit: (slug, input: PublicRsvpInput) =>
      http.post<PublicRsvpResult>(`/public/rsvp/${at(slug)}`, {
        name: input.name,
        phone: input.phone,
        status: input.status,
        attendees: input.attendees,
      }),
  }
}

/**
 * The real application's data operations, against the NestJS API. Rules and
 * permissions are applied by the server; this only carries requests and
 * answers. Display preferences stay in the browser (D86).
 */
export function createApiServices(
  http: Http,
  preferences: PreferencesService,
  /** The interface language, for the emails a request sends (D88). */
  language: () => Language = () => 'en',
): Services {
  const event = (eventId: string) => `/events/${at(eventId)}`

  return {
    session: {
      getCurrentUser: async () => {
        const { id, name, email, isSuperUser } =
          await http.get<CurrentUser>('/auth/me')
        return { id, name, email, isSuperUser }
      },
      getEmailVerified: async () =>
        (await http.get<CurrentUser>('/auth/me')).emailVerified,
      resendVerification: () =>
        http.post<void>('/auth/resend-verification', { language: language() }),
    },

    events: {
      list: () => http.get<EventSummary[]>('/events'),
      get: (eventId) => http.get<EventAccessInfo>(event(eventId)),
      create: (input) => http.post<Event>('/events', eventInput(input)),
      update: (eventId, input) =>
        http.put<Event>(event(eventId), eventInput(input)),
      duplicate: (eventId, input) =>
        http.post<Event>(`${event(eventId)}/duplicate`, {
          name: input.name,
          startsAt: input.startsAt,
        }),
      remove: (eventId) => http.delete(event(eventId)),
    },

    guests: {
      list: (eventId) => http.get<Guest[]>(`${event(eventId)}/guests`),
      create: (eventId, input) =>
        http.post<Guest>(`${event(eventId)}/guests`, guestInput(input)),
      update: (eventId, guestId, input) =>
        http.put<Guest>(
          `${event(eventId)}/guests/${at(guestId)}`,
          guestInput(input),
        ),
      remove: (eventId, guestId) =>
        http.delete(`${event(eventId)}/guests/${at(guestId)}`),
      setRsvp: (eventId, guestId, input) =>
        http.put<Guest>(`${event(eventId)}/guests/${at(guestId)}/rsvp`, {
          status: input.status,
          attendees: input.attendees,
        }),
      assignTable: (eventId, guestId, tableId) =>
        http.put<Guest>(`${event(eventId)}/guests/${at(guestId)}/table`, {
          tableId,
        }),
      removeMany: (eventId, guestIds) =>
        http.post<void>(`${event(eventId)}/guests/delete`, {
          guestIds: [...guestIds],
        }),
      setGroup: (eventId, guestIds, group) =>
        http.post<void>(`${event(eventId)}/guests/group`, {
          guestIds: [...guestIds],
          group,
        }),
      importMany: (eventId, inputs) =>
        http.post<ImportOutcome>(`${event(eventId)}/guests/import`, {
          guests: inputs.map(guestInput),
        }),
    },

    unknownGuests: {
      list: (eventId) =>
        http.get<UnknownRsvp[]>(`${event(eventId)}/unknown-guests`),
      listRejected: (eventId) =>
        http.get<UnknownRsvp[]>(`${event(eventId)}/unknown-guests/rejected`),
      convertToGuest: (eventId, unknownId, input) =>
        http.post<Guest>(
          `${event(eventId)}/unknown-guests/${at(unknownId)}/convert`,
          guestInput(input),
        ),
      mergeIntoGuest: (eventId, unknownId, guestId) =>
        http.post<Guest>(
          `${event(eventId)}/unknown-guests/${at(unknownId)}/merge`,
          { guestId },
        ),
      reject: (eventId, unknownId) =>
        http.post<void>(
          `${event(eventId)}/unknown-guests/${at(unknownId)}/reject`,
        ),
      restore: (eventId, unknownId) =>
        http.post<UnknownRsvp>(
          `${event(eventId)}/unknown-guests/${at(unknownId)}/restore`,
        ),
    },

    rsvp: {
      getSettings: (eventId) =>
        http.get<RsvpSettings>(`${event(eventId)}/rsvp-settings`),
      updateSettings: (eventId, input) =>
        http.put<RsvpSettings>(
          `${event(eventId)}/rsvp-settings`,
          rsvpSettingsInput(input),
        ),
      ...createPublicRsvpApi(http),
    },

    messages: {
      getTemplate: (eventId) =>
        http.get<MessageTemplate>(`${event(eventId)}/messages/template`),
      updateTemplate: (eventId, body) =>
        http.put<MessageTemplate>(`${event(eventId)}/messages/template`, {
          body,
        }),
      getDefaultTemplate: async (eventId) =>
        (
          await http.get<{ body: string }>(
            `${event(eventId)}/messages/template/default`,
          )
        ).body,
      getValues: (eventId, guestId) =>
        http.get<MessageValues>(
          `${event(eventId)}/messages/values${
            guestId === null ? '' : `?guestId=${at(guestId)}`
          }`,
        ),
      preview: (eventId, guestId) =>
        http.get<MessagePreview>(
          `${event(eventId)}/messages/preview/${at(guestId)}`,
        ),
      send: (eventId, guestId) =>
        http.post<SendResult>(
          `${event(eventId)}/messages/sends/${at(guestId)}`,
        ),
      listSends: (eventId) =>
        http.get<SentMessage[]>(`${event(eventId)}/messages/sends`),
    },

    tables: {
      list: (eventId) =>
        http.get<TableWithOccupancy[]>(`${event(eventId)}/tables`),
      create: (eventId, input) =>
        http.post<EventTable>(`${event(eventId)}/tables`, tableInput(input)),
      update: (eventId, tableId, input) =>
        http.put<EventTable>(
          `${event(eventId)}/tables/${at(tableId)}`,
          tableInput(input),
        ),
      remove: (eventId, tableId) =>
        http.delete(`${event(eventId)}/tables/${at(tableId)}`),
    },

    layout: {
      get: (eventId) => http.get<EventLayout>(`${event(eventId)}/layout`),
      save: (eventId, input) =>
        http.put<EventLayout>(`${event(eventId)}/layout`, layoutInput(input)),
    },

    permissions: {
      list: (eventId) =>
        http.get<EventAccessList>(`${event(eventId)}/permissions`),
      invite: (eventId, email, role) =>
        http.post<InviteResult>(`${event(eventId)}/permissions/invitations`, {
          email,
          role,
          language: language(),
        }),
      changeRole: (eventId, userId, role) =>
        http.put<Member>(
          `${event(eventId)}/permissions/members/${at(userId)}`,
          { role },
        ),
      revoke: (eventId, userId) =>
        http.delete(`${event(eventId)}/permissions/members/${at(userId)}`),
      changeInvitationRole: (eventId, invitationId, role) =>
        http.put<EventInvitation>(
          `${event(eventId)}/permissions/invitations/${at(invitationId)}`,
          { role },
        ),
      cancelInvitation: (eventId, invitationId) =>
        http.delete(
          `${event(eventId)}/permissions/invitations/${at(invitationId)}`,
        ),
      resendInvitation: (eventId, invitationId) =>
        http.post<void>(
          `${event(eventId)}/permissions/invitations/${at(invitationId)}/resend`,
          { language: language() },
        ),
    },

    dashboard: {
      get: (eventId) => http.get<Dashboard>(`${event(eventId)}/dashboard`),
    },

    files: {
      readGuestFile: async (eventId, file) => {
        // Checked before uploading, so a large file is not sent at all.
        assertGuestFileSize(file)
        const form = new FormData()
        form.append('file', file)
        return (
          await http.upload<{ rows: string[][] }>(
            `${event(eventId)}/guests/import/read`,
            form,
          )
        ).rows
      },
      exportGuests: (eventId, request) =>
        http.download(`${event(eventId)}/guests/export`, {
          format: request.format,
          guestIds: [...request.guestIds],
          labels: request.labels,
          sheetName: request.sheetName,
          rightToLeft: request.rightToLeft,
        }),
      exportSeating: (eventId, request) =>
        http.download(`${event(eventId)}/tables/export`, {
          format: request.format,
          headings: request.headings,
          sheetName: request.sheetName,
          rightToLeft: request.rightToLeft,
          ...(request.tableIds && { tableIds: request.tableIds }),
        }),
    },

    system: {
      getEmailStatus: () => http.get<EmailStatus>('/system/email'),
      sendTestEmail: () =>
        http.post<{ sent: boolean }>('/system/email/test', {
          language: language(),
        }),
    },

    notifications: {
      list: () => http.get<NotificationList>('/notifications'),
      markRead: (id) =>
        http.post<void>('/notifications/read', id === undefined ? {} : { id }),
    },

    preferences,

    demo: null,
  }
}

/** Emails of real accounts that need no session (D88). */
export function createAccountEmailApi(
  http: Http,
  language: () => Language = () => 'en',
): AccountEmailService {
  return {
    getFeatures: () => http.get<ServerFeatures>('/system/features'),
    forgotPassword: (email) =>
      http.post<void>('/auth/forgot-password', {
        email,
        language: language(),
      }),
    resetPassword: (token, password) =>
      http.post<void>('/auth/reset-password', { token, password }),
    verifyEmail: (token) => http.post<void>('/auth/verify-email', { token }),
  }
}
