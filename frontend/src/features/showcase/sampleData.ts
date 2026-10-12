import type { Tone } from '../../shared/ui/Badge.tsx'

/**
 * Fictional sample values for the design-system showcase only. Product pages
 * get their data from the service layer, never from this file.
 */
export const sampleEvents = [
  { id: 'showcase', name: 'Garden Celebration' },
  { id: 'showcase-2', name: 'Autumn Gala' },
]

export const sampleUserName = 'Alex Morgan'

export const sampleContact = {
  phone: '+972 00-000-0001',
  email: 'guest@example.com',
  url: 'https://rsvp.example.com/abc123',
}

export type SampleStatus = 'approved' | 'declined' | 'notSure' | 'awaiting'

export const statusTones: Record<SampleStatus, Tone> = {
  approved: 'success',
  declined: 'danger',
  notSure: 'warning',
  awaiting: 'neutral',
}

export interface SampleGuest {
  id: string
  name: string
  phone: string
  allowed: number
  status: SampleStatus
  table: number | null
}

export const sampleGuests: SampleGuest[] = [
  {
    id: 'g1',
    name: 'Jordan Reed',
    phone: '+972 00-000-0001',
    allowed: 5,
    status: 'approved',
    table: 12,
  },
  {
    id: 'g2',
    name: 'Sam Carter',
    phone: '+972 00-000-0002',
    allowed: 4,
    status: 'awaiting',
    table: null,
  },
  {
    id: 'g3',
    name: 'Riley Brooks',
    phone: '+972 00-000-0003',
    allowed: 3,
    status: 'notSure',
    table: null,
  },
  {
    id: 'g4',
    name: 'Casey Lane',
    phone: '+972 00-000-0004',
    allowed: 5,
    status: 'declined',
    table: null,
  },
]
