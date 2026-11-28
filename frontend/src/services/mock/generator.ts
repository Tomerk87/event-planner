import { fromLocalDateTime, toLocalDateTime } from '../../domain/eventTime.ts'
import {
  DEFAULT_FLOOR_IMAGE,
  DEFAULT_OBJECT_SIZE,
  tableFootprint,
} from '../../domain/layout.ts'
import { renderMessage } from '../../domain/messages.ts'
import type {
  Event,
  EventLayout,
  EventMembership,
  EventTable,
  Guest,
  MessageSend,
  RsvpLanguage,
  RsvpResponse,
  RsvpStatus,
  TableShape,
  UnknownRsvp,
  User,
} from '../../domain/models.ts'
import {
  formatPhone,
  normalizePhone,
  type Country,
} from '../../domain/phone.ts'
import type { EventRole } from '../../domain/roles.ts'
import { tableOccupancy } from '../../domain/seating.ts'
import { defaultMessageTemplate, defaultRsvpSettings } from './defaults.ts'
import { messageValuesFor } from './messageValues.ts'
import type { DemoState } from './state.ts'
import type {
  LayoutTemplate,
  VenueMemberRole,
  VenueSpace,
} from '../../domain/venues.ts'

/**
 * Generates the demo dataset. Everything in it is fictional: names are drawn
 * from generic lists, email addresses use example.com, and phone numbers use
 * ranges that no operator can assign (Israel +972 00-…, Brazil area code
 * 00), so they cannot reach a real person.
 *
 * There is one set of sample events per market (D103): Israel's, in English
 * and Hebrew, and Brazil's, in Portuguese. The same market always gives the
 * same data. Dates are placed relative to `now`, so upcoming events are
 * upcoming and past events are past whenever a visitor first opens the demo.
 */

const DAY_MS = 86_400_000
const HOUR_MS = 3_600_000

/** Base address written into generated message history. */
export const DEMO_BASE_URL = 'https://rsvp.example.com'

type Random = () => number

function createRandom(seed: number): Random {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let mixed = state
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1)
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61)
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4_294_967_296
  }
}

function intBetween(random: Random, min: number, max: number): number {
  return min + Math.floor(random() * (max - min + 1))
}

function pick<Item>(random: Random, items: readonly Item[]): Item {
  const item = items[Math.floor(random() * items.length)]
  if (item === undefined) {
    throw new Error('cannot pick from an empty list')
  }
  return item
}

const NAMES: Record<RsvpLanguage, { first: string[]; last: string[] }> = {
  en: {
    first: [
      'Alex',
      'Jordan',
      'Sam',
      'Riley',
      'Casey',
      'Morgan',
      'Taylor',
      'Jamie',
      'Avery',
      'Quinn',
      'Rowan',
      'Skyler',
      'Parker',
      'Reese',
      'Emerson',
      'Hayden',
      'Dana',
      'Robin',
      'Blake',
      'Cameron',
      'Drew',
      'Elliot',
      'Finley',
      'Harper',
      'Jesse',
      'Kai',
      'Logan',
      'Micah',
      'Noel',
      'Peyton',
    ],
    last: [
      'Reed',
      'Carter',
      'Brooks',
      'Lane',
      'Hayes',
      'Ellis',
      'Foster',
      'Grant',
      'Hale',
      'Irwin',
      'Keller',
      'Lowe',
      'Marsh',
      'Nash',
      'Owens',
      'Price',
      'Quill',
      'Rhodes',
      'Shaw',
      'Tate',
      'Vance',
      'Wells',
      'York',
      'Abbott',
      'Barlow',
      'Cross',
      'Dalton',
      'Easton',
      'Flynn',
      'Gates',
    ],
  },
  he: {
    first: [
      'נועה',
      'איתי',
      'מאיה',
      'יונתן',
      'תמר',
      'עומר',
      'שירה',
      'אורי',
      'רוני',
      'עידו',
      'יעל',
      'גיא',
      'הילה',
      'אלון',
      'ליאור',
      'דנה',
      'עמית',
      'מיכל',
      'נדב',
      'שני',
    ],
    last: [
      'אלון',
      'ברק',
      'גולן',
      'דור',
      'הראל',
      'זיו',
      'חן',
      'טל',
      'יער',
      'כרמי',
      'לביא',
      'מור',
      'נוי',
      'סער',
      'עוז',
      'פז',
      'צור',
      'קדם',
      'רז',
      'שחר',
    ],
  },
  pt: {
    first: [
      'Ana',
      'Bruno',
      'Carla',
      'Daniel',
      'Eduarda',
      'Felipe',
      'Gabriela',
      'Henrique',
      'Isabela',
      'João',
      'Larissa',
      'Lucas',
      'Mariana',
      'Mateus',
      'Natália',
      'Pedro',
      'Rafaela',
      'Rodrigo',
      'Sofia',
      'Thiago',
      'Vitória',
      'Gustavo',
      'Camila',
      'Leonardo',
    ],
    last: [
      'Silva',
      'Santos',
      'Oliveira',
      'Souza',
      'Rodrigues',
      'Ferreira',
      'Alves',
      'Pereira',
      'Lima',
      'Gomes',
      'Costa',
      'Ribeiro',
      'Martins',
      'Carvalho',
      'Almeida',
      'Lopes',
      'Soares',
      'Fernandes',
      'Vieira',
      'Barbosa',
      'Rocha',
      'Dias',
      'Nascimento',
      'Moreira',
    ],
  },
}

// Guest groups, dealt out in turn; every fifth guest is in none.
const GUEST_GROUPS: Record<RsvpLanguage, (string | null)[]> = {
  en: ['Family', 'Friends', 'Work', 'Neighbours', null],
  he: ['משפחה', 'חברים', 'עבודה', 'שכנים', null],
  pt: ['Família', 'Amigos', 'Trabalho', 'Vizinhos', null],
}

const TABLE_CAPACITIES = [10, 12, 8, 10, 12, 14, 10, 8, 12, 10]
const TABLE_SHAPES: TableShape[] = ['CIRCLE', 'CIRCLE', 'RECTANGLE', 'SQUARE']
// Chairs left empty at each table in turn, so that tables are ready, almost
// full and full rather than all packed to the last chair.
const TABLE_FREE_SEATS = [0, 1, 3, 0, 2, 4, 1, 0, 3, 2]

interface EventSpec {
  name: string
  language: RsvpLanguage
  daysFromNow: number
  hour: number
  minute: number
  maxAttendees: number
  location: string
  rsvpTitle: string | null
  guests: number
  tables: number
  unknownRsvps: number
  deletedGuests: number
  overCapacityTables: number
  /** The demo user's role, then the other members' roles. */
  roles: [EventRole, ...EventRole[]]
}

