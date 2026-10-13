import { describe, expect, it, vi } from 'vitest'
import type { DomainErrorCode } from '../../domain/errors.ts'
import { DomainError } from '../../domain/errors.ts'
import type { Guest } from '../../domain/models.ts'
import type { Services } from './index.ts'

/**
 * Behaviour every data provider must have, written only against the
 * `Services` interfaces. It runs on the mock provider today and is meant to
 * run unchanged on the API provider once the backend exists.
 *
 * The provider under test must start from the standard demo dataset with the
 * clock fixed, as `ContractEnvironment` describes.
 */
export interface ContractEnvironment {
  services: Services
  /** Events the signed-in user can reach, by their role and state. */
  events: {
    owner: string
    admin: string
    viewer: string
    past: string
  }
  /** Moves the provider's clock; used to cross an event's start time. */
  setNow: (now: Date) => void
}

async function codeOf(
  action: Promise<unknown>,
): Promise<DomainErrorCode | 'NO_ERROR'> {
  try {
    await action
  } catch (error) {
    if (error instanceof DomainError) {
      return error.code
    }
    throw error
  }
  return 'NO_ERROR'
}

const newGuest = {
  firstName: 'Contract',
  lastName: 'Tester',
  phone: '+972 00-777-0001',
  allowedAttendees: 4,
}

