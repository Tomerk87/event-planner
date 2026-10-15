import { createContext, useContext } from 'react'
import type { SignInInput, SignUpInput } from '../../domain/accounts.ts'
import type {
  AccountEmailService,
  Session,
} from '../../services/contracts/index.ts'

export interface SessionContextValue {
  /** Null while nobody is signed in and the demo is not open. */
  session: Session | null
  /** False when this deployment has the public demo switched off. */
  demoAvailable: boolean
  /** Email links of real accounts, which work without a session (D88). */
  accountEmail: AccountEmailService
  signUp: (input: SignUpInput) => Promise<void>
  signIn: (input: SignInInput) => Promise<void>
  enterDemo: () => Promise<void>
  signOut: () => Promise<void>
}

export const SessionContext = createContext<SessionContextValue | null>(null)

export function useSession(): SessionContextValue {
  const value = useContext(SessionContext)
  if (!value) {
    throw new Error('useSession must be used inside a SessionProvider')
  }
  return value
}