/** One market's sample events and people (D103). */
interface DemoPack {
  seed: number
  timeZone: string
  /** The demo user first, then the other members. */
  users: string[]
  /** Invited to the main event before having an account. */
  invitedEmail: string
  events: EventSpec[]
  /** The range of the guests' undiallable numbers, by event and guest. */
  guestPhone: (eventNumber: number, guestNumber: number) => string
  /** The same for responses from numbers that matched no guest. */
  unknownPhone: (eventNumber: number, responseNumber: number) => string
}

const ISRAEL_EVENTS: EventSpec[] = [
  {
    name: 'Maya & Daniel’s Wedding',
    language: 'en',
    daysFromNow: 60,
    hour: 18,
    minute: 30,
    maxAttendees: 300,
    location: 'Seaside Hall, Tel Aviv',
    rsvpTitle: 'Maya & Daniel',
    guests: 164,
    tables: 18,
    unknownRsvps: 8,
    deletedGuests: 5,
    overCapacityTables: 2,
    roles: ['OWNER', 'ADMIN', 'ADMIN', 'VIEWER', 'VIEWER', 'VIEWER'],
  },
  {
    name: 'חגיגת בר מצווה לאיתי',
    language: 'he',
    daysFromNow: 30,
    hour: 19,
    minute: 0,
    maxAttendees: 120,
    location: 'אולם הגן, חיפה',
    rsvpTitle: null,
    guests: 36,
    tables: 5,
    unknownRsvps: 2,
    deletedGuests: 1,
    overCapacityTables: 0,
    roles: ['OWNER', 'VIEWER'],
  },
  {
    name: 'Levi Family Birthday',
    language: 'en',
    daysFromNow: 120,
    hour: 19,
    minute: 0,
    maxAttendees: 150,
    location: 'Garden Terrace, Jerusalem',
    rsvpTitle: null,
    guests: 42,
    tables: 6,
    unknownRsvps: 1,
    deletedGuests: 0,
    overCapacityTables: 1,
    roles: ['ADMIN', 'OWNER', 'VIEWER'],
  },
  {
    name: 'Product Launch Evening',
    language: 'en',
    daysFromNow: 200,
    hour: 9,
    minute: 0,
    maxAttendees: 500,
    location: 'Harbour Conference Centre, Haifa',
    rsvpTitle: null,
    guests: 58,
    tables: 8,
    unknownRsvps: 0,
    deletedGuests: 2,
    overCapacityTables: 0,
    roles: ['VIEWER', 'OWNER', 'ADMIN'],
  },
  {
    name: 'Spring Garden Party',
    language: 'en',
    daysFromNow: -200,
    hour: 19,
    minute: 30,
    maxAttendees: 120,
    location: 'Orchard House, Herzliya',
    rsvpTitle: null,
    guests: 44,
    tables: 6,
    unknownRsvps: 1,
    deletedGuests: 0,
    overCapacityTables: 0,
    roles: ['OWNER', 'ADMIN'],
  },
  {
    name: 'Annual Company Gala',
    language: 'en',
    daysFromNow: -500,
    hour: 18,
    minute: 0,
    maxAttendees: 300,
    location: 'Grand Ballroom, Tel Aviv',
    rsvpTitle: null,
    guests: 80,
    tables: 10,
    unknownRsvps: 0,
    deletedGuests: 3,
    overCapacityTables: 0,
    roles: ['ADMIN', 'OWNER', 'OWNER', 'VIEWER'],
  },
]

// The same mix as Israel's: a large wedding with every edge case, a smaller
// family party, upcoming and past events, and each role of the demo user.
const BRAZIL_EVENTS: EventSpec[] = [
  {
    name: 'Casamento de Mariana & Rafael',
    language: 'pt',
    daysFromNow: 60,
    hour: 18,
    minute: 30,
    maxAttendees: 300,
    location: 'Espaço Jardim, São Paulo',
    rsvpTitle: 'Mariana & Rafael',
    guests: 164,
    tables: 18,
    unknownRsvps: 8,
    deletedGuests: 5,
    overCapacityTables: 2,
    roles: ['OWNER', 'ADMIN', 'ADMIN', 'VIEWER', 'VIEWER', 'VIEWER'],
  },
  {
    name: 'Festa de 15 anos da Júlia',
    language: 'pt',
    daysFromNow: 30,
    hour: 20,
    minute: 0,
    maxAttendees: 120,
    location: 'Salão Primavera, Belo Horizonte',
    rsvpTitle: null,
    guests: 36,
    tables: 5,
    unknownRsvps: 2,
    deletedGuests: 1,
    overCapacityTables: 0,
    roles: ['OWNER', 'VIEWER'],
  },
  {
    name: 'Aniversário da Família Oliveira',
    language: 'pt',
    daysFromNow: 120,
    hour: 19,
    minute: 0,
    maxAttendees: 150,
    location: 'Terraço Jardim, Curitiba',
    rsvpTitle: null,
    guests: 42,
    tables: 6,
    unknownRsvps: 1,
    deletedGuests: 0,
    overCapacityTables: 1,
    roles: ['ADMIN', 'OWNER', 'VIEWER'],
  },
  {
    name: 'Lançamento de Produto',
    language: 'pt',
    daysFromNow: 200,
    hour: 9,
    minute: 0,
    maxAttendees: 500,
    location: 'Centro de Convenções, Rio de Janeiro',
    rsvpTitle: null,
    guests: 58,
    tables: 8,
    unknownRsvps: 0,
    deletedGuests: 2,
    overCapacityTables: 0,
    roles: ['VIEWER', 'OWNER', 'ADMIN'],
  },
  {
    name: 'Festa Junina no Sítio',
    language: 'pt',
    daysFromNow: -200,
    hour: 18,
    minute: 0,
    maxAttendees: 120,
    location: 'Sítio Recanto, Campinas',
    rsvpTitle: null,
    guests: 44,
    tables: 6,
    unknownRsvps: 1,
    deletedGuests: 0,
    overCapacityTables: 0,
    roles: ['OWNER', 'ADMIN'],
  },
  {
    name: 'Confraternização Anual da Empresa',
    language: 'pt',
    daysFromNow: -500,
    hour: 19,
    minute: 0,
    maxAttendees: 300,
    location: 'Grande Salão, São Paulo',
    rsvpTitle: null,
    guests: 80,
    tables: 10,
    unknownRsvps: 0,
    deletedGuests: 3,
    overCapacityTables: 0,
    roles: ['ADMIN', 'OWNER', 'OWNER', 'VIEWER'],
  },
]