export function describeServicesContract(
  name: string,
  setup: () => ContractEnvironment,
): void {
  describe(`services contract: ${name}`, () => {
    async function findGuest(
      services: Services,
      eventId: string,
      test: (guest: Guest) => boolean,
    ): Promise<Guest> {
      const guest = (await services.guests.list(eventId)).find(test)
      if (!guest) {
        throw new Error('the dataset has no guest matching the test')
      }
      return guest
    }

    describe('session and events', () => {
      it('returns the signed-in user', async () => {
        const { services } = setup()

        const user = await services.session.getCurrentUser()

        expect(user.email).toMatch(/@example\.com$/)
        expect(user.isSuperUser).toBe(false)
      })

      it('lists the user’s events soonest first, with role and past state', async () => {
        const { services, events } = setup()

        const list = await services.events.list()
        const byId = new Map(list.map((item) => [item.event.id, item]))

        expect(list).toHaveLength(6)
        expect(list.map((item) => item.event.startsAt)).toEqual(
          list.map((item) => item.event.startsAt).sort(),
        )
        expect(byId.get(events.owner)).toMatchObject({
          role: 'OWNER',
          isPast: false,
        })
        expect(byId.get(events.admin)?.role).toBe('ADMIN')
        expect(byId.get(events.viewer)?.role).toBe('VIEWER')
        expect(byId.get(events.past)?.isPast).toBe(true)
        expect(byId.get(events.owner)?.confirmedAttendees).toBeGreaterThan(0)
      })

      it('gets one event and rejects an unknown one', async () => {
        const { services, events } = setup()

        expect((await services.events.get(events.owner)).role).toBe('OWNER')
        expect(await codeOf(services.events.get('no-such-event'))).toBe(
          'NOT_FOUND',
        )
      })

      it('creates an event owned by its creator, with default content', async () => {
        const { services } = setup()

        const created = await services.events.create({
          name: 'New Year Dinner',
          startsAt: '2031-01-01T18:00:00.000Z',
          timeZone: 'Asia/Jerusalem',
          maxAttendees: 80,
          defaultAllowedAttendees: 2,
          rsvpLanguage: 'he',
        })

        expect((await services.events.get(created.id)).role).toBe('OWNER')
        expect(await services.events.list()).toHaveLength(7)
        expect(await services.guests.list(created.id)).toEqual([])
        expect(
          (await services.messages.getTemplate(created.id)).body,
        ).toContain('{{rsvp_url}}')
        expect(
          (await services.rsvp.getPublicEvent(created.rsvpSlug)).language,
        ).toBe('he')
        expect(await services.permissions.list(created.id)).toHaveLength(1)
      })

      it('refuses to create an event that starts in the past', async () => {
        const { services, events } = setup()
        const { event: past } = await services.events.get(events.past)

        expect(await codeOf(services.events.create({ ...past }))).toBe(
          'VALIDATION',
        )
      })

      it('duplicates an event’s set-up, without its guests, for an Owner only', async () => {
        const { services, events } = setup()
        const copy = {
          name: 'Second Night',
          startsAt: '2031-03-01T17:00:00.000Z',
        }
        const { event: source } = await services.events.get(events.owner)
        await services.messages.updateTemplate(
          events.owner,
          'Join us {{rsvp_url}}',
        )
        const sourceTables = await services.tables.list(events.owner)
        const sourceMembers = await services.permissions.list(events.owner)

        const created = await services.events.duplicate(events.owner, copy)

        expect(created).toMatchObject({
          name: 'Second Night',
          startsAt: copy.startsAt,
          timeZone: source.timeZone,
          maxAttendees: source.maxAttendees,
          defaultAllowedAttendees: source.defaultAllowedAttendees,
          rsvpLanguage: source.rsvpLanguage,
        })
        expect(created.id).not.toBe(source.id)
        expect(created.rsvpSlug).not.toBe(source.rsvpSlug)
        expect((await services.events.get(created.id)).role).toBe('OWNER')
        expect((await services.messages.getTemplate(created.id)).body).toBe(
          'Join us {{rsvp_url}}',
        )
        expect(await services.rsvp.getSettings(created.id)).toMatchObject({
          welcomeMessage: (await services.rsvp.getSettings(events.owner))
            .welcomeMessage,
        })
        const tables = await services.tables.list(created.id)
        expect(tables.map(({ table }) => table.number)).toEqual(
          sourceTables.map(({ table }) => table.number),
        )
        expect(tables.every(({ assigned }) => assigned === 0)).toBe(true)
        expect(await services.guests.list(created.id)).toEqual([])
        expect(await services.unknownGuests.list(created.id)).toEqual([])
        expect(await services.messages.listSends(created.id)).toEqual([])
        expect(await services.permissions.list(created.id)).toHaveLength(1)

        // The original is untouched.
        expect(await services.tables.list(events.owner)).toEqual(sourceTables)
        expect(await services.permissions.list(events.owner)).toEqual(
          sourceMembers,
        )
        expect(
          await codeOf(services.events.duplicate(events.admin, copy)),
        ).toBe('FORBIDDEN')
        expect(
          await codeOf(services.events.duplicate(events.viewer, copy)),
        ).toBe('FORBIDDEN')
      })

      it('duplicates a past event, and validates the new name and date', async () => {
        const { services, events } = setup()
        const { role } = await services.events.get(events.past)
        expect(role).toBe('OWNER')

        const created = await services.events.duplicate(events.past, {
          name: 'Garden Party Again',
          startsAt: '2031-05-01T16:00:00.000Z',
        })

        expect((await services.events.get(created.id)).isPast).toBe(false)
        expect(
          await codeOf(
            services.events.duplicate(events.past, {
              name: ' ',
              startsAt: '2031-05-01T16:00:00.000Z',
            }),
          ),
        ).toBe('VALIDATION')
        expect(
          await codeOf(
            services.events.duplicate(events.past, {
              name: 'Too Late',
              startsAt: '2020-05-01T16:00:00.000Z',
            }),
          ),
        ).toBe('VALIDATION')
      })

      it('deletes an event and everything in it, for an Owner only', async () => {
        const { services, events } = setup()
        const { event } = await services.events.get(events.owner)

        expect(await codeOf(services.events.remove(events.admin))).toBe(
          'FORBIDDEN',
        )
        expect(await codeOf(services.events.remove(events.viewer))).toBe(
          'FORBIDDEN',
        )
        expect(await codeOf(services.events.remove('no-such-event'))).toBe(
          'NOT_FOUND',
        )

        await services.events.remove(events.owner)

        expect(await codeOf(services.events.get(events.owner))).toBe(
          'NOT_FOUND',
        )
        expect(await codeOf(services.guests.list(events.owner))).toBe(
          'NOT_FOUND',
        )
        expect(await codeOf(services.rsvp.getPublicEvent(event.rsvpSlug))).toBe(
          'NOT_FOUND',
        )
        const remaining = await services.events.list()
        expect(remaining).toHaveLength(5)
        expect(remaining.map((item) => item.event.id)).not.toContain(
          events.owner,
        )
      })

      it('deletes a past event', async () => {
        const { services, events } = setup()

        await services.events.remove(events.past)

        expect(await codeOf(services.events.get(events.past))).toBe('NOT_FOUND')
      })

      it('validates event input on create and update', async () => {
        const { services, events } = setup()
        const { event } = await services.events.get(events.owner)

        expect(
          await codeOf(
            services.events.update(events.owner, {
              ...event,
              maxAttendees: 49,
            }),
          ),
        ).toBe('VALIDATION')
        expect(
          await codeOf(services.events.create({ ...event, name: ' ' })),
        ).toBe('VALIDATION')
      })

      it('refuses to move an event into the past, and keeps what the form does not send', async () => {
        const { services, events } = setup()
        const { event } = await services.events.get(events.owner)

        await expect(
          services.events.update(events.owner, {
            ...event,
            startsAt: '2020-01-01T10:00:00.000Z',
          }),
        ).rejects.toMatchObject({
          code: 'VALIDATION',
          details: { field: 'startsAt', reason: 'past' },
        })

        const saved = await services.events.update(events.owner, {
          ...event,
          name: 'Renamed',
          location: '  ',
        })
        expect(saved).toMatchObject({
          id: event.id,
          name: 'Renamed',
          location: null,
          rsvpLanguage: event.rsvpLanguage,
          rsvpTitle: event.rsvpTitle,
          rsvpSlug: event.rsvpSlug,
          startsAt: event.startsAt,
        })
      })

      it('updates an event for an Owner and an Admin, not for a Viewer, and not once past', async () => {
        const { services, events } = setup()
        const edit = async (eventId: string) => {
          const { event } = await services.events.get(eventId)
          return codeOf(
            services.events.update(eventId, { ...event, maxAttendees: 250 }),
          )
        }

        expect(await edit(events.owner)).toBe('NO_ERROR')
        expect(await edit(events.admin)).toBe('NO_ERROR')
        expect(await edit(events.viewer)).toBe('FORBIDDEN')
        expect(await edit(events.past)).toBe('EVENT_READ_ONLY')
        expect(
          (await services.events.get(events.owner)).event.maxAttendees,
        ).toBe(250)
      })
    })

    describe('guests', () => {
      it('lists active guests only', async () => {
        const { services, events } = setup()

        const guests = await services.guests.list(events.owner)

        expect(guests.length).toBeGreaterThan(100)
        expect(guests.every((guest) => !guest.deleted)).toBe(true)
        expect(guests.every((guest) => guest.eventId === events.owner)).toBe(
          true,
        )
      })

      it('adds a guest and reflects it on the dashboard', async () => {
        const { services, events } = setup()
        const before = (await services.dashboard.get(events.owner)).metrics

        const guest = await services.guests.create(events.owner, newGuest)
        const after = (await services.dashboard.get(events.owner)).metrics

        expect(guest).toMatchObject({
          firstName: 'Contract',
          rsvpStatus: 'NO_RESPONSE',
          invitationSentCount: 0,
          tableId: null,
        })
        expect(after.totalGuests).toBe(before.totalGuests + 1)
        expect(after.invitationsNotSent).toBe(before.invitationsNotSent + 1)
        expect(after.invitationsSent).toBe(before.invitationsSent)
      })

      it('shows a phone in local form however it was typed, and matches it in any form', async () => {
        const { services, events } = setup()
        const { event } = await services.events.get(events.owner)

        const local = await services.guests.create(events.owner, {
          ...newGuest,
          phone: '+972 50 730 8828',
        })
        const foreign = await services.guests.create(events.owner, {
          ...newGuest,
          phone: '+1 (212) 555-0123',
        })

        expect(local.phone).toBe('050-730-8828')
        expect(foreign.phone).toBe('+1 2125550123')
        expect(
          await codeOf(
            services.guests.create(events.owner, {
              ...newGuest,
              phone: '06 12 34 56 78',
            }),
          ),
        ).toBe('INVALID_PHONE')
        expect(
          await codeOf(
            services.guests.create(events.owner, {
              ...newGuest,
              phone: '0507308828',
            }),
          ),
        ).toBe('DUPLICATE_PHONE')

        await services.rsvp.submit(event.rsvpSlug, {
          name: 'Typed Differently',
          phone: '972507308828',
          status: 'DECLINED',
          attendees: 1,
        })
        const updated = (await services.guests.list(events.owner)).find(
          (guest) => guest.id === local.id,
        )
        expect(updated).toMatchObject({
          rsvpStatus: 'DECLINED',
          phone: '050-730-8828',
        })

        await services.rsvp.submit(event.rsvpSlug, {
          name: 'Not Invited',
          phone: '+972 52 111 2233',
          status: 'DECLINED',
          attendees: 1,
        })
        expect(
          (await services.unknownGuests.list(events.owner)).find(
            (unknown) => unknown.name === 'Not Invited',
          )?.phone,
        ).toBe('052-111-2233')
      })

      it('rejects a duplicate phone but allows it in another event', async () => {
        const { services, events } = setup()
        await services.guests.create(events.owner, newGuest)

        expect(
          await codeOf(
            services.guests.create(events.owner, {
              ...newGuest,
              phone: '000-777-0001',
            }),
          ),
        ).toBe('DUPLICATE_PHONE')
        expect(
          await codeOf(services.guests.create(events.admin, newGuest)),
        ).toBe('NO_ERROR')
      })

      it('soft-deletes a guest, then restores the same record when the phone is added again', async () => {
        const { services, events } = setup()
        const seated = await findGuest(
          services,
          events.owner,
          (guest) => guest.tableId !== null && guest.invitationSentCount > 0,
        )
        const before = (await services.dashboard.get(events.owner)).metrics

        await services.guests.remove(events.owner, seated.id)
        const afterDelete = (await services.dashboard.get(events.owner)).metrics
        const listed = await services.guests.list(events.owner)

        expect(listed.some((guest) => guest.id === seated.id)).toBe(false)
        expect(afterDelete.totalGuests).toBe(before.totalGuests - 1)
        expect(afterDelete.confirmedAttendees).toBe(
          before.confirmedAttendees - (seated.confirmedAttendees ?? 0),
        )

        const restored = await services.guests.create(events.owner, {
          firstName: 'Back',
          lastName: 'Again',
          phone: seated.phone,
          allowedAttendees: 3,
        })

        expect(restored).toMatchObject({
          id: seated.id,
          firstName: 'Back',
          allowedAttendees: 3,
          rsvpStatus: 'NO_RESPONSE',
          confirmedAttendees: null,
          tableId: null,
          deleted: false,
          invitationSentCount: seated.invitationSentCount,
        })
        expect(
          (await services.dashboard.get(events.owner)).metrics.totalGuests,
        ).toBe(before.totalGuests)
      })

      it('edits a guest and rejects invalid edits', async () => {
        const { services, events } = setup()
        const guest = await services.guests.create(events.owner, newGuest)

        const edited = await services.guests.update(events.owner, guest.id, {
          ...newGuest,
          lastName: 'Renamed',
          allowedAttendees: 8,
        })

        expect(edited).toMatchObject({
          lastName: 'Renamed',
          allowedAttendees: 8,
        })
        expect(
          await codeOf(
            services.guests.update(events.owner, guest.id, {
              ...newGuest,
              allowedAttendees: 11,
            }),
          ),
        ).toBe('VALIDATION')
        expect(
          await codeOf(
            services.guests.update(events.owner, 'no-such-guest', newGuest),
          ),
        ).toBe('NOT_FOUND')
      })

      it('applies an organizer’s RSVP edit with the same rules as the public form', async () => {
        const { services, events } = setup()
        const guest = await services.guests.create(events.owner, newGuest)
        const set = (status: Guest['rsvpStatus'], attendees: number | null) =>
          services.guests.setRsvp(events.owner, guest.id, { status, attendees })

        expect(await codeOf(set('APPROVED', 5))).toBe('INVALID_ATTENDEE_COUNT')
        expect(await codeOf(set('APPROVED', 0))).toBe('INVALID_ATTENDEE_COUNT')
        expect(await set('APPROVED', 4)).toMatchObject({
          rsvpStatus: 'APPROVED',
          confirmedAttendees: 4,
        })
        expect(await set('DECLINED', 4)).toMatchObject({
          rsvpStatus: 'DECLINED',
          confirmedAttendees: 0,
        })
        expect(await set('NOT_SURE', 4)).toMatchObject({
          rsvpStatus: 'NOT_SURE',
          confirmedAttendees: null,
        })
      })

      it('refuses every guest change to a Viewer and on a past event', async () => {
        const { services, events } = setup()
        const viewerGuest = await findGuest(services, events.viewer, () => true)
        const pastGuest = await findGuest(services, events.past, () => true)

        expect(
          await codeOf(services.guests.create(events.viewer, newGuest)),
        ).toBe('FORBIDDEN')
        expect(
          await codeOf(services.guests.remove(events.viewer, viewerGuest.id)),
        ).toBe('FORBIDDEN')
        expect(
          await codeOf(
            services.guests.setRsvp(events.viewer, viewerGuest.id, {
              status: 'DECLINED',
              attendees: null,
            }),
          ),
        ).toBe('FORBIDDEN')
        expect(
          await codeOf(services.guests.create(events.past, newGuest)),
        ).toBe('EVENT_READ_ONLY')
        expect(
          await codeOf(services.guests.remove(events.past, pastGuest.id)),
        ).toBe('EVENT_READ_ONLY')
        expect(
          await codeOf(
            services.guests.assignTable(events.past, pastGuest.id, null),
          ),
        ).toBe('EVENT_READ_ONLY')
      })

      it('still lets a Viewer read, and anyone read a past event', async () => {
        const { services, events } = setup()

        expect(
          (await services.guests.list(events.viewer)).length,
        ).toBeGreaterThan(0)
        expect(
          (await services.guests.list(events.past)).length,
        ).toBeGreaterThan(0)
        expect(
          (await services.tables.list(events.past)).length,
        ).toBeGreaterThan(0)
        expect(await codeOf(services.dashboard.get(events.past))).toBe(
          'NO_ERROR',
        )
        expect(await codeOf(services.messages.listSends(events.viewer))).toBe(
          'NO_ERROR',
        )
      })
    })

    describe('tables and seating', () => {
      const newTable = {
        number: 90,
        capacity: 6,
        shape: 'SQUARE' as const,
      }

      it('lists tables in number order with their occupancy', async () => {
        const { services, events } = setup()

        const tables = await services.tables.list(events.owner)

        expect(tables.map((item) => item.table.number)).toEqual(
          [...tables.map((item) => item.table.number)].sort((a, b) => a - b),
        )
        expect(
          tables.every(
            (item) => item.available === item.table.capacity - item.assigned,
          ),
        ).toBe(true)
        expect(tables.some((item) => item.available < 0)).toBe(true)
        expect(tables.some((item) => item.available === 0)).toBe(true)
      })

      it('creates, edits and validates tables', async () => {
        const { services, events } = setup()

        const table = await services.tables.create(events.owner, newTable)
        const edited = await services.tables.update(events.owner, table.id, {
          ...newTable,
          capacity: 8,
        })

        expect(edited.capacity).toBe(8)
        expect(
          await codeOf(services.tables.create(events.owner, newTable)),
        ).toBe('DUPLICATE_TABLE_NUMBER')
        expect(
          await codeOf(
            services.tables.create(events.owner, {
              ...newTable,
              number: 91,
              capacity: 0,
            }),
          ),
        ).toBe('VALIDATION')
        expect(
          await codeOf(services.tables.create(events.viewer, newTable)),
        ).toBe('FORBIDDEN')
        expect(
          await codeOf(services.tables.create(events.past, newTable)),
        ).toBe('EVENT_READ_ONLY')
      })

      it('seats only Approved guests, blocks overfilling, and updates related figures', async () => {
        const { services, events } = setup()
        const table = await services.tables.create(events.owner, newTable)
        const first = await services.guests.create(events.owner, newGuest)
        const second = await services.guests.create(events.owner, {
          ...newGuest,
          phone: '+972 00-777-0002',
        })
        const assign = (guestId: string, tableId: string | null) =>
          services.guests.assignTable(events.owner, guestId, tableId)

        expect(await codeOf(assign(first.id, table.id))).toBe(
          'GUEST_NOT_APPROVED',
        )

        await services.guests.setRsvp(events.owner, first.id, {
          status: 'APPROVED',
          attendees: 4,
        })
        await services.guests.setRsvp(events.owner, second.id, {
          status: 'APPROVED',
          attendees: 3,
        })
        const before = (await services.dashboard.get(events.owner)).metrics

        expect((await assign(first.id, table.id)).tableId).toBe(table.id)
        expect(await codeOf(assign(second.id, table.id))).toBe('TABLE_FULL')

        const after = (await services.dashboard.get(events.owner)).metrics
        const listed = (await services.tables.list(events.owner)).find(
          (item) => item.table.id === table.id,
        )
        expect(listed).toMatchObject({ assigned: 4, available: 2 })
        expect(after.unassignedConfirmedAttendees).toBe(
          before.unassignedConfirmedAttendees - 4,
        )

        expect((await assign(first.id, null)).tableId).toBeNull()
        expect(await codeOf(assign(first.id, 'no-such-table'))).toBe(
          'NOT_FOUND',
        )
      })

      it('accepts an RSVP increase that overfills a table and reports the conflict', async () => {
        const { services, events } = setup()
        const table = await services.tables.create(events.owner, newTable)
        const guest = await services.guests.create(events.owner, {
          ...newGuest,
          allowedAttendees: 10,
        })
        await services.guests.setRsvp(events.owner, guest.id, {
          status: 'APPROVED',
          attendees: 6,
        })
        await services.guests.assignTable(events.owner, guest.id, table.id)

        const increased = await services.guests.setRsvp(
          events.owner,
          guest.id,
          {
            status: 'APPROVED',
            attendees: 9,
          },
        )
        const { warnings } = await services.dashboard.get(events.owner)

        expect(increased.tableId).toBe(table.id)
        expect(warnings.tablesOverCapacity).toContainEqual({
          tableId: table.id,
          tableNumber: 90,
          over: 3,
        })
      })

      it('clears the table when a seated guest declines', async () => {
        const { services, events } = setup()
        const seated = await findGuest(
          services,
          events.owner,
          (guest) => guest.tableId !== null,
        )

        const declined = await services.guests.setRsvp(
          events.owner,
          seated.id,
          {
            status: 'DECLINED',
            attendees: null,
          },
        )

        expect(declined.tableId).toBeNull()
      })

      it('deletes a table without deleting its guests', async () => {
        const { services, events } = setup()
        const seated = await findGuest(
          services,
          events.owner,
          (guest) => guest.tableId !== null,
        )
        const count = (await services.guests.list(events.owner)).length

        await services.tables.remove(events.owner, seated.tableId!)
        const guests = await services.guests.list(events.owner)

        expect(guests).toHaveLength(count)
        expect(guests.some((guest) => guest.tableId === seated.tableId)).toBe(
          false,
        )
        expect(guests.find((guest) => guest.id === seated.id)?.rsvpStatus).toBe(
          'APPROVED',
        )
        expect(
          await codeOf(services.tables.remove(events.owner, seated.tableId!)),
        ).toBe('NOT_FOUND')
      })
    })

    describe('messages', () => {
      it('previews the template with one guest’s details', async () => {
        const { services, events } = setup()
        const guest = await findGuest(services, events.owner, () => true)
        const { event } = await services.events.get(events.owner)

        const { message, launchUrl } = await services.messages.preview(
          events.owner,
          guest.id,
        )

        expect(message).toContain(guest.firstName)
        expect(message).toContain(event.name)
        expect(message).toContain(`/rsvp/${event.rsvpSlug}`)
        expect(message).not.toContain('{{')
        // The guest's full international number, digits only, and the
        // message percent-encoded.
        expect(launchUrl).toBe(
          `https://wa.me/${guest.normalizedPhone.slice(1)}?text=${encodeURIComponent(message)}`,
        )
        expect(launchUrl).toMatch(/^https:\/\/wa\.me\/\d+\?text=[^ \n&?+]+$/)
      })

      it('says what each variable stands for, for a guest and for a sample one', async () => {
        const { services, events } = setup()
        const guest = await findGuest(services, events.owner, () => true)
        const { event } = await services.events.get(events.owner)

        const forGuest = await services.messages.getValues(
          events.owner,
          guest.id,
        )
        const sample = await services.messages.getValues(events.owner, null)

        expect(forGuest).toMatchObject({
          first_name: guest.firstName,
          last_name: guest.lastName,
          event_name: event.name,
        })
        expect(forGuest.rsvp_url).toContain(`/rsvp/${event.rsvpSlug}`)
        expect(sample.first_name).not.toBe('')
        expect(sample.rsvp_url).toBe(forGuest.rsvp_url)
        expect(
          await codeOf(services.messages.getValues(events.owner, 'no-guest')),
        ).toBe('NOT_FOUND')
      })

      it('lists each send with the guest it went to, even after the guest is deleted', async () => {
        const { services, events } = setup()
        const guest = await services.guests.create(events.owner, newGuest)
        const { launchUrl, send } = await services.messages.send(
          events.owner,
          guest.id,
        )

        expect(launchUrl).toBe(
          `https://wa.me/${guest.normalizedPhone.slice(1)}?text=${encodeURIComponent(send.message)}`,
        )
        const listed = (await services.messages.listSends(events.owner)).find(
          (item) => item.id === send.id,
        )
        expect(listed).toMatchObject({
          guestName: `${guest.firstName} ${guest.lastName}`,
          phone: guest.phone,
          guestActive: true,
        })

        await services.guests.remove(events.owner, guest.id)

        expect(
          (await services.messages.listSends(events.owner)).find(
            (item) => item.id === send.id,
          ),
        ).toMatchObject({ guestActive: false, phone: guest.phone })
      })

      it('offers the default template and refuses an empty or over-long one', async () => {
        const { services, events } = setup()
        const original = (await services.messages.getTemplate(events.owner))
          .body

        expect(
          await services.messages.getDefaultTemplate(events.owner),
        ).toContain('{{rsvp_url}}')
        expect(
          await codeOf(services.messages.updateTemplate(events.owner, '   ')),
        ).toBe('VALIDATION')
        expect(
          await codeOf(
            services.messages.updateTemplate(events.owner, 'x'.repeat(1001)),
          ),
        ).toBe('VALIDATION')
        expect((await services.messages.getTemplate(events.owner)).body).toBe(
          original,
        )
      })

      it('counts five sends to one guest as one invited guest, and records each send', async () => {
        const { services, events } = setup()
        const open = vi.spyOn(window, 'open').mockImplementation(() => null)
        const guest = await services.guests.create(events.owner, newGuest)
        const before = (await services.dashboard.get(events.owner)).metrics

        for (let attempt = 1; attempt <= 5; attempt += 1) {
          const result = await services.messages.send(events.owner, guest.id)

          expect(result.guest.invitationSentCount).toBe(attempt)
          expect(result.send.message).toContain('Contract')
        }
        const after = (await services.dashboard.get(events.owner)).metrics
        const sends = await services.messages.listSends(events.owner)

        expect(after.invitationsSent).toBe(before.invitationsSent + 1)
        expect(after.invitationsNotSent).toBe(before.invitationsNotSent - 1)
        expect(after.awaitingResponse).toBe(before.awaitingResponse + 1)
        expect(sends.filter((send) => send.guestId === guest.id)).toHaveLength(
          5,
        )
        expect(sends.map((send) => send.sentAt)).toEqual(
          sends
            .map((send) => send.sentAt)
            .sort()
            .reverse(),
        )
        expect(open).not.toHaveBeenCalled()
      })

      it('refuses to send as a Viewer or on a past event', async () => {
        const { services, events } = setup()
        const guest = await findGuest(services, events.owner, () => true)
        const viewerGuest = await findGuest(services, events.viewer, () => true)
        const pastGuest = await findGuest(services, events.past, () => true)

        expect(
          await codeOf(services.messages.send(events.owner, guest.id)),
        ).toBe('NO_ERROR')
        expect(
          await codeOf(services.messages.send(events.viewer, viewerGuest.id)),
        ).toBe('FORBIDDEN')
        expect(
          await codeOf(services.messages.send(events.past, pastGuest.id)),
        ).toBe('EVENT_READ_ONLY')
        expect(
          await codeOf(services.messages.updateTemplate(events.viewer, 'Hi')),
        ).toBe('FORBIDDEN')
      })

      it('saves an edited template', async () => {
        const { services, events } = setup()

        await services.messages.updateTemplate(
          events.owner,
          'Hi {{first_name}}',
        )

        expect((await services.messages.getTemplate(events.owner)).body).toBe(
          'Hi {{first_name}}',
        )
      })
    })

    describe('public RSVP and unknown guests', () => {
      async function slugOf(services: Services, eventId: string) {
        return (await services.events.get(eventId)).event.rsvpSlug
      }

      it('shows the public page without any guest data, and as closed once past', async () => {
        const { services, events } = setup()

        const open = await services.rsvp.getPublicEvent(
          await slugOf(services, events.owner),
        )
        const closed = await services.rsvp.getPublicEvent(
          await slugOf(services, events.past),
        )

        expect(open.isClosed).toBe(false)
        expect(open.maxSelectableAttendees).toBe(10)
        expect(open.settings.welcomeMessage.length).toBeGreaterThan(0)
        expect(JSON.stringify(open)).not.toContain('+972')
        expect(closed.isClosed).toBe(true)
        expect(await codeOf(services.rsvp.getPublicEvent('no-such-slug'))).toBe(
          'NOT_FOUND',
        )
      })

      it('matches a known guest by phone however it is typed, and keeps the organizer’s name', async () => {
        const { services, events } = setup()
        const slug = await slugOf(services, events.owner)
        const guest = await services.guests.create(events.owner, newGuest)

        const result = await services.rsvp.submit(slug, {
          name: 'Connie & Tess',
          phone: '000 777 0001',
          status: 'APPROVED',
          attendees: 3,
        })
        const saved = await findGuest(
          services,
          events.owner,
          (candidate) => candidate.id === guest.id,
        )

        expect(result).toEqual({ status: 'APPROVED', confirmedAttendees: 3 })
        expect(saved).toMatchObject({
          firstName: 'Contract',
          lastName: 'Tester',
          invitationName: 'Connie & Tess',
          rsvpStatus: 'APPROVED',
          confirmedAttendees: 3,
        })
        expect(await services.unknownGuests.list(events.owner)).toHaveLength(8)
      })

      it('requires the number of attendees for every response and enforces the guest’s allowance when approving', async () => {
        const { services, events } = setup()
        const slug = await slugOf(services, events.owner)
        await services.guests.create(events.owner, newGuest)
        const submit = (
          status: 'APPROVED' | 'DECLINED' | 'NOT_SURE',
          attendees: number,
        ) =>
          services.rsvp.submit(slug, {
            name: 'Connie',
            phone: newGuest.phone,
            status,
            attendees,
          })

        expect(await codeOf(submit('APPROVED', 5))).toBe(
          'INVALID_ATTENDEE_COUNT',
        )
        expect(await codeOf(submit('DECLINED', 0))).toBe(
          'INVALID_ATTENDEE_COUNT',
        )
        expect(await codeOf(submit('NOT_SURE', 11))).toBe(
          'INVALID_ATTENDEE_COUNT',
        )
        expect(await submit('DECLINED', 4)).toEqual({
          status: 'DECLINED',
          confirmedAttendees: 0,
        })
        expect(await submit('NOT_SURE', 4)).toEqual({
          status: 'NOT_SURE',
          confirmedAttendees: null,
        })
        expect(await submit('APPROVED', 4)).toEqual({
          status: 'APPROVED',
          confirmedAttendees: 4,
        })
      })

      it('lets a guest change their answer until the event starts, then closes', async () => {
        const { services, events, setNow } = setup()
        const { event } = await services.events.get(events.owner)
        const guest = await services.guests.create(events.owner, newGuest)
        const submit = (attendees: number) =>
          services.rsvp.submit(event.rsvpSlug, {
            name: 'Connie',
            phone: newGuest.phone,
            status: 'APPROVED',
            attendees,
          })

        await submit(2)
        setNow(new Date(new Date(event.startsAt).getTime() - 1))
        await submit(3)
        setNow(new Date(event.startsAt))

        expect(await codeOf(submit(1))).toBe('RSVP_CLOSED')
        expect(
          (await services.guests.list(events.owner)).find(
            (candidate) => candidate.id === guest.id,
          )?.confirmedAttendees,
        ).toBe(3)
        expect(
          await codeOf(
            services.guests.update(events.owner, guest.id, newGuest),
          ),
        ).toBe('EVENT_READ_ONLY')
      })

      it('stores an unmatched response as an unknown guest without touching the dashboard', async () => {
        const { services, events } = setup()
        const slug = await slugOf(services, events.owner)
        const before = await services.dashboard.get(events.owner)
        const submit = (attendees: number, name = 'Stranger') =>
          services.rsvp.submit(slug, {
            name,
            phone: '+972 00-888-0001',
            status: 'APPROVED',
            attendees,
          })

        expect(await codeOf(submit(6))).toBe('INVALID_ATTENDEE_COUNT')
        expect(await submit(5)).toEqual({
          status: 'APPROVED',
          confirmedAttendees: 5,
        })
        await submit(2, 'Stranger Again')

        const unknown = await services.unknownGuests.list(events.owner)
        const mine = unknown.filter(
          (item) => item.normalizedPhone === '+972008880001',
        )
        expect(unknown).toHaveLength(9)
        expect(mine).toEqual([
          expect.objectContaining({
            name: 'Stranger Again',
            confirmedAttendees: 2,
            rsvpStatus: 'APPROVED',
          }),
        ])
        expect((await services.dashboard.get(events.owner)).metrics).toEqual(
          before.metrics,
        )
        expect((await services.guests.list(events.owner)).length).toBe(
          before.metrics.totalGuests,
        )
      })

      it('treats a deleted guest’s phone as unknown', async () => {
        const { services, events } = setup()
        const slug = await slugOf(services, events.owner)
        const guest = await services.guests.create(events.owner, newGuest)
        await services.guests.remove(events.owner, guest.id)

        await services.rsvp.submit(slug, {
          name: 'Former Guest',
          phone: newGuest.phone,
          status: 'DECLINED',
          attendees: 1,
        })

        expect(await services.unknownGuests.list(events.owner)).toHaveLength(9)
      })

      it('converts an unknown response into a guest, keeping the response', async () => {
        const { services, events } = setup()
        const [unknown] = (
          await services.unknownGuests.list(events.owner)
        ).filter((item) => item.rsvpStatus === 'APPROVED')
        const before = (await services.dashboard.get(events.owner)).metrics

        const guest = await services.unknownGuests.convertToGuest(
          events.owner,
          unknown!.id,
          { firstName: 'Now', lastName: 'Known', allowedAttendees: 5 },
        )
        const after = (await services.dashboard.get(events.owner)).metrics

        expect(guest).toMatchObject({
          firstName: 'Now',
          invitationName: unknown!.name,
          normalizedPhone: unknown!.normalizedPhone,
          rsvpStatus: 'APPROVED',
          confirmedAttendees: unknown!.confirmedAttendees,
          lastRsvpResponseAt: unknown!.submittedAt,
        })
        expect(await services.unknownGuests.list(events.owner)).toHaveLength(7)
        expect(after.totalGuests).toBe(before.totalGuests + 1)
        expect(after.confirmedAttendees).toBe(
          before.confirmedAttendees + (unknown!.confirmedAttendees ?? 0),
        )
      })

      it('refuses to convert when the response exceeds the allowance given', async () => {
        const { services, events } = setup()
        const slug = await slugOf(services, events.owner)
        await services.rsvp.submit(slug, {
          name: 'Big Party',
          phone: '+972 00-888-0002',
          status: 'APPROVED',
          attendees: 5,
        })
        const unknown = (await services.unknownGuests.list(events.owner)).find(
          (item) => item.name === 'Big Party',
        )

        expect(
          await codeOf(
            services.unknownGuests.convertToGuest(events.owner, unknown!.id, {
              firstName: 'Big',
              lastName: 'Party',
              allowedAttendees: 2,
            }),
          ),
        ).toBe('INVALID_ATTENDEE_COUNT')
        expect(await services.unknownGuests.list(events.owner)).toHaveLength(9)
      })

      it('merges an unknown response into an existing guest', async () => {
        const { services, events } = setup()
        const guest = await services.guests.create(events.owner, {
          ...newGuest,
          allowedAttendees: 5,
        })
        const [unknown] = (
          await services.unknownGuests.list(events.owner)
        ).filter((item) => item.rsvpStatus === 'APPROVED')

        const merged = await services.unknownGuests.mergeIntoGuest(
          events.owner,
          unknown!.id,
          guest.id,
        )

        expect(merged).toMatchObject({
          id: guest.id,
          firstName: 'Contract',
          normalizedPhone: guest.normalizedPhone,
          invitationName: unknown!.name,
          rsvpStatus: 'APPROVED',
          confirmedAttendees: unknown!.confirmedAttendees,
        })
        expect(await services.unknownGuests.list(events.owner)).toHaveLength(7)
      })

      it('keeps a rejected response out of review, restorable, and guards all review actions', async () => {
        const { services, events } = setup()
        const [unknown] = await services.unknownGuests.list(events.owner)
        const rejectedBefore = await services.unknownGuests.listRejected(
          events.owner,
        )

        await services.unknownGuests.reject(events.owner, unknown!.id)

        expect(await services.unknownGuests.list(events.owner)).toHaveLength(7)
        const rejected = await services.unknownGuests.listRejected(events.owner)
        expect(rejected).toHaveLength(rejectedBefore.length + 1)
        expect(rejected[0]).toMatchObject({
          id: unknown!.id,
          name: unknown!.name,
          rsvpStatus: unknown!.rsvpStatus,
        })
        expect(rejected[0]?.rejectedAt).not.toBeNull()
        // A rejected response cannot be acted on until it is restored.
        expect(
          await codeOf(
            services.unknownGuests.reject(events.owner, unknown!.id),
          ),
        ).toBe('NOT_FOUND')
        expect(
          await codeOf(
            services.unknownGuests.convertToGuest(events.owner, unknown!.id, {
              firstName: 'Late',
              lastName: 'Comer',
              allowedAttendees: 5,
            }),
          ),
        ).toBe('NOT_FOUND')

        const restored = await services.unknownGuests.restore(
          events.owner,
          unknown!.id,
        )

        expect(restored).toEqual({ ...unknown, rejectedAt: null })
        expect(await services.unknownGuests.list(events.owner)).toHaveLength(8)
        expect(
          await services.unknownGuests.listRejected(events.owner),
        ).toHaveLength(rejectedBefore.length)
        expect(
          await codeOf(
            services.unknownGuests.restore(events.owner, unknown!.id),
          ),
        ).toBe('NOT_FOUND')

        const [viewerUnknown] = await services.unknownGuests.list(events.viewer)
        if (viewerUnknown) {
          expect(
            await codeOf(
              services.unknownGuests.reject(events.viewer, viewerUnknown.id),
            ),
          ).toBe('FORBIDDEN')
        }
        const [pastUnknown] = await services.unknownGuests.list(events.past)
        expect(
          await codeOf(
            services.unknownGuests.reject(events.past, pastUnknown!.id),
          ),
        ).toBe('EVENT_READ_ONLY')
      })

      it('returns a rejected response to review when the same phone answers again', async () => {
        const { services, events } = setup()
        const { event } = await services.events.get(events.owner)
        const [unknown] = await services.unknownGuests.list(events.owner)
        await services.unknownGuests.reject(events.owner, unknown!.id)

        await services.rsvp.submit(event.rsvpSlug, {
          name: 'Changed Mind',
          phone: unknown!.phone,
          status: 'DECLINED',
          attendees: 1,
        })

        const pending = await services.unknownGuests.list(events.owner)
        expect(pending).toHaveLength(8)
        expect(pending.find((item) => item.id === unknown!.id)).toMatchObject({
          name: 'Changed Mind',
          rsvpStatus: 'DECLINED',
          rejectedAt: null,
        })
      })

      it('soft-deletes several guests at once, or none if one is unknown', async () => {
        const { services, events } = setup()
        const before = await services.guests.list(events.owner)
        const [first, second] = before

        expect(
          await codeOf(
            services.guests.removeMany(events.owner, [first!.id, 'no-such']),
          ),
        ).toBe('NOT_FOUND')
        expect(await services.guests.list(events.owner)).toHaveLength(
          before.length,
        )

        await services.guests.removeMany(events.owner, [
          first!.id,
          second!.id,
          first!.id,
        ])

        const after = await services.guests.list(events.owner)
        expect(after).toHaveLength(before.length - 2)
        expect(after.map((guest) => guest.id)).not.toContain(first!.id)
        expect(
          await codeOf(services.guests.removeMany(events.viewer, [])),
        ).toBe('FORBIDDEN')
        expect(await codeOf(services.guests.removeMany(events.past, []))).toBe(
          'EVENT_READ_ONLY',
        )
      })

      it('imports many guests in one step, restoring a deleted phone, or nothing if one is invalid', async () => {
        const { services, events } = setup()
        const before = await services.guests.list(events.owner)
        const deleted = before[0]!
        await services.guests.remove(events.owner, deleted.id)
        const fresh = (suffix: string) => ({
          firstName: `Imported ${suffix}`,
          lastName: 'Guest',
          phone: `+972 00-888-000${suffix}`,
          allowedAttendees: 3,
        })

        expect(
          await codeOf(
            services.guests.importMany(events.owner, [
              fresh('1'),
              { ...fresh('2'), phone: before[1]!.phone },
            ]),
          ),
        ).toBe('DUPLICATE_PHONE')
        expect(
          await codeOf(
            services.guests.importMany(events.owner, [fresh('1'), fresh('1')]),
          ),
        ).toBe('DUPLICATE_PHONE')
        expect(await services.guests.list(events.owner)).toHaveLength(
          before.length - 1,
        )

        const outcome = await services.guests.importMany(events.owner, [
          fresh('1'),
          fresh('2'),
          { ...fresh('3'), phone: deleted.phone },
        ])

        expect(outcome).toEqual({ created: 2, restored: 1 })
        const after = await services.guests.list(events.owner)
        expect(after).toHaveLength(before.length + 2)
        expect(after.find((guest) => guest.id === deleted.id)).toMatchObject({
          firstName: 'Imported 3',
          rsvpStatus: 'NO_RESPONSE',
          tableId: null,
        })
        expect(
          await codeOf(services.guests.importMany(events.viewer, [fresh('9')])),
        ).toBe('FORBIDDEN')
        expect(
          await codeOf(services.guests.importMany(events.past, [fresh('9')])),
        ).toBe('EVENT_READ_ONLY')
      })

      it('remembers the chosen guest columns', async () => {
        const { services } = setup()

        expect(await services.preferences.getGuestColumns()).toBeNull()

        await services.preferences.setGuestColumns(['name', 'phone', 'status'])

        expect(await services.preferences.getGuestColumns()).toEqual([
          'name',
          'phone',
          'status',
        ])
      })

      it('remembers whether the side menu is collapsed, apart from the columns', async () => {
        const { services } = setup()

        expect(await services.preferences.getSidebarCollapsed()).toBe(false)

        await services.preferences.setGuestColumns(['name', 'phone'])
        await services.preferences.setSidebarCollapsed(true)

        expect(await services.preferences.getSidebarCollapsed()).toBe(true)
        expect(await services.preferences.getGuestColumns()).toEqual([
          'name',
          'phone',
        ])

        await services.preferences.setSidebarCollapsed(false)
        expect(await services.preferences.getSidebarCollapsed()).toBe(false)
      })

      it('reads and saves RSVP settings with validation', async () => {
        const { services, events } = setup()
        const { eventId: _eventId, ...settings } =
          await services.rsvp.getSettings(events.owner)
        const save = (patch: Partial<typeof settings>) =>
          services.rsvp.updateSettings(events.owner, { ...settings, ...patch })

        const saved = await save({
          welcomeMessage: 'x'.repeat(500),
          overlayOpacity: 65,
          youtube: {
            enabled: true,
            url: 'https://video.example.com/watch?v=1',
          },
        })

        expect(saved.overlayOpacity).toBe(65)
        expect(
          (await services.rsvp.getSettings(events.owner)).youtube.enabled,
        ).toBe(true)
        expect(await codeOf(save({ welcomeMessage: 'x'.repeat(501) }))).toBe(
          'VALIDATION',
        )
        expect(await codeOf(save({ overlayOpacity: 101 }))).toBe('VALIDATION')
        expect(
          await codeOf(save({ youtube: { enabled: true, url: 'not a link' } })),
        ).toBe('VALIDATION')
        expect(
          await codeOf(services.rsvp.updateSettings(events.viewer, settings)),
        ).toBe('FORBIDDEN')
      })
    })

    describe('permissions', () => {
      it('lists members Owners first and marks the current user', async () => {
        const { services, events } = setup()

        const members = await services.permissions.list(events.owner)

        expect(members.map((member) => member.role)).toEqual([
          'OWNER',
          'ADMIN',
          'ADMIN',
          'VIEWER',
          'VIEWER',
          'VIEWER',
        ])
        expect(members.filter((member) => member.isCurrentUser)).toHaveLength(1)
        expect(members[0]?.isCurrentUser).toBe(true)
      })

      it('hides permissions from a Viewer', async () => {
        const { services, events } = setup()

        expect(await codeOf(services.permissions.list(events.viewer))).toBe(
          'FORBIDDEN',
        )
        expect(
          await codeOf(services.permissions.listCandidates(events.viewer)),
        ).toBe('FORBIDDEN')
      })

      it('lets an Owner grant, change and revoke, keeping the rules', async () => {
        const { services, events } = setup()
        const me = await services.session.getCurrentUser()
        const [candidate] = await services.permissions.listCandidates(
          events.owner,
        )

        const granted = await services.permissions.grant(
          events.owner,
          candidate!.id,
          'VIEWER',
        )
        const changed = await services.permissions.changeRole(
          events.owner,
          candidate!.id,
          'OWNER',
        )

        expect(granted.role).toBe('VIEWER')
        expect(changed.role).toBe('OWNER')
        expect(
          await codeOf(
            services.permissions.grant(events.owner, candidate!.id, 'ADMIN'),
          ),
        ).toBe('ALREADY_MEMBER')
        expect(
          await codeOf(
            services.permissions.changeRole(events.owner, me.id, 'ADMIN'),
          ),
        ).toBe('SELF_PERMISSION')
        expect(
          await codeOf(services.permissions.revoke(events.owner, me.id)),
        ).toBe('SELF_PERMISSION')
        expect(
          await codeOf(
            services.permissions.grant(events.owner, 'no-such-user', 'VIEWER'),
          ),
        ).toBe('NOT_FOUND')

        await services.permissions.revoke(events.owner, candidate!.id)
        expect(await services.permissions.list(events.owner)).toHaveLength(6)
      })

      it('limits an Admin to Admin and Viewer permissions', async () => {
        const { services, events } = setup()
        const members = await services.permissions.list(events.admin)
        const owner = members.find((member) => member.role === 'OWNER')
        const viewer = members.find((member) => member.role === 'VIEWER')
        const [candidate] = await services.permissions.listCandidates(
          events.admin,
        )

        expect(
          await codeOf(
            services.permissions.grant(events.admin, candidate!.id, 'OWNER'),
          ),
        ).toBe('FORBIDDEN')
        expect(
          await codeOf(
            services.permissions.changeRole(
              events.admin,
              owner!.user.id,
              'VIEWER',
            ),
          ),
        ).toBe('FORBIDDEN')
        expect(
          await codeOf(
            services.permissions.changeRole(
              events.admin,
              viewer!.user.id,
              'ADMIN',
            ),
          ),
        ).toBe('NO_ERROR')
        expect(
          await codeOf(
            services.permissions.grant(events.admin, candidate!.id, 'VIEWER'),
          ),
        ).toBe('NO_ERROR')
      })
    })
  })
}
