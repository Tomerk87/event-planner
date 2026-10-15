import { describe, expect, it } from 'vitest'
import type { Services } from '../contracts/index.ts'
import { createApiBackend } from './apiBackend.ts'
import { createApiServices, createPublicRsvpApi } from './apiServices.ts'
import type { Http } from './http.ts'
// The backend's API description, written by `npm run openapi` there.
import openApi from '../../../../backend/openapi.json'

interface Call {
  method: string
  path: string
  body?: unknown
}

/** Records each request instead of sending it. */
function recordingHttp(calls: Call[]): Http {
  const record =
    (method: string) =>
    async (path: string, body?: unknown): Promise<never> => {
      calls.push({ method, path, body })
      return (
        method === 'GET' && path.endsWith('/template/default')
          ? { body: '' }
          : path.endsWith('/import/read')
            ? { rows: [] }
            : undefined
      ) as never
    }
  return {
    get: record('GET'),
    post: record('POST'),
    put: record('PUT'),
    delete: record('DELETE'),
    download: record('POST'),
    upload: record('POST'),
  }
}

const preferences = {
  getGuestColumns: async () => null,
  setGuestColumns: async () => undefined,
  getSidebarCollapsed: async () => false,
  setSidebarCollapsed: async () => undefined,
}

const event = {
  id: 'e1',
  name: 'Party',
  startsAt: '2031-01-01T18:00:00.000Z',
  timeZone: 'Asia/Jerusalem',
  maxAttendees: 100,
  defaultAllowedAttendees: 2,
  rsvpLanguage: 'en' as const,
  location: null,
  rsvpTitle: null,
  coverImage: null,
  rsvpSlug: 'slug',
}
const guest = {
  firstName: 'Dana',
  lastName: 'Lev',
  phone: '052-123-4567',
  allowedAttendees: 2,
}
const settings = {
  welcomeMessage: 'a',
  approvedMessage: 'b',
  declinedMessage: 'c',
  notSureMessage: 'd',
  backgroundImage: null,
  overlayOpacity: 40,
  calendar: {
    enabled: false,
    title: 't',
    date: '2031-01-01',
    time: '20:00',
    location: '',
  },
  youtube: { enabled: false, url: '' },
}

/** Every operation of the API provider, once. */
async function callEverything(services: Services): Promise<void> {
  const { events, guests, unknownGuests, rsvp, messages, tables } = services
  const { permissions, dashboard, files, session } = services
  await session.getCurrentUser()
  await events.list()
  await events.get('e1')
  await events.create(event)
  await events.update('e1', event)
  await events.duplicate('e1', { name: 'Copy', startsAt: event.startsAt })
  await events.remove('e1')
  await guests.list('e1')
  await guests.create('e1', guest)
  await guests.update('e1', 'g1', guest)
  await guests.remove('e1', 'g1')
  await guests.setRsvp('e1', 'g1', { status: 'APPROVED', attendees: 2 })
  await guests.assignTable('e1', 'g1', 't1')
  await guests.removeMany('e1', ['g1'])
  await guests.setGroup('e1', ['g1'], 'Family')
  await guests.importMany('e1', [guest])
  await unknownGuests.list('e1')
  await unknownGuests.listRejected('e1')
  await unknownGuests.convertToGuest('e1', 'u1', guest)
  await unknownGuests.mergeIntoGuest('e1', 'u1', 'g1')
  await unknownGuests.reject('e1', 'u1')
  await unknownGuests.restore('e1', 'u1')
  await rsvp.getSettings('e1')
  await rsvp.updateSettings('e1', settings)
  await rsvp.getPublicEvent('slug')
  await rsvp.submit('slug', {
    name: 'D',
    phone: '052',
    status: 'APPROVED',
    attendees: 1,
  })
  await messages.getTemplate('e1')
  await messages.updateTemplate('e1', 'Hi')
  await messages.getDefaultTemplate('e1')
  await messages.getValues('e1', null)
  await messages.getValues('e1', 'g1')
  await messages.preview('e1', 'g1')
  await messages.send('e1', 'g1')
  await messages.listSends('e1')
  await tables.list('e1')
  await tables.create('e1', { number: 1, capacity: 8, shape: 'CIRCLE' })
  await tables.update('e1', 't1', { number: 1, capacity: 8, shape: 'CIRCLE' })
  await tables.remove('e1', 't1')
  await permissions.list('e1')
  await permissions.invite('e1', 'a@example.com', 'VIEWER')
  await permissions.changeRole('e1', 'u1', 'ADMIN')
  await permissions.revoke('e1', 'u1')
  await permissions.changeInvitationRole('e1', 'i1', 'ADMIN')
  await permissions.cancelInvitation('e1', 'i1')
  await dashboard.get('e1')
  await files.readGuestFile('e1', new File(['a'], 'guests.csv'))
  const options = { format: 'csv' as const, sheetName: 'S', rightToLeft: false }
  await files.exportGuests('e1', {
    ...options,
    guestIds: ['g1'],
    labels: { headings: {}, statuses: {} } as never,
  })
  await files.exportSeating('e1', { ...options, headings: {} as never })
}