function pad(value: number, length: number): string {
  return String(value).padStart(length, '0')
}

const PACKS: Record<Country, DemoPack> = {
  IL: {
    seed: 20261012,
    timeZone: 'Asia/Jerusalem',
    users: [
      'Alex Morgan',
      'Jordan Hale',
      'Sam Keller',
      'Riley Nash',
      'Casey Owens',
      'Taylor Price',
      'Jamie Rhodes',
      'Avery Shaw',
    ],
    invitedEmail: 'morgan.reed@example.com',
    events: ISRAEL_EVENTS,
    guestPhone: (event, guest) => `+972 00-${pad(event, 3)}-${pad(guest, 4)}`,
    unknownPhone: (event, response) =>
      `+972 00-9${pad(event, 2)}-${pad(response, 4)}`,
  },
  BR: {
    // Another seed, so no RSVP link is the same as one of Israel's.
    seed: 20261017,
    timeZone: 'America/Sao_Paulo',
    users: [
      'Ana Oliveira',
      'Bruno Santos',
      'Carla Souza',
      'Diego Lima',
      'Eduarda Costa',
      'Felipe Rocha',
      'Gabriela Alves',
      'Henrique Martins',
    ],
    invitedEmail: 'marina.reis@example.com',
    events: BRAZIL_EVENTS,
    // Area code 00 does not exist in Brazil.
    guestPhone: (event, guest) => `+55 00 9${pad(event, 4)}-${pad(guest, 4)}`,
    unknownPhone: (event, response) =>
      `+55 00 8${pad(event, 4)}-${pad(response, 4)}`,
  },
}

function createUsers(pack: DemoPack): User[] {
  return pack.users.map((name, index) => ({
    id: `usr-${index + 1}`,
    name,
    email: `${name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(' ', '.')}@example.com`,
    isSuperUser: false,
  }))
}

function createEvent(
  pack: DemoPack,
  country: Country,
  spec: EventSpec,
  index: number,
  now: Date,
  random: Random,
): Event {
  const day = toLocalDateTime(
    new Date(now.getTime() + spec.daysFromNow * DAY_MS),
    pack.timeZone,
  )
  const startsAt = fromLocalDateTime(
    { ...day, hour: spec.hour, minute: spec.minute },
    pack.timeZone,
  )
  return {
    id: `evt-${index + 1}`,
    name: spec.name,
    startsAt: startsAt.toISOString(),
    timeZone: pack.timeZone,
    maxAttendees: spec.maxAttendees,
    defaultAllowedAttendees: 5,
    rsvpLanguage: spec.language,
    country,
    location: spec.location,
    rsvpTitle: spec.rsvpTitle,
    coverImage: null,
    rsvpSlug: Array.from({ length: 8 }, () =>
      intBetween(random, 0, 35).toString(36),
    ).join(''),
  }
}

function invitationNameFor(
  random: Random,
  firstName: string,
  lastName: string,
  language: RsvpLanguage,
  names: { first: string[] },
): string {
  const roll = random()
  if (roll < 0.4) {
    return firstName
  }
  if (roll < 0.75) {
    return `${firstName} & ${pick(random, names.first)}`
  }
  return FAMILY[language](lastName)
}

const FAMILY: Record<RsvpLanguage, (lastName: string) => string> = {
  en: (lastName) => `The ${lastName} Family`,
  he: (lastName) => `משפחת ${lastName}`,
  pt: (lastName) => `Família ${lastName}`,
}

/**
 * Two guests of one event never share a full name, so lists stay readable.
 * A clash moves on to the next last name (then first name) in order, without
 * drawing more random numbers, so the rest of the dataset is unaffected.
 */
function uniqueName(
  firstName: string,
  lastName: string,
  names: { first: string[]; last: string[] },
  used: Set<string>,
): { firstName: string; lastName: string } {
  const firstStart = names.first.indexOf(firstName)
  const lastStart = names.last.indexOf(lastName)
  for (let firstStep = 0; firstStep < names.first.length; firstStep += 1) {
    for (let lastStep = 0; lastStep < names.last.length; lastStep += 1) {
      const candidate = {
        firstName:
          names.first[(firstStart + firstStep) % names.first.length] ??
          firstName,
        lastName:
          names.last[(lastStart + lastStep) % names.last.length] ?? lastName,
      }
      const key = `${candidate.firstName} ${candidate.lastName}`
      if (!used.has(key)) {
        used.add(key)
        return candidate
      }
    }
  }
  return { firstName, lastName }
}

/**
 * A demo phone as the application shows it. The numbers are in ranges no
 * operator assigns, so they can never reach a real person.
 */
function demoPhone(international: string): string {
  return formatPhone(normalizePhone(international))
}

function pickStatus(random: Random): RsvpStatus {
  const roll = random()
  if (roll < 0.62) {
    return 'APPROVED'
  }
  if (roll < 0.82) {
    return 'DECLINED'
  }
  if (roll < 0.87) {
    return 'NOT_SURE'
  }
  return 'NO_RESPONSE'
}

interface EventData {
  guests: Guest[]
  tables: EventTable[]
  unknownRsvps: UnknownRsvp[]
  sends: MessageSend[]
}

