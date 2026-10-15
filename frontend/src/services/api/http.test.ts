import { describe, expect, it, vi } from 'vitest'
import { DomainError } from '../../domain/errors.ts'
import { createHttp } from './http.ts'

function reply(status: number, body?: unknown) {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function setUp(response: Response | Error) {
  const fetch = vi.fn<typeof globalThis.fetch>(() =>
    response instanceof Error
      ? Promise.reject(response)
      : Promise.resolve(response),
  )
  const onUnauthenticated = vi.fn()
  const http = createHttp({ baseUrl: '/api', fetch, onUnauthenticated })
  return { http, fetch, onUnauthenticated }
}

describe('http', () => {
  it('sends JSON with the session cookie and reads JSON back', async () => {
    const { http, fetch } = setUp(reply(201, { id: 'e1' }))

    expect(await http.post('/events', { name: 'Party' })).toEqual({ id: 'e1' })

    const [url, init] = fetch.mock.calls[0]!
    expect(url).toBe('/api/events')
    expect(init).toMatchObject({
      method: 'POST',
      credentials: 'include',
      body: '{"name":"Party"}',
      headers: { 'Content-Type': 'application/json' },
    })
  })

  it('reads an empty answer as nothing', async () => {
    const { http } = setUp(new Response(null, { status: 204 }))

    expect(await http.post('/auth/sign-out')).toBeUndefined()
  })

  it('turns the API’s error body into the same DomainError', async () => {
    const { http } = setUp(
      reply(409, { code: 'TABLE_FULL', details: { available: 1, needed: 2 } }),
    )

    const error = await http.put('/x', {}).catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(DomainError)
    expect(error).toMatchObject({
      code: 'TABLE_FULL',
      details: { available: 1, needed: 2 },
    })
  })

  it.each([
    [401, 'UNAUTHENTICATED'],
    [403, 'FORBIDDEN'],
    [404, 'NOT_FOUND'],
    [413, 'VALIDATION'],
    [429, 'TOO_MANY_REQUESTS'],
    [502, 'UNAVAILABLE'],
  ])('reads a %i without the API’s body as %s', async (status, code) => {
    const { http } = setUp(new Response('<html>', { status }))

    await expect(http.get('/x')).rejects.toMatchObject({ code })
  })

  it('ignores an unknown code or unusable details', async () => {
    const { http } = setUp(reply(400, { code: 'NEW_CODE', details: 'x' }))

    await expect(http.get('/x')).rejects.toMatchObject({ code: 'VALIDATION' })
    const second = setUp(reply(400, { code: 'VALIDATION', details: { a: {} } }))
    await expect(second.http.get('/x')).rejects.toMatchObject({
      code: 'VALIDATION',
      details: {},
    })
  })

  it('reports a server that cannot be reached as unavailable', async () => {
    const { http } = setUp(new TypeError('Failed to fetch'))

    await expect(http.get('/x')).rejects.toMatchObject({ code: 'UNAVAILABLE' })
  })

  it('tells when the session is no longer accepted, and only then', async () => {
    const ended = setUp(reply(401, { code: 'UNAUTHENTICATED', details: {} }))
    await expect(ended.http.get('/events')).rejects.toBeInstanceOf(DomainError)
    expect(ended.onUnauthenticated).toHaveBeenCalledTimes(1)

    const wrongPassword = setUp(
      reply(401, { code: 'INVALID_CREDENTIALS', details: {} }),
    )
    await expect(
      wrongPassword.http.post('/auth/sign-in', {}),
    ).rejects.toBeInstanceOf(DomainError)
    expect(wrongPassword.onUnauthenticated).not.toHaveBeenCalled()
  })

  it('downloads a file and uploads a form', async () => {
    const download = setUp(new Response('a,b', { status: 200 }))
    const blob = await download.http.download('/export', { format: 'csv' })
    expect(await blob.text()).toBe('a,b')

    const upload = setUp(reply(200, { rows: [['a']] }))
    const form = new FormData()
    form.append('file', new File(['a'], 'guests.csv'))
    expect(await upload.http.upload('/read', form)).toEqual({ rows: [['a']] })
    const init = upload.fetch.mock.calls[0]![1]!
    expect(init.body).toBe(form)
    // The browser sets the multipart type and its boundary itself.
    expect(init.headers).not.toHaveProperty('Content-Type')
  })

  it('deletes', async () => {
    const { http, fetch } = setUp(new Response(null, { status: 204 }))

    await http.delete('/events/e1')

    expect(fetch.mock.calls[0]![1]).toMatchObject({ method: 'DELETE' })
  })
})
