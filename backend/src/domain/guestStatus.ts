import type { Guest } from './models.ts'

export const GUEST_DISPLAY_STATUSES = [
  'NOT_SENT',
  'AWAITING',
  'APPROVED',
  'NOT_SURE',
  'DECLINED',
] as const

export type GuestDisplayStatus = (typeof GUEST_DISPLAY_STATUSES)[number]

/**
 * The status shown for a guest. A guest who has not answered is "Awaiting
 * Response" only once an invitation was sent; before that they are "Not Sent".
 */
export function guestDisplayStatus(
  guest: Pick<Guest, 'rsvpStatus' | 'invitationSentCount'>,
): GuestDisplayStatus {
  if (guest.rsvpStatus !== 'NO_RESPONSE') {
    return guest.rsvpStatus
  }
  return guest.invitationSentCount > 0 ? 'AWAITING' : 'NOT_SENT'
}
