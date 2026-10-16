import type TestAgent from 'supertest/lib/agent.js'
import {
  createEvent,
  createTestApp,
  makePast,
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

const PICTURE = `data:image/png;base64,${Buffer.from('fake floor plan').toString('base64')}`

interface Layout {
  eventId: string
  roomWidth: number
  roomDepth: number
  floorImage: string | null
  floorImageTransparency: number
  floorImageZoom: number
  floorImageRotation: number
  placements: { tableId: string; x: number; y: number; rotation: number }[]
  objects: {
    id: string
    kind: string
    x: number
    y: number
    width: number
    height: number
    rotation: number
    label: string | null
  }[]
  version: number
}

const STAGE = {
  id: 'stage-1',
  kind: 'STAGE',
  x: 1000,
  y: 200,
  width: 600,
  height: 300,
  rotation: 0,
  label: ' Main stage ',
}

async function layoutOf(browser: TestAgent, eventId: string): Promise<Layout> {
  return (await browser.get(`/api/events/${eventId}/layout`).expect(200))
    .body as Layout
}

function changes(layout: Layout, overrides: Partial<Layout> = {}) {
  const { eventId: _eventId, ...input } = layout
  return { ...input, ...overrides }
}

async function addTable(browser: TestAgent, eventId: string, number: number) {
  return (
    await browser
      .post(`/api/events/${eventId}/tables`)
      .send({ number, capacity: 10, shape: 'CIRCLE' })
      .expect(201)
  ).body as { id: string }
}

describe('floor plan (D100)', () => {
  it('starts empty, saves the whole plan and keeps it', async () => {
    const owner = t.browser()
    await signUp(owner, 'Olive Owner')
    const event = await createEvent(owner)
    const table = await addTable(owner, event.id, 1)
    const unplaced = await addTable(owner, event.id, 2)

    const empty = await layoutOf(owner, event.id)
    expect(empty).toEqual({
      eventId: event.id,
      roomWidth: 2000,
      roomDepth: 1500,
      floorImage: null,
      floorImageTransparency: 40,
      floorImageZoom: 100,
      floorImageRotation: 0,
      placements: [],
      objects: [],
      version: 0,
    })

    const saved = await owner
      .put(`/api/events/${event.id}/layout`)
      .send(
        changes(empty, {
          roomWidth: 2400,
          placements: [{ tableId: table.id, x: 600, y: 700, rotation: 45 }],
          objects: [
            STAGE,
            { ...STAGE, id: 'plant-1', kind: 'PLANT', label: null },
            {
              ...STAGE,
              id: 'stairs-1',
              kind: 'STAIRS',
              label: 'To the balcony',
            },
          ],
          floorImage: PICTURE,
          floorImageTransparency: 60,
          floorImageZoom: 150,
          floorImageRotation: -90,
        }),
      )
      .expect(200)
    const layout = saved.body as Layout
    expect(layout).toMatchObject({
      roomWidth: 2400,
      floorImageTransparency: 60,
      floorImageZoom: 150,
      floorImageRotation: -90,
      placements: [{ tableId: table.id, x: 600, y: 700, rotation: 45 }],
      objects: [
        { id: 'stage-1', label: 'Main stage' },
        { id: 'plant-1', kind: 'PLANT' },
        { id: 'stairs-1', kind: 'STAIRS', label: 'To the balcony' },
      ],
      version: 1,
    })
    expect(layout.floorImage).toMatch(/^\/api\/files\/.+\.png$/)
    await owner.get(layout.floorImage!).expect(200)
    expect(await layoutOf(owner, event.id)).toEqual(layout)
    expect(
      layout.placements.some((placement) => placement.tableId === unplaced.id),
    ).toBe(false)

    // Keeping the picture by its address keeps the same file; removing it
    // deletes the file.
    const kept = (
      await owner
        .put(`/api/events/${event.id}/layout`)
        .send(changes(layout, { placements: [] }))
        .expect(200)
    ).body as Layout
    expect(kept.floorImage).toBe(layout.floorImage)
    expect(kept.placements).toEqual([])
    await owner
      .put(`/api/events/${event.id}/layout`)
      .send(changes(kept, { floorImage: null }))
      .expect(200)
    await owner.get(layout.floorImage!).expect(404)
  })

  it('refuses a save made on an older version', async () => {
    const owner = t.browser()
    await signUp(owner, 'Olive Owner')
    const event = await createEvent(owner)
    const first = await layoutOf(owner, event.id)
    await owner
      .put(`/api/events/${event.id}/layout`)
      .send(changes(first, { roomWidth: 3000 }))
      .expect(200)

    const stale = await owner
      .put(`/api/events/${event.id}/layout`)
      .send(changes(first, { roomWidth: 1000, floorImage: PICTURE }))
      .expect(409)
    expect(stale.body).toEqual({ code: 'LAYOUT_CHANGED', details: {} })
    expect((await layoutOf(owner, event.id)).roomWidth).toBe(3000)
  })

  it.each([
    [{ roomWidth: 100 }, 'roomWidth'],
    [{ floorImageZoom: 500 }, 'floorImageZoom'],
    [{ floorImage: 'data:text/html;base64,AAAA' }, 'floorImage'],
    [{ objects: [{ ...STAGE, x: 5000 }] }, 'objects.x'],
    [{ objects: [{ ...STAGE, id: 'not ok' }] }, 'objects'],
  ])('refuses %j', async (overrides, field) => {
    const owner = t.browser()
    await signUp(owner, 'Olive Owner')
    const event = await createEvent(owner)
    const layout = await layoutOf(owner, event.id)
    const response = await owner
      .put(`/api/events/${event.id}/layout`)
      .send(changes(layout, overrides as Partial<Layout>))
      .expect(400)
    expect(response.body).toMatchObject({
      code: 'VALIDATION',
      details: { field },
    })
  })

  it('refuses a placement outside the room and a kind it does not know, such as the old Steps', async () => {
    const owner = t.browser()
    await signUp(owner, 'Olive Owner')
    const event = await createEvent(owner)
    const table = await addTable(owner, event.id, 1)
    const layout = await layoutOf(owner, event.id)
    await owner
      .put(`/api/events/${event.id}/layout`)
      .send(
        changes(layout, {
          placements: [{ tableId: table.id, x: 2001, y: 10, rotation: 0 }],
        }),
      )
      .expect(400)
    await owner
      .put(`/api/events/${event.id}/layout`)
      .send(changes(layout, { objects: [{ ...STAGE, kind: 'STEPS' }] }))
      .expect(400)
  })

  it('lets Viewers look, and nobody change a past event', async () => {
    const owner = t.browser()
    await signUp(owner, 'Olive Owner')
    const event = await createEvent(owner)
    const viewer = t.browser()
    const vera = await signUp(viewer, 'Vera Viewer')
    await owner
      .post(`/api/events/${event.id}/permissions/invitations`)
      .send({ email: vera.email, role: 'VIEWER' })
      .expect(201)
    const layout = await layoutOf(viewer, event.id)
    await viewer
      .put(`/api/events/${event.id}/layout`)
      .send(changes(layout))
      .expect(403)
    await t.browser().get(`/api/events/${event.id}/layout`).expect(401)
    const stranger = t.browser()
    await signUp(stranger, 'Sam Stranger')
    await stranger.get(`/api/events/${event.id}/layout`).expect(404)

    await makePast(t.prisma, event.id)
    expect(await layoutOf(owner, event.id)).toEqual(layout)
    await owner
      .put(`/api/events/${event.id}/layout`)
      .send(changes(layout))
      .expect(403)
  })

  it('drops a deleted table from the plan, and a new table starts unplaced', async () => {
    const owner = t.browser()
    await signUp(owner, 'Olive Owner')
    const event = await createEvent(owner)
    const table = await addTable(owner, event.id, 1)
    const layout = await layoutOf(owner, event.id)
    const placement = { tableId: table.id, x: 500, y: 500, rotation: 0 }
    await owner
      .put(`/api/events/${event.id}/layout`)
      .send(changes(layout, { placements: [placement] }))
      .expect(200)

    // Edited elsewhere: its place is kept.
    await owner
      .put(`/api/events/${event.id}/tables/${table.id}`)
      .send({ number: 7, capacity: 12, shape: 'SQUARE' })
      .expect(200)
    expect((await layoutOf(owner, event.id)).placements).toEqual([placement])

    await owner.delete(`/api/events/${event.id}/tables/${table.id}`).expect(204)
    await addTable(owner, event.id, 2)
    const after = await layoutOf(owner, event.id)
    expect(after.placements).toEqual([])
    // A save from before the deletion still goes through, without the table.
    await owner
      .put(`/api/events/${event.id}/layout`)
      .send(changes(after, { placements: [placement] }))
      .expect(200)
    expect((await layoutOf(owner, event.id)).placements).toEqual([])
  })

  it('is copied with the event, picture included, and removed with it', async () => {
    const owner = t.browser()
    await signUp(owner, 'Olive Owner')
    const event = await createEvent(owner)
    const table = await addTable(owner, event.id, 4)
    const empty = await layoutOf(owner, event.id)
    const saved = (
      await owner
        .put(`/api/events/${event.id}/layout`)
        .send(
          changes(empty, {
            roomDepth: 900,
            floorImage: PICTURE,
            floorImageRotation: 30,
            placements: [{ tableId: table.id, x: 300, y: 400, rotation: 90 }],
            objects: [STAGE],
          }),
        )
        .expect(200)
    ).body as Layout

    const copy = (
      await owner
        .post(`/api/events/${event.id}/duplicate`)
        .send({ name: 'Again', startsAt: '2033-01-01T18:00:00.000Z' })
        .expect(201)
    ).body as { id: string }
    const copied = await layoutOf(owner, copy.id)
    const [copiedTable] = (
      await owner.get(`/api/events/${copy.id}/tables`).expect(200)
    ).body as { table: { id: string } }[]
    expect(copied).toMatchObject({
      roomDepth: 900,
      floorImageRotation: 30,
      placements: [
        { tableId: copiedTable!.table.id, x: 300, y: 400, rotation: 90 },
      ],
      objects: saved.objects,
      version: 0,
    })
    expect(copied.floorImage).not.toBe(saved.floorImage)
    await owner.get(copied.floorImage!).expect(200)

    await owner.delete(`/api/events/${event.id}`).expect(204)
    await owner.get(saved.floorImage!).expect(404)
    await owner.get(copied.floorImage!).expect(200)
  })
})
