import { createContext, useContext } from 'react'
import type { Services } from './contracts/index.ts'

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
