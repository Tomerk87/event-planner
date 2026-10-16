import {
  createEvent,
  createTestApp,
  makePast,
  NEW_EVENT,
  resetDatabase,
  signUp,
  type TestApp,
} from './test-app.ts'

let t: TestApp

beforeAll(async () => {
  t = await createTestApp()
})
afterAll(async () => {
  await t.close()
})
beforeEach(async () => {
  await resetDatabase(t.prisma)
})

const PHOTO = `data:image/png;base64,${Buffer.from('fake png').toString('base64')}`

describe('events', () => {
  it('creates an event owned by its creator, with default RSVP texts and template', async () => {
    const owner = t.browser()
    await signUp(owner, 'Owner')

    const created = await createEvent(owner, {
      location: ' Hall ',
      rsvpLanguage: 'he',
      country: 'IL',
    })

    const info = await owner.get(`/api/events/${created.id}`).expect(200)
    expect(info.body).toMatchObject({
      role: 'OWNER',
      isPast: false,
      event: { name: 'Garden Party', location: 'Hall', rsvpLanguage: 'he' },
    })
    expect(created.rsvpSlug).toMatch(/^[\w-]{12}$/)
    const settings = await t.prisma.rsvpSettings.findUniqueOrThrow({
      where: { eventId: created.id },
    })
    expect(settings.calendarDate).toBe('2031-06-01')
    expect(
      (
        await t.prisma.messageTemplate.findUniqueOrThrow({
          where: { eventId: created.id },
        })
      ).body,
    ).toContain('{{rsvp_url}}')
  })

  it('creates a Brazilian event in Portuguese, reading local numbers as Brazil’s (D103)', async () => {
    const owner = t.browser()
    await signUp(owner, 'Owner')

    const created = await createEvent(owner, {
      timeZone: 'America/Sao_Paulo',
      rsvpLanguage: 'pt',
      country: 'BR',
    })

    expect(created).toMatchObject({ rsvpLanguage: 'pt', country: 'BR' })
    const settings = await t.prisma.rsvpSettings.findUniqueOrThrow({
      where: { eventId: created.id },
    })
    expect(settings.welcomeMessage).toContain('celebrar com você')
    const guest = await owner
      .post(`/api/events/${created.id}/guests`)
      .send({
        firstName: 'Ana',
        lastName: 'Souza',
        phone: '(11) 91234-5678',
        allowedAttendees: 2,
      })
      .expect(201)
    expect(guest.body).toMatchObject({
      phone: '+55 11 91234-5678',
      normalizedPhone: '+5511912345678',
    })

    const refused = await owner
      .post('/api/events')
      .send({ ...NEW_EVENT, country: 'US' })
      .expect(400)
    expect(refused.body).toMatchObject({ code: 'VALIDATION' })
  })

  it('refuses limits outside the rules, a past start and an unknown time zone', async () => {
    const owner = t.browser()
    await signUp(owner, 'Owner')
    const attempt = (patch: Record<string, unknown>) =>
      owner.post('/api/events').send({ ...NEW_EVENT, ...patch })

    for (const [patch, field] of [
      [{ maxAttendees: 49 }, 'maxAttendees'],
      [{ maxAttendees: 3001 }, 'maxAttendees'],
      [{ defaultAllowedAttendees: 11 }, 'defaultAllowedAttendees'],
      [{ timeZone: 'Mars/Olympus' }, 'timeZone'],
      [{ name: '  ' }, 'name'],
    ] as const) {
      const response = await attempt(patch).expect(400)
      expect(response.body).toMatchObject({
        code: 'VALIDATION',
        details: { field },
      })
    }
    const past = await attempt({ startsAt: '2020-01-01T10:00:00.000Z' }).expect(
      400,
    )
    expect(past.body).toMatchObject({
      code: 'VALIDATION',
      details: { field: 'startsAt' },
    })
    expect(await t.prisma.event.count()).toBe(0)
  })

  it('lists only the events the user belongs to, soonest first, with confirmed attendees', async () => {
    const owner = t.browser()
    await signUp(owner, 'Owner')
    const later = await createEvent(owner, {
      name: 'Later',
      startsAt: '2032-01-01T10:00:00.000Z',
    })
    await createEvent(owner, { name: 'Sooner' })
    const guest = await owner
      .post(`/api/events/${later.id}/guests`)
      .send({
        firstName: 'Dana',
        lastName: 'Lev',
        phone: '052-123-4567',
        allowedAttendees: 4,
      })
      .expect(201)
    await owner
      .put(`/api/events/${later.id}/guests/${guest.body.id}/rsvp`)
      .send({ status: 'APPROVED', attendees: 3 })
      .expect(200)
    const stranger = t.browser()
    await signUp(stranger, 'Stranger')

    const list = await owner.get('/api/events').expect(200)

    expect(
      (
        list.body as { event: { name: string }; confirmedAttendees: number }[]
      ).map((item) => [item.event.name, item.confirmedAttendees]),
    ).toEqual([
      ['Sooner', 0],
      ['Later', 3],
    ])
    expect((await stranger.get('/api/events').expect(200)).body).toEqual([])
    const hidden = await stranger.get(`/api/events/${later.id}`).expect(404)
    expect(hidden.body).toEqual({
      code: 'NOT_FOUND',
      details: { entity: 'event' },
    })
    await stranger.get('/api/events/not-a-uuid').expect(404)
  })

  it('gives a Super User every event as Owner without a membership', async () => {
    const owner = t.browser()
    await signUp(owner, 'Owner')
    const event = await createEvent(owner)
    const admin = t.browser()
    const { id } = await signUp(admin, 'System Admin')
    await t.prisma.user.update({ where: { id }, data: { isSuperUser: true } })

    const list = await admin.get('/api/events').expect(200)

    expect(list.body).toHaveLength(1)
    expect(list.body[0]).toMatchObject({ role: 'OWNER' })
    await admin.delete(`/api/events/${event.id}`).expect(204)
  })

  it('updates an event, keeping, replacing and removing its photo', async () => {
    const owner = t.browser()
    await signUp(owner, 'Owner')
    const created = await createEvent(owner, { coverImage: PHOTO })
    expect(created.coverImage).toMatch(/^\/api\/files\/[0-9a-f-]{36}\.png$/)
    const file = await owner.get(created.coverImage!).expect(200)
    expect(file.headers['content-type']).toBe('image/png')
    expect(Buffer.from(file.body as Buffer).toString()).toBe('fake png')

    // Sending back the photo's own address keeps it.
    const kept = await owner
      .put(`/api/events/${created.id}`)
      .send({ ...NEW_EVENT, name: 'Renamed', coverImage: created.coverImage })
      .expect(200)
    expect(kept.body).toMatchObject({
      name: 'Renamed',
      coverImage: created.coverImage,
    })

    const removed = await owner
      .put(`/api/events/${created.id}`)
      .send({ ...NEW_EVENT, coverImage: null })
      .expect(200)
    expect(removed.body.coverImage).toBeNull()
    await owner.get(created.coverImage!).expect(404)

    const refused = await owner
      .put(`/api/events/${created.id}`)
      .send({ ...NEW_EVENT, coverImage: 'https://example.com/photo.png' })
      .expect(400)
    expect(refused.body).toMatchObject({ details: { field: 'coverImage' } })
  })

  it('keeps the maximum at or above the attendees already confirmed (D94)', async () => {
    const owner = t.browser()
    await signUp(owner, 'Owner')
    const event = await createEvent(owner, { maxAttendees: 100 })
    // Ten approved guests of 7 attendees each, and one who declined.
    await t.prisma.guest.createMany({
      data: Array.from({ length: 11 }, (_, index) => ({
        eventId: event.id,
        firstName: `Guest ${index}`,
        lastName: '',
        phone: `05200000${String(index).padStart(2, '0')}`,
        normalizedPhone: `+9725200000${String(index).padStart(2, '0')}`,
        allowedAttendees: 10,
        confirmedAttendees: index < 10 ? 7 : 0,
        rsvpStatus: index < 10 ? ('APPROVED' as const) : ('DECLINED' as const),
      })),
    })

    const refused = await owner
      .put(`/api/events/${event.id}`)
      .send({ ...NEW_EVENT, maxAttendees: 69 })
      .expect(400)
    expect(refused.body).toMatchObject({
      code: 'VALIDATION',
      details: { field: 'maxAttendees', min: 70, max: 3000 },
    })
    await owner
      .put(`/api/events/${event.id}`)
      .send({ ...NEW_EVENT, maxAttendees: 70 })
      .expect(200)

    // More answers later go past it; the rest can still be edited.
    await t.prisma.guest.updateMany({
      where: { eventId: event.id, rsvpStatus: 'APPROVED' },
      data: { confirmedAttendees: 9 },
    })
    await owner
      .put(`/api/events/${event.id}`)
      .send({ ...NEW_EVENT, maxAttendees: 70, name: 'Renamed' })
      .expect(200)
  })

  it('duplicates details, settings, template and empty tables, not guests or members', async () => {
    const owner = t.browser()
    await signUp(owner, 'Owner')
    const source = await createEvent(owner, { coverImage: PHOTO })
    await t.prisma.eventTable.create({
      data: { eventId: source.id, number: 3, capacity: 8, shape: 'SQUARE' },
    })
    await t.prisma.messageTemplate.update({
      where: { eventId: source.id },
      data: { body: 'Custom {{rsvp_url}}' },
    })
    await owner
      .post(`/api/events/${source.id}/guests`)
      .send({
        firstName: 'Dana',
        lastName: 'Lev',
        phone: '052-123-4567',
        allowedAttendees: 2,
      })
      .expect(201)
    await owner
      .post(`/api/events/${source.id}/permissions/invitations`)
      .send({ email: 'someone@example.com', role: 'VIEWER' })
      .expect(201)

    const copy = await owner
      .post(`/api/events/${source.id}/duplicate`)
      .send({ name: 'Again', startsAt: '2033-01-01T18:00:00.000Z' })
      .expect(201)

    expect(copy.body).toMatchObject({ name: 'Again', maxAttendees: 120 })
    expect(copy.body.rsvpSlug).not.toBe(source.rsvpSlug)
    expect(copy.body.coverImage).not.toBe(source.coverImage)
    await owner.get(copy.body.coverImage).expect(200)
    const id = copy.body.id as string
    expect(
      await t.prisma.eventTable.findMany({ where: { eventId: id } }),
    ).toMatchObject([{ number: 3, capacity: 8, shape: 'SQUARE' }])
    expect(
      (
        await t.prisma.messageTemplate.findUniqueOrThrow({
          where: { eventId: id },
        })
      ).body,
    ).toBe('Custom {{rsvp_url}}')
    expect(
      (
        await t.prisma.rsvpSettings.findUniqueOrThrow({
          where: { eventId: id },
        })
      ).calendarDate,
    ).toBe('2033-01-01')
    expect(await t.prisma.guest.count({ where: { eventId: id } })).toBe(0)
    expect(
      await t.prisma.eventInvitation.count({ where: { eventId: id } }),
    ).toBe(0)
    expect(
      await t.prisma.eventMembership.count({ where: { eventId: id } }),
    ).toBe(1)
  })

  it('deletes an event with everything in it, and allows it on a past event', async () => {
    const owner = t.browser()
    await signUp(owner, 'Owner')
    const event = await createEvent(owner, { coverImage: PHOTO })
    const table = await t.prisma.eventTable.create({
      data: { eventId: event.id, number: 1, capacity: 8, shape: 'CIRCLE' },
    })
    const guest = await owner.post(`/api/events/${event.id}/guests`).send({
      firstName: 'Dana',
      lastName: 'Lev',
      phone: '052-123-4567',
      allowedAttendees: 2,
    })
    await owner
      .put(`/api/events/${event.id}/guests/${guest.body.id}/rsvp`)
      .send({ status: 'APPROVED', attendees: 2 })
    await owner
      .put(`/api/events/${event.id}/guests/${guest.body.id}/table`)
      .send({ tableId: table.id })
      .expect(200)
    await makePast(t.prisma, event.id)

    await owner.delete(`/api/events/${event.id}`).expect(204)

    expect(await t.prisma.event.count()).toBe(0)
    expect(await t.prisma.guest.count()).toBe(0)
    expect(await t.prisma.eventTable.count()).toBe(0)
    await owner.get(event.coverImage!).expect(404)
  })

  it('keeps a past event read-only but viewable', async () => {
    const owner = t.browser()
    await signUp(owner, 'Owner')
    const event = await createEvent(owner)
    await makePast(t.prisma, event.id)

    const info = await owner.get(`/api/events/${event.id}`).expect(200)
    expect(info.body.isPast).toBe(true)
    const refused = await owner
      .put(`/api/events/${event.id}`)
      .send(NEW_EVENT)
      .expect(403)
    expect(refused.body).toEqual({
      code: 'EVENT_READ_ONLY',
      details: { action: 'EDIT' },
    })
  })
})