function createEventData(
  pack: DemoPack,
  spec: EventSpec,
  event: Event,
  eventIndex: number,
  now: Date,
  random: Random,
): EventData {
  const names = NAMES[spec.language]
  const template = defaultMessageTemplate(event).body
  const startsAt = new Date(event.startsAt).getTime()
  // Activity happens in the weeks before the event, and never in the future.
  const windowEnd = Math.min(now.getTime() - HOUR_MS, startsAt - DAY_MS)
  const windowStart = windowEnd - 45 * DAY_MS
  const momentIn = (from: number, to: number) =>
    from + Math.floor(random() * Math.max(1, to - from))

  const guests: Guest[] = []
  const sends: MessageSend[] = []
  const usedNames = new Set<string>()

  for (let index = 0; index < spec.guests; index += 1) {
    const { firstName, lastName } = uniqueName(
      pick(random, names.first),
      pick(random, names.last),
      names,
      usedNames,
    )
    const phone = demoPhone(pack.guestPhone(eventIndex + 1, index + 1))
    const allowedAttendees = random() < 0.75 ? 5 : intBetween(random, 1, 10)

    const sendRoll = random()
    const sentCount =
      sendRoll < 0.22 ? 0 : sendRoll < 0.8 ? 1 : intBetween(random, 2, 5)
    const sentAt = Array.from({ length: sentCount }, () =>
      momentIn(windowStart, windowEnd - DAY_MS),
    ).sort((a, b) => a - b)

    const status: RsvpStatus =
      sentCount === 0 ? 'NO_RESPONSE' : pickStatus(random)
    const responded = status !== 'NO_RESPONSE'
    const firstSend = sentAt[0] ?? windowStart
    const lastSend = sentAt[sentAt.length - 1]

    const guest: Guest = {
      id: `gst-${eventIndex + 1}-${pad(index + 1, 4)}`,
      eventId: event.id,
      firstName,
      lastName,
      invitationName: responded
        ? invitationNameFor(random, firstName, lastName, spec.language, names)
        : null,
      phone,
      normalizedPhone: normalizePhone(phone),
      allowedAttendees,
      confirmedAttendees:
        status === 'APPROVED'
          ? intBetween(random, 1, allowedAttendees)
          : status === 'DECLINED'
            ? 0
            : null,
      rsvpStatus: status,
      invitationSentCount: sentCount,
      lastInvitationSentAt:
        lastSend === undefined ? null : new Date(lastSend).toISOString(),
      lastRsvpResponseAt: responded
        ? new Date(momentIn(firstSend + HOUR_MS, windowEnd)).toISOString()
        : null,
      tableId: null,
      group: GUEST_GROUPS[spec.language][index % 5] ?? null,
      deleted: false,
    }
    guests.push(guest)

    const message = renderMessage(
      template,
      messageValuesFor(guest, event, DEMO_BASE_URL),
    )
    sentAt.forEach((moment, sendIndex) => {
      sends.push({
        id: `snd-${eventIndex + 1}-${pad(index + 1, 4)}-${sendIndex + 1}`,
        eventId: event.id,
        guestId: guest.id,
        sentAt: new Date(moment).toISOString(),
        message,
      })
    })
  }

  const tables: EventTable[] = Array.from(
    { length: spec.tables },
    (_, index) => ({
      id: `tbl-${eventIndex + 1}-${pad(index + 1, 2)}`,
      eventId: event.id,
      number: index + 1,
      capacity: TABLE_CAPACITIES[index % TABLE_CAPACITIES.length] ?? 10,
      shape: TABLE_SHAPES[index % TABLE_SHAPES.length] ?? 'CIRCLE',
    }),
  )

  // Soft-deleted guests keep their history but hold no seat.
  guests.slice(-spec.deletedGuests || guests.length).forEach((guest) => {
    guest.deleted = true
  })

  // Seat Approved parties, leaving every seventh one waiting for a table.
  let approvedSeen = 0
  for (const guest of guests) {
    if (guest.deleted || guest.rsvpStatus !== 'APPROVED') {
      continue
    }
    approvedSeen += 1
    if (approvedSeen % 7 === 0) {
      continue
    }
    const table = tables.find(
      (candidate, index) =>
        tableOccupancy(candidate.id, guests) +
          (guest.confirmedAttendees ?? 0) <=
        candidate.capacity -
          (TABLE_FREE_SEATS[index % TABLE_FREE_SEATS.length] ?? 0),
    )
    if (table) {
      guest.tableId = table.id
    }
  }

  // Deliberate edge cases. A table's capacity is set from its occupancy so
  // that it is exactly full, or over capacity as after an RSVP increase.
  const occupied = tables.filter(
    (table) => tableOccupancy(table.id, guests) > 2,
  )
  const [fullTable] = occupied
  if (fullTable) {
    fullTable.capacity = tableOccupancy(fullTable.id, guests)
  }
  occupied
    .slice(-spec.overCapacityTables - 1, -1)
    .slice(0, spec.overCapacityTables)
    .forEach((table, index) => {
      table.capacity = tableOccupancy(table.id, guests) - (2 - (index % 2))
    })

  const responses: RsvpResponse[] = [
    'APPROVED',
    'APPROVED',
    'DECLINED',
    'NOT_SURE',
  ]
  const unknownRsvps: UnknownRsvp[] = Array.from(
    { length: spec.unknownRsvps },
    (_, index) => {
      const status = responses[index % responses.length] ?? 'APPROVED'
      const phone = demoPhone(pack.unknownPhone(eventIndex + 1, index + 1))
      return {
        id: `unk-${eventIndex + 1}-${pad(index + 1, 3)}`,
        eventId: event.id,
        name: `${pick(random, names.first)} ${pick(random, names.last)}`,
        phone,
        normalizedPhone: normalizePhone(phone),
        rsvpStatus: status,
        confirmedAttendees:
          status === 'APPROVED'
            ? intBetween(random, 1, event.defaultAllowedAttendees)
            : status === 'DECLINED'
              ? 0
              : null,
        submittedAt: new Date(momentIn(windowStart, windowEnd)).toISOString(),
        rejectedAt: null,
      }
    },
  )
  // One response the organizer has already rejected, so the Rejected list is
  // not empty in the main event. Built from fixed values, without drawing
  // random numbers, so the rest of the dataset is unaffected.
  if (eventIndex === 0) {
    const phone = demoPhone(pack.unknownPhone(eventIndex + 1, 9001))
    unknownRsvps.push({
      id: `unk-${eventIndex + 1}-rejected`,
      eventId: event.id,
      name: `${names.first[3] ?? ''} ${names.last[5] ?? ''}`.trim(),
      phone,
      normalizedPhone: normalizePhone(phone),
      rsvpStatus: 'APPROVED',
      confirmedAttendees: 2,
      submittedAt: new Date(windowStart + 3 * DAY_MS).toISOString(),
      rejectedAt: new Date(windowStart + 4 * DAY_MS).toISOString(),
    })
  }

  return { guests, tables, unknownRsvps, sends }
}

// Room around the tables: a band for the bar and the food station on each
// side, the stage at the top and the entrance at the bottom; in centimetres.
const SIDE_BAND = 300
const STAGE_BAND = 500
const ENTRANCE_BAND = 250
const AISLE = 60

/**
 * A floor plan in the spirit of the Arrangement mockups (D100): a stage at
 * the top, a bar and a food station on either side, an entrance at the
 * bottom, a plant in each corner and the tables in rows between them. The
 * main event leaves its last table off the plan, to show an unplaced table.
 * Built without random numbers, so the rest of the dataset is unaffected.
 */
