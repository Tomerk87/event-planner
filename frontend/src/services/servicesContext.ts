import { createContext, useContext } from 'react'
import type { PublicRsvpService, Services } from './contracts/index.ts'

export const ServicesContext = createContext<Services | null>(null)

/** The data provider chosen at the application boundary. */
export function useServices(): Services {
  const services = useContext(ServicesContext)
  if (!services) {
    throw new Error(
      'useServices must be used inside a ServicesContext provider',
    )
  }
  return services
}

export const PublicRsvpContext = createContext<PublicRsvpService | null>(null)

/** The operations of the public RSVP page, which needs no session. */
export function usePublicRsvp(): PublicRsvpService {
  const service = useContext(PublicRsvpContext)
  if (!service) {
    throw new Error(
      'usePublicRsvp must be used inside a PublicRsvpContext provider',
    )
  }
  return service
}
