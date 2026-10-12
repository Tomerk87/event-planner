import { createContext, useContext } from 'react'
import type { EventAccess } from '../../domain/access.ts'

/** The current user's access to the event being viewed; null outside an event. */
export const EventAccessContext = createContext<EventAccess | null>(null)

export function useEventAccess(): EventAccess | null {
  return useContext(EventAccessContext)
}