function createLayout(
  event: Event,
  tables: readonly EventTable[],
  leaveOneUnplaced: boolean,
): EventLayout {
  const placed = leaveOneUnplaced ? tables.slice(0, -1) : tables
  const cell =
    Math.max(
      ...tables.map((table) => {
        const footprint = tableFootprint(table, { x: 0, y: 0, rotation: 0 })
        return footprint.kind === 'circle'
          ? footprint.radius * 2
          : Math.max(footprint.width, footprint.height)
      }),
    ) + AISLE
  const columns = Math.max(3, Math.ceil(Math.sqrt(placed.length * 1.5)))
  const rows = Math.max(1, Math.ceil(placed.length / columns))
  const roomWidth = Math.round(2 * SIDE_BAND + columns * cell)
  const roomDepth = Math.round(STAGE_BAND + rows * cell + ENTRANCE_BAND)
  const object = (
    id: string,
    kind: EventLayout['objects'][number]['kind'],
    x: number,
    y: number,
    size: Partial<{ width: number; height: number }> = {},
  ) => ({
    id,
    kind,
    x: Math.round(x),
    y: Math.round(y),
    ...DEFAULT_OBJECT_SIZE[kind],
    ...size,
    rotation: 0,
    label: null,
  })
  const middle = (rows * cell) / 2 + STAGE_BAND
  return {
    eventId: event.id,
    roomWidth,
    roomDepth,
    floorImage: null,
    ...DEFAULT_FLOOR_IMAGE,
    placements: placed.map((table, index) => ({
      tableId: table.id,
      x: Math.round(SIDE_BAND + ((index % columns) + 0.5) * cell),
      y: Math.round(STAGE_BAND + (Math.floor(index / columns) + 0.5) * cell),
      rotation: 0,
    })),
    objects: [
      object('stage', 'STAGE', roomWidth / 2, 200, {
        width: Math.min(800, columns * cell - 2 * AISLE),
      }),
      object('bar', 'BAR', SIDE_BAND / 2, middle, {
        height: Math.min(600, rows * cell),
      }),
      object('food', 'FOOD_STATION', roomWidth - SIDE_BAND / 2, middle, {
        height: Math.min(600, rows * cell),
      }),
      object('entrance', 'ENTRANCE', roomWidth / 2, roomDepth - 20),
      object('plant-1', 'PLANT', 60, 60),
      object('plant-2', 'PLANT', roomWidth - 60, 60),
      object('plant-3', 'PLANT', 60, roomDepth - 60),
      object('plant-4', 'PLANT', roomWidth - 60, roomDepth - 60),
    ],
    version: 1,
  }
}

/** The market whose sample events a visitor gets (D103): by language. */
/** A venue event's client in the sample data (D115). */
interface ClientSpec {
  name: string
  email: string
  /** Joined accepted; sent is still open; expired is past its seven days. */
  state: 'joined' | 'sent' | 'expired'
  sentDaysAgo: number
  /** The people a joined client invited (mockup #10). */
  team?: {
    name: string
    email: string
    role: 'CLIENT_EDITOR' | 'CLIENT_VIEWER'
  }[]
  /** Invited by the client, with no account yet. */
  pending?: { email: string; role: 'CLIENT_EDITOR' | 'CLIENT_VIEWER' }[]
}

interface VenueEventSpec extends Omit<EventSpec, 'roles' | 'location'> {
  /** Index into the venue's spaces. */
  space: number
  client: ClientSpec | null
}

interface VenueSpec {
  name: string
  /** The demo user's role in this venue (D112). */
  role: VenueMemberRole
  contactEmail: string
  contactPhone: string
  spaces: SpaceSpec[]
  events: VenueEventSpec[]
  /** Someone invited to the team who has not joined yet. */
  invitedEmail?: string
}

interface SpaceSpec extends Pick<
  VenueSpace,
  'name' | 'address' | 'maxPeople' | 'maxTables'
> {
  archived?: boolean
  /** Its layout templates, each drawn from one of its events (D111). */
  templates: { name: string; archived?: boolean }[]
}

/** The venue part of a market's sample data (V2.2). */
interface VenuePack {
  seed: number
  /** The other venue members, beside the demo user. */
  members: string[]
  venues: VenueSpec[]
}

const venueEvent = (
  spec: Omit<
    VenueEventSpec,
    'unknownRsvps' | 'deletedGuests' | 'overCapacityTables' | 'rsvpTitle'
  > &
    Partial<VenueEventSpec>,
): VenueEventSpec => ({
  unknownRsvps: 0,
  deletedGuests: 0,
  overCapacityTables: 0,
  rsvpTitle: null,
  ...spec,
})

