import { expect, type APIResponse, type Page } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { TEST_PASSWORD, uniqueEmail } from './helpers.ts'

/**
 * Sets up a real account's data through the API, as the browser of the
 * test page (sharing its session cookie), so a test spends its steps on the
 * flow it checks. Every request goes through the frontend's /api proxy.
 */

export interface Account {
  id: string
  name: string
  email: string
}

async function json<T>(response: APIResponse): Promise<T> {
  expect(response.ok(), await response.text()).toBe(true)
  return (await response.json()) as T
}

/** Signs the page up as a new account, with an email no other test uses. */
export async function signUpByApi(page: Page, name: string): Promise<Account> {
  const email = uniqueEmail(name.split(' ')[0]!.toLowerCase())
  return json<Account>(
    await page.request.post('/api/auth/sign-up', {
      data: { name, email, password: TEST_PASSWORD },
    }),
  )
}

export interface CreatedEvent {
  id: string
  name: string
  rsvpSlug: string
}

export async function createEventByApi(
  page: Page,
  overrides: Record<string, unknown> = {},
): Promise<CreatedEvent> {
  return json<CreatedEvent>(
    await page.request.post('/api/events', {
      data: {
        name: 'Garden Party',
        startsAt: '2031-06-01T17:00:00.000Z',
        timeZone: 'Asia/Jerusalem',
        maxAttendees: 120,
        defaultAllowedAttendees: 2,
        rsvpLanguage: 'en',
        country: 'IL',
        ...overrides,
      },
    }),
  )
}

export async function addGuestByApi(
  page: Page,
  eventId: string,
  guest: {
    firstName: string
    lastName?: string
    phone: string
    allowedAttendees?: number
  },
): Promise<{ id: string }> {
  return json<{ id: string }>(
    await page.request.post(`/api/events/${eventId}/guests`, {
      data: { lastName: '', allowedAttendees: 2, ...guest },
    }),
  )
}

export async function inviteByApi(
  page: Page,
  eventId: string,
  email: string,
  role: 'OWNER' | 'ADMIN' | 'VIEWER',
): Promise<void> {
  await json(
    await page.request.post(`/api/events/${eventId}/permissions/invitations`, {
      data: { email, role },
    }),
  )
}

/** Answers an event's public RSVP form, with no session at all. */
export async function answerRsvpByApi(
  page: Page,
  slug: string,
  answer: {
    name: string
    phone: string
    status: 'APPROVED' | 'NOT_SURE' | 'DECLINED'
    attendees: number
  },
): Promise<APIResponse> {
  return page.request.post(`/api/public/rsvp/${slug}`, { data: answer })
}

/** Runs backend/test/e2e-tools.ts on the test database. */
function testDatabase(...args: string[]): void {
  execFileSync('node', ['test/e2e-tools.ts', ...args], {
    cwd: path.resolve(import.meta.dirname, '../../backend'),
    stdio: 'pipe',
  })
}

/** Moves the event's start into the past, as time passing would. */
export function makePast(eventId: string): void {
  testDatabase('make-past', eventId)
}

export function makeSuperUser(email: string): void {
  testDatabase('super-user', email)
}