/** The routes of backend/openapi.json, as method and a pattern of the path. */
function apiRoutes(): { method: string; pattern: RegExp; path: string }[] {
  const document = openApi as unknown as {
    paths: Record<string, Record<string, unknown>>
  }
  return Object.entries(document.paths).flatMap(([path, operations]) =>
    Object.keys(operations).map((method) => ({
      method: method.toUpperCase(),
      path,
      pattern: new RegExp(
        `^${path.replace(/^\/api/, '').replace(/\{[^}]+\}/g, '[^/]+')}$`,
      ),
    })),
  )
}

describe('API provider', () => {
  it('calls only routes the backend describes in openapi.json', async () => {
    const calls: Call[] = []
    await callEverything(createApiServices(recordingHttp(calls), preferences))
    const routes = apiRoutes()

    const unknown = calls.filter(
      (call) =>
        !routes.some(
          (route) =>
            route.method === call.method &&
            route.pattern.test(call.path.split('?')[0]!),
        ),
    )

    expect(unknown).toEqual([])
    expect(calls).toHaveLength(48)
  })

  it('sends only the fields the API accepts', async () => {
    const calls: Call[] = []
    const services = createApiServices(recordingHttp(calls), preferences)

    await services.events.update('e1', event)
    await services.events.update('e1', { ...event, coverImage: undefined })
    await services.unknownGuests.convertToGuest('e1', 'u1', {
      ...guest,
      id: 'g9',
    } as never)

    expect(Object.keys(calls[0]!.body as object).sort()).toEqual([
      'coverImage',
      'defaultAllowedAttendees',
      'location',
      'maxAttendees',
      'name',
      'rsvpLanguage',
      'rsvpTitle',
      'startsAt',
      'timeZone',
    ])
    // Left out, the photo is kept.
    expect(calls[1]!.body).not.toHaveProperty('coverImage')
    expect(calls[2]!.body).not.toHaveProperty('id')
  })

  it('refuses a large file before uploading it', async () => {
    const calls: Call[] = []
    const services = createApiServices(recordingHttp(calls), preferences)
    const large = new File(['x'], 'guests.csv')
    Object.defineProperty(large, 'size', { value: 6 * 1024 * 1024 })

    await expect(
      services.files.readGuestFile('e1', large),
    ).rejects.toMatchObject({
      code: 'VALIDATION',
      details: { field: 'fileSize' },
    })
    expect(calls).toEqual([])
  })

  it('escapes identifiers in the path', async () => {
    const calls: Call[] = []
    await createPublicRsvpApi(recordingHttp(calls)).getPublicEvent('a/b?c')

    expect(calls[0]!.path).toBe('/public/rsvp/a%2Fb%3Fc')
  })

  it('reads the account session from the server', async () => {
    const answers: Record<string, Response> = {
      '/api/auth/me': new Response(
        JSON.stringify({
          id: 'u1',
          name: 'R',
          email: 'r@x.com',
          isSuperUser: false,
        }),
        { status: 200 },
      ),
      '/api/auth/sign-out': new Response(null, { status: 204 }),
    }
    const backend = createApiBackend({
      baseUrl: '/api',
      preferences,
      fetch: async (input) => answers[String(input)]!,
    })

    expect(await backend.auth.getSession()).toEqual({
      workspace: 'account',
      userId: 'u1',
    })
    await expect(backend.auth.signOut()).resolves.toBeUndefined()
  })

  it('reads a refused session as nobody signed in, and passes on other failures', async () => {
    const refusing = createApiBackend({
      baseUrl: '/api',
      preferences,
      fetch: async () =>
        new Response(JSON.stringify({ code: 'UNAUTHENTICATED', details: {} }), {
          status: 401,
        }),
    })
    expect(await refusing.auth.getSession()).toBeNull()

    const down = createApiBackend({
      baseUrl: '/api',
      preferences,
      fetch: async () => {
        throw new TypeError('offline')
      },
    })
    await expect(down.auth.getSession()).rejects.toMatchObject({
      code: 'UNAVAILABLE',
    })
  })
})