// The mix of the venue mockups: every status of D115, upcoming and past
// events, and a venue where the demo user is a Manager rather than the Owner.
const VENUE_PACKS: Record<Country, VenuePack> = {
  IL: {
    seed: 20261127,
    members: ['Noa Barak', 'Eitan Shalev'],
    venues: [
      {
        name: 'Grand Garden Hall',
        role: 'VENUE_OWNER',
        contactEmail: 'events@grandgardenhall.example.com',
        contactPhone: '03-000-0000',
        invitedEmail: 'daniel.mor@example.com',
        spaces: [
          {
            name: 'Main Hall',
            address: '12 Orchard Lane, Ramat Gan',
            maxPeople: 400,
            maxTables: 45,
            templates: [
              { name: 'Wedding Rounds' },
              { name: 'Gala Long Tables' },
              { name: 'Bar Mitzvah Mixed' },
              { name: 'Classic Rounds', archived: true },
            ],
          },
          {
            name: 'Garden',
            address: '12 Orchard Lane, Ramat Gan',
            maxPeople: 250,
            maxTables: 25,
            templates: [{ name: 'Garden Rounds' }, { name: 'Cocktail Mix' }],
          },
          {
            name: 'Rooftop Lounge',
            address: '12 Orchard Lane, Ramat Gan (5th floor)',
            maxPeople: 120,
            maxTables: null,
            templates: [],
          },
          {
            name: 'Winter Pavilion',
            address: '12 Orchard Lane, Ramat Gan',
            maxPeople: 200,
            maxTables: 20,
            archived: true,
            templates: [{ name: 'Pavilion Rounds' }],
          },
        ],
        events: [
          venueEvent({
            name: 'Dana & Yossi’s Wedding',
            language: 'en',
            daysFromNow: 20,
            hour: 19,
            minute: 30,
            maxAttendees: 350,
            space: 0,
            guests: 120,
            tables: 16,
            overCapacityTables: 1,
            unknownRsvps: 2,
            client: {
              name: 'Dana Levi',
              email: 'dana.levi@example.com',
              state: 'joined',
              sentDaysAgo: 40,
              team: [
                {
                  name: 'Yossi Cohen',
                  email: 'yossi.cohen@example.com',
                  role: 'CLIENT_EDITOR',
                },
                {
                  name: 'Miriam Levi',
                  email: 'miriam.levi@example.com',
                  role: 'CLIENT_VIEWER',
                },
              ],
              pending: [
                { email: 'orly.events@example.com', role: 'CLIENT_EDITOR' },
              ],
            },
          }),
          venueEvent({
            name: 'Cohen Bar Mitzvah',
            language: 'en',
            daysFromNow: 42,
            hour: 18,
            minute: 0,
            maxAttendees: 180,
            space: 1,
            guests: 0,
            tables: 12,
            client: {
              name: 'Rachel Cohen',
              email: 'rachel.cohen@example.com',
              state: 'sent',
              sentDaysAgo: 3,
            },
          }),
          venueEvent({
            name: 'Noa & Amit’s Wedding',
            language: 'en',
            daysFromNow: 76,
            hour: 19,
            minute: 0,
            maxAttendees: 400,
            space: 0,
            guests: 0,
            tables: 20,
            client: null,
          }),
          venueEvent({
            name: 'Peretz Engagement Party',
            language: 'en',
            daysFromNow: 62,
            hour: 20,
            minute: 30,
            maxAttendees: 150,
            space: 1,
            guests: 0,
            tables: 8,
            client: {
              name: 'Yael Peretz',
              email: 'yael.peretz@example.com',
              state: 'expired',
              sentDaysAgo: 10,
            },
          }),
          venueEvent({
            name: 'Brightline Year-End Party',
            language: 'en',
            daysFromNow: 97,
            hour: 20,
            minute: 0,
            maxAttendees: 220,
            space: 1,
            guests: 50,
            tables: 10,
            client: {
              name: 'Tal Mizrahi',
              email: 'tal.mizrahi@example.com',
              state: 'joined',
              sentDaysAgo: 21,
            },
          }),
          venueEvent({
            name: 'Shira & Ben’s Wedding',
            language: 'en',
            daysFromNow: -36,
            hour: 19,
            minute: 0,
            maxAttendees: 300,
            space: 0,
            guests: 90,
            tables: 12,
            client: {
              name: 'Shira Katz',
              email: 'shira.katz@example.com',
              state: 'joined',
              sentDaysAgo: 120,
            },
          }),
          venueEvent({
            name: 'Miriam’s 60th Birthday',
            language: 'en',
            daysFromNow: -78,
            hour: 12,
            minute: 30,
            maxAttendees: 120,
            space: 1,
            guests: 36,
            tables: 6,
            client: {
              name: 'Miriam Levi',
              email: 'miriam.levi@example.com',
              state: 'joined',
              sentDaysAgo: 140,
            },
          }),
        ],
      },
      {
        name: 'Seaside Terrace',
        role: 'VENUE_MANAGER',
        contactEmail: 'hello@seasideterrace.example.com',
        contactPhone: '09-000-0000',
        spaces: [
          {
            name: 'Terrace',
            address: '5 Promenade Street, Herzliya',
            maxPeople: 180,
            maxTables: 18,
            templates: [{ name: 'Terrace Classic' }],
          },
        ],
        events: [
          venueEvent({
            name: 'Ofir & Lior’s Wedding',
            language: 'en',
            daysFromNow: 50,
            hour: 19,
            minute: 30,
            maxAttendees: 160,
            space: 0,
            guests: 40,
            tables: 8,
            client: {
              name: 'Ofir Ben-David',
              email: 'ofir.bendavid@example.com',
              state: 'joined',
              sentDaysAgo: 30,
            },
          }),
        ],
      },
    ],
  },
  BR: {
    seed: 20261128,
    members: ['Camila Rocha', 'Bruno Alves'],
    venues: [
      {
        name: 'Espaço Jardim Imperial',
        role: 'VENUE_OWNER',
        contactEmail: 'eventos@jardimimperial.example.com',
        contactPhone: '(11) 0000-0000',
        invitedEmail: 'joao.pereira@example.com',
        spaces: [
          {
            name: 'Salão Principal',
            address: 'Rua das Laranjeiras, 120, São Paulo',
            maxPeople: 400,
            maxTables: 45,
            templates: [
              { name: 'Casamento Redondas' },
              { name: 'Gala Mesas Longas' },
              { name: 'Festa Mista' },
              { name: 'Redondas Clássicas', archived: true },
            ],
          },
          {
            name: 'Jardim',
            address: 'Rua das Laranjeiras, 120, São Paulo',
            maxPeople: 250,
            maxTables: 25,
            templates: [{ name: 'Jardim Redondas' }, { name: 'Coquetel' }],
          },
          {
            name: 'Lounge da Cobertura',
            address: 'Rua das Laranjeiras, 120, São Paulo (5º andar)',
            maxPeople: 120,
            maxTables: null,
            templates: [],
          },
          {
            name: 'Pavilhão de Inverno',
            address: 'Rua das Laranjeiras, 120, São Paulo',
            maxPeople: 200,
            maxTables: 20,
            archived: true,
            templates: [{ name: 'Pavilhão Redondas' }],
          },
        ],
        events: [
          venueEvent({
            name: 'Casamento de Ana & Pedro',
            language: 'pt',
            daysFromNow: 20,
            hour: 19,
            minute: 30,
            maxAttendees: 350,
            space: 0,
            guests: 120,
            tables: 16,
            overCapacityTables: 1,
            unknownRsvps: 2,
            client: {
              name: 'Ana Souza',
              email: 'ana.souza@example.com',
              state: 'joined',
              sentDaysAgo: 40,
              team: [
                {
                  name: 'Pedro Lima',
                  email: 'pedro.lima@example.com',
                  role: 'CLIENT_EDITOR',
                },
                {
                  name: 'Lúcia Souza',
                  email: 'lucia.souza@example.com',
                  role: 'CLIENT_VIEWER',
                },
              ],
              pending: [
                { email: 'cerimonial.bela@example.com', role: 'CLIENT_EDITOR' },
              ],
            },
          }),
          venueEvent({
            name: 'Festa de 15 anos da Júlia',
            language: 'pt',
            daysFromNow: 42,
            hour: 20,
            minute: 0,
            maxAttendees: 180,
            space: 1,
            guests: 0,
            tables: 12,
            client: {
              name: 'Patrícia Lima',
              email: 'patricia.lima@example.com',
              state: 'sent',
              sentDaysAgo: 3,
            },
          }),
          venueEvent({
            name: 'Casamento de Bia & Lucas',
            language: 'pt',
            daysFromNow: 76,
            hour: 19,
            minute: 0,
            maxAttendees: 400,
            space: 0,
            guests: 0,
            tables: 20,
            client: null,
          }),
          venueEvent({
            name: 'Noivado de Carla & Diego',
            language: 'pt',
            daysFromNow: 62,
            hour: 20,
            minute: 30,
            maxAttendees: 150,
            space: 1,
            guests: 0,
            tables: 8,
            client: {
              name: 'Carla Mendes',
              email: 'carla.mendes@example.com',
              state: 'expired',
              sentDaysAgo: 10,
            },
          }),
          venueEvent({
            name: 'Confraternização Horizonte',
            language: 'pt',
            daysFromNow: 97,
            hour: 20,
            minute: 0,
            maxAttendees: 220,
            space: 1,
            guests: 50,
            tables: 10,
            client: {
              name: 'Renata Costa',
              email: 'renata.costa@example.com',
              state: 'joined',
              sentDaysAgo: 21,
            },
          }),
          venueEvent({
            name: 'Casamento de Fernanda & Tiago',
            language: 'pt',
            daysFromNow: -36,
            hour: 19,
            minute: 0,
            maxAttendees: 300,
            space: 0,
            guests: 90,
            tables: 12,
            client: {
              name: 'Fernanda Dias',
              email: 'fernanda.dias@example.com',
              state: 'joined',
              sentDaysAgo: 120,
            },
          }),
          venueEvent({
            name: 'Aniversário de 60 anos da Helena',
            language: 'pt',
            daysFromNow: -78,
            hour: 12,
            minute: 30,
            maxAttendees: 120,
            space: 1,
            guests: 36,
            tables: 6,
            client: {
              name: 'Helena Martins',
              email: 'helena.martins@example.com',
              state: 'joined',
              sentDaysAgo: 140,
            },
          }),
        ],
      },
      {
        name: 'Terraço Beira-Mar',
        role: 'VENUE_MANAGER',
        contactEmail: 'contato@terracobeiramar.example.com',
        contactPhone: '(21) 0000-0000',
        spaces: [
          {
            name: 'Terraço',
            address: 'Avenida Atlântica, 500, Rio de Janeiro',
            maxPeople: 180,
            maxTables: 18,
            templates: [{ name: 'Terraço Clássico' }],
          },
        ],
        events: [
          venueEvent({
            name: 'Casamento de Luiza & André',
            language: 'pt',
            daysFromNow: 50,
            hour: 19,
            minute: 30,
            maxAttendees: 160,
            space: 0,
            guests: 40,
            tables: 8,
            client: {
              name: 'Luiza Ferreira',
              email: 'luiza.ferreira@example.com',
              state: 'joined',
              sentDaysAgo: 30,
            },
          }),
        ],
      },
    ],
  },
}

