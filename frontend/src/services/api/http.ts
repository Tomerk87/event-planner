import {
  DomainError,
  type DomainErrorCode,
  type ErrorDetails,
} from '../../domain/errors.ts'

const CODES: readonly DomainErrorCode[] = [
  'UNAUTHENTICATED',
  'INVALID_CREDENTIALS',
  'TOO_MANY_REQUESTS',
  'FORBIDDEN',
  'EVENT_READ_ONLY',
  'NOT_FOUND',
  'VALIDATION',
  'INVALID_PHONE',
  'DUPLICATE_PHONE',
  'INVALID_ATTENDEE_COUNT',
  'GUEST_NOT_APPROVED',
  'TABLE_FULL',
  'DUPLICATE_TABLE_NUMBER',
  'LAST_OWNER',
  'SELF_PERMISSION',
  'ALREADY_MEMBER',
  'ALREADY_INVITED',
  'RSVP_CLOSED',
  'EMAIL_TAKEN',
  'ACCOUNT_NOT_FOUND',
  'LINK_EXPIRED',
  'UNAVAILABLE',
]

/** The code for a failure whose body could not be read. */
function codeForStatus(status: number): DomainErrorCode {
  switch (status) {
    case 401:
      return 'UNAUTHENTICATED'
    case 403:
      return 'FORBIDDEN'
    case 404:
      return 'NOT_FOUND'
    case 429:
      return 'TOO_MANY_REQUESTS'
    default:
      return status >= 400 && status < 500 ? 'VALIDATION' : 'UNAVAILABLE'
  }
}

function isDetails(value: unknown): value is ErrorDetails {
  return (
    typeof value === 'object' &&
    value !== null &&
    Object.values(value).every(
      (item) => typeof item === 'string' || typeof item === 'number',
    )
  )
}

/** Turns an error response of the API (`{ code, details }`) into a DomainError. */
export async function toDomainError(response: Response): Promise<DomainError> {
  try {
    const body = (await response.json()) as {
      code?: unknown
      details?: unknown
    }
    if (CODES.includes(body.code as DomainErrorCode)) {
      return new DomainError(
        body.code as DomainErrorCode,
        isDetails(body.details) ? body.details : {},
      )
    }
  } catch {
    // Not the API's own error body; the status says enough.
  }
  return new DomainError(codeForStatus(response.status))
}

export interface HttpOptions {
  /** The API's address, such as `/api` (the same origin, through a proxy). */
  baseUrl: string
  /** Replaceable for tests, which have no browser cookie store. */
  fetch?: typeof fetch
  /** Called when the server no longer accepts the session. */
  onUnauthenticated?: () => void
}

export interface Http {
  get<T>(path: string): Promise<T>
  post<T>(path: string, body?: unknown): Promise<T>
  put<T>(path: string, body: unknown): Promise<T>
  delete(path: string): Promise<void>
  /** A POST whose answer is a file. */
  download(path: string, body: unknown): Promise<Blob>
  /** A POST of a form with a file. */
  upload<T>(path: string, form: FormData): Promise<T>
}

/**
 * The one way the application talks to the API: JSON in and out, the session
 * cookie sent along, and every failure turned into a DomainError so pages
 * show the same messages as with the demo.
 */
export function createHttp(options: HttpOptions): Http {
  const send = options.fetch ?? ((...args) => fetch(...args))

  async function request(
    method: string,
    path: string,
    body?: BodyInit,
    headers: Record<string, string> = {},
  ): Promise<Response> {
    let response: Response
    try {
      response = await send(`${options.baseUrl}${path}`, {
        method,
        body,
        headers: { Accept: 'application/json', ...headers },
        credentials: 'include',
      })
    } catch {
      throw new DomainError('UNAVAILABLE')
    }
    if (!response.ok) {
      const error = await toDomainError(response)
      if (error.code === 'UNAUTHENTICATED') {
        options.onUnauthenticated?.()
      }
      throw error
    }
    return response
  }

  function json(method: string, path: string, body?: unknown) {
    return body === undefined
      ? request(method, path)
      : request(method, path, JSON.stringify(body), {
          'Content-Type': 'application/json',
        })
  }

  async function read<T>(response: Response): Promise<T> {
    return response.status === 204
      ? (undefined as T)
      : ((await response.json()) as T)
  }

  return {
    get: async (path) => read(await json('GET', path)),
    post: async (path, body) => read(await json('POST', path, body)),
    put: async (path, body) => read(await json('PUT', path, body)),
    delete: async (path) => {
      await json('DELETE', path)
    },
    download: async (path, body) => (await json('POST', path, body)).blob(),
    upload: async (path, form) => read(await request('POST', path, form)),
  }
}