/**
 * Adds the market's venues to a generated demo (V2.2): the organizations, the
 * demo user's membership of each, their spaces, and their events. A venue
 * event is an ordinary event with guests, tables and a floor plan, plus its
 * venue record; the demo user reaches it through the venue, not a personal
 * role, so it is not among their personal events. Its own random sequence
 * leaves the personal sample data exactly as before.
 */
function addDemoVenues(
  state: DemoState,
  pack: DemoPack,
  market: Country,
  now: Date,
): void {
  const venuePack = VENUE_PACKS[market]
  const random = createRandom(venuePack.seed)
  const daysAgo = (days: number) =>
    new Date(now.getTime() - days * DAY_MS).toISOString()
  const memberIds = venuePack.members.map((_name, index) => `usr-v${index + 1}`)
  state.users.push(
    ...createUsers({ ...pack, users: venuePack.members }).map(
      (user, index) => ({
        ...user,
        id: memberIds[index] ?? user.id,
      }),
    ),
  )
  state.organizations = []
  state.venueMembers = []
  state.venueSpaces = []
  state.venueEvents = []
  state.layoutTemplates = []
  state.venueMemberInvitations = []
  state.clientInvitationLinks = []
  state.clientTeam = []
  state.clientTeamInvitations = []
  // A sequence of its own, so the tokens leave the rest of the data as it was.
  const tokenRandom = createRandom(venuePack.seed + 7)
  const token = () =>
    Array.from({ length: 4 }, () =>
      Math.floor(tokenRandom() * 4_294_967_296)
        .toString(16)
        .padStart(8, '0'),
    ).join('')
  let clientNumber = 0
  const clientUser = (name: string, email: string): string => {
    const existing = state.users.find((user) => user.email === email)
    if (existing) {
      return existing.id
    }
    clientNumber += 1
    const id = `usr-c${clientNumber}`
    state.users.push({ id, name, email, isSuperUser: false })
    return id
  }

  let eventIndex = state.events.length
  venuePack.venues.forEach((venue, venueNumber) => {
    const organizationId = `org-${venueNumber + 1}`
    state.organizations?.push({
      id: organizationId,
      name: venue.name,
      defaultLanguage: market === 'BR' ? 'pt' : 'en',
      contactEmail: venue.contactEmail,
      contactPhone: venue.contactPhone,
    })
    // The demo user, and colleagues: Managers of a venue the demo user owns,
    // its Owner where the demo user is a Manager.
    state.venueMembers?.push({
      organizationId,
      userId: state.currentUserId,
      role: venue.role,
      since: daysAgo(270 - venueNumber * 60),
    })
    const colleagues =
      venue.role === 'VENUE_OWNER' ? memberIds : memberIds.slice(-1)
    colleagues.forEach((userId, position) => {
      state.venueMembers?.push({
        organizationId,
        userId,
        role: venue.role === 'VENUE_OWNER' ? 'VENUE_MANAGER' : 'VENUE_OWNER',
        since: daysAgo(220 - position * 90),
      })
    })
    if (venue.invitedEmail) {
      state.venueMemberInvitations?.push({
        organizationId,
        email: venue.invitedEmail,
        role: 'VENUE_MANAGER',
        sentAt: daysAgo(3),
      })
    }
    const spaces: VenueSpace[] = venue.spaces.map((space, spaceNumber) => ({
      id: `spc-${venueNumber + 1}-${spaceNumber + 1}`,
      organizationId,
      name: space.name,
      address: space.address,
      maxPeople: space.maxPeople,
      maxTables: space.maxTables,
      timeZone: pack.timeZone,
      photo: null,
      archived: space.archived ?? false,
    }))
    state.venueSpaces?.push(...spaces)

    // Each event, and the tables it has, by space: the templates are drawn
    // from them.
    const drawn: { spaceIndex: number; event: Event; tables: EventTable[] }[] =
      []
    for (const spec of venue.events) {
      const space = spaces[spec.space]
      if (!space) {
        throw new Error(`no space ${spec.space} in ${venue.name}`)
      }
      const eventSpec: EventSpec = {
        ...spec,
        location: space.address,
        roles: ['OWNER'],
      }
      const event = createEvent(
        pack,
        market,
        eventSpec,
        eventIndex,
        now,
        random,
      )
      const data = createEventData(
        pack,
        eventSpec,
        event,
        eventIndex,
        now,
        random,
      )
      const { client } = spec
      const sentAt =
        client && new Date(now.getTime() - client.sentDaysAgo * DAY_MS)
      // The demo user sent most invitations; a colleague sent every third.
      const sentBy =
        eventIndex % 3 === 2
          ? (colleagues[0] ?? state.currentUserId)
          : state.currentUserId
      state.events.push(event)
      state.venueEvents?.push({
        eventId: event.id,
        organizationId,
        spaceId: space.id,
        templateId: null,
        client:
          client && sentAt
            ? {
                name: client.name,
                email: client.email,
                sentAt: sentAt.toISOString(),
                acceptedAt:
                  client.state === 'joined'
                    ? new Date(sentAt.getTime() + DAY_MS).toISOString()
                    : null,
                sentBy,
                timesSent: 1,
              }
            : null,
      })
      if (client && sentAt) {
        state.clientInvitationLinks?.push({
          token: token(),
          eventId: event.id,
          email: client.email,
          sentAt: sentAt.toISOString(),
          status: client.state === 'joined' ? 'USED' : 'OPEN',
        })
      }
      if (client?.state === 'joined' && sentAt) {
        const joined = new Date(sentAt.getTime() + DAY_MS)
        state.clientTeam?.push({
          eventId: event.id,
          userId: clientUser(client.name, client.email),
          role: 'CLIENT_LEAD',
          since: joined.toISOString(),
        })
        for (const member of client.team ?? []) {
          state.clientTeam?.push({
            eventId: event.id,
            userId: clientUser(member.name, member.email),
            role: member.role,
            since: joined.toISOString(),
          })
        }
        for (const pending of client.pending ?? []) {
          state.clientTeamInvitations?.push({
            eventId: event.id,
            email: pending.email,
            role: pending.role,
            sentAt: new Date(joined.getTime() + DAY_MS).toISOString(),
          })
        }
      }
      state.guests.push(...data.guests)
      state.tables.push(...data.tables)
      state.layouts.push(createLayout(event, data.tables, true))
      state.unknownRsvps.push(...data.unknownRsvps)
      state.messageSends.push(...data.sends)
      state.rsvpSettings.push(defaultRsvpSettings(event))
      state.messageTemplates.push(defaultMessageTemplate(event))
      drawn.push({ spaceIndex: spec.space, event, tables: data.tables })
      eventIndex += 1
    }

    venue.spaces.forEach((spaceSpec, spaceIndex) => {
      const space = spaces[spaceIndex]
      if (!space) {
        return
      }
      const own = drawn.filter((item) => item.spaceIndex === spaceIndex)
      // A space with no events of its own borrows the venue's tables.
      const sources = own.length > 0 ? own : drawn
      spaceSpec.templates.forEach((templateSpec, templateNumber) => {
        const source = sources[templateNumber % sources.length]
        if (!source) {
          return
        }
        const template = templateFrom(
          `tpl-${venueNumber + 1}-${spaceIndex + 1}-${templateNumber + 1}`,
          space.id,
          templateSpec.name,
          source.event,
          source.tables,
          daysAgo(templateNumber * 23 + 1),
          templateSpec.archived ?? false,
        )
        state.layoutTemplates?.push(template)
        // The event this template was drawn from was created from it.
        const record = state.venueEvents?.find(
          (venueEvent) =>
            venueEvent.eventId === source.event.id &&
            venueEvent.templateId === null,
        )
        if (record && own.length > 0 && !template.archived) {
          record.templateId = template.id
        }
      })
    })
  })
}

/** A layout template drawn from an event's tables and floor plan. */
function templateFrom(
  id: string,
  spaceId: string,
  name: string,
  event: Event,
  tables: readonly EventTable[],
  updatedAt: string,
  archived: boolean,
): LayoutTemplate {
  const layout = createLayout(event, tables, false)
  return {
    id,
    spaceId,
    name,
    roomWidth: layout.roomWidth,
    roomDepth: layout.roomDepth,
    tables: tables.map((table) => {
      const placement = layout.placements.find(
        (candidate) => candidate.tableId === table.id,
      )
      return {
        number: table.number,
        capacity: table.capacity,
        shape: table.shape,
        x: placement?.x ?? null,
        y: placement?.y ?? null,
        rotation: placement?.rotation ?? 0,
      }
    }),
    objects: layout.objects.map((object) => ({ ...object })),
    floorImage: null,
    floorImageTransparency: layout.floorImageTransparency,
    floorImageZoom: layout.floorImageZoom,
    floorImageRotation: layout.floorImageRotation,
    version: 0,
    updatedAt,
    archived,
  }
}

export function demoMarketFor(language: string): Country {
  return language === 'pt' ? 'BR' : 'IL'
}

export function generateDemoState(
  now: Date,
  market: Country = 'IL',
): DemoState {
  const pack = PACKS[market]
  const random = createRandom(pack.seed)
  const users = createUsers(pack)
  const [currentUser, ...others] = users
  if (!currentUser) {
    throw new Error('the demo needs a current user')
  }

  const state: DemoState = {
    currentUserId: currentUser.id,
    demoRole: null,
    nextId: 1,
    users,
    events: [],
    memberships: [],
    invitations: [],
    guests: [],
    unknownRsvps: [],
    rsvpSettings: [],
    messageTemplates: [],
    messageSends: [],
    tables: [],
    layouts: [],
    market,
  }

  pack.events.forEach((spec, index) => {
    const event = createEvent(pack, market, spec, index, now, random)
    const data = createEventData(pack, spec, event, index, now, random)
    const memberships: EventMembership[] = spec.roles.map((role, position) => {
      const user =
        position === 0
          ? currentUser
          : others[(index + position - 1) % others.length]
      if (!user) {
        throw new Error('not enough demo users for the event members')
      }
      return { eventId: event.id, userId: user.id, role }
    })

    state.events.push(event)
    state.memberships.push(...memberships)
    if (index === 0) {
      // One person invited before they have an account, to show the state.
      state.invitations.push({
        id: 'inv-1',
        eventId: event.id,
        email: pack.invitedEmail,
        role: 'VIEWER',
      })
    }
    state.guests.push(...data.guests)
    state.tables.push(...data.tables)
    state.layouts.push(createLayout(event, data.tables, index === 0))
    state.unknownRsvps.push(...data.unknownRsvps)
    state.messageSends.push(...data.sends)
    state.rsvpSettings.push(defaultRsvpSettings(event))
    state.messageTemplates.push(defaultMessageTemplate(event))
  })

  addDemoVenues(state, pack, market, now)
  return state
}
